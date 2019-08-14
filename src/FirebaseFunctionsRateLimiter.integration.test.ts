/* tslint:disable:max-classes-per-file no-console */
import * as firebase from "@firebase/testing";
import * as BluebirdPromise from "bluebird";
import * as functions from "firebase-functions";

import { _, expect } from "./_test/test_environment";
import { mock } from "./FirebaseFunctionsRateLimiter.mock.integration.test";
import { PersistenceRecord } from "./persistence/PersistenceRecord";

before("startup", async function() {
    this.timeout(4000);
    const { firestore, database } = mock("firestore", {});
    await firestore
        .collection("a")
        .doc("a")
        .get();
    await database.ref("a").set({ a: "a" });
});

afterEach(async () => {
    try {
        await Promise.all(firebase.apps().map(app => app.delete()));
    } catch (error) {
        console.warn("Warning: Error in firebase shutdown " + error);
    }
});

//
describe("FirebaseFunctionsRateLimiter", () => {
    const backends: Array<"firestore" | "realtimedb" | "mock"> = ["firestore", "realtimedb", "mock"];
    backends.forEach((backend: "firestore" | "realtimedb" | "mock") =>
        describe("Backend " + backend, () => {
            describe("isQuotaExceeded", () => {
                it("Uses qualifier to identify document in the collection", async () => {
                    const { rateLimiter, uniqueCollectionName, qualifier, getDocument } = mock(backend, {});
                    await rateLimiter.isQuotaExceeded(qualifier);

                    const doc = await getDocument(uniqueCollectionName, qualifier);

                    const record = doc as PersistenceRecord;
                    expect(record.u)
                        .to.be.an("array")
                        .with.length(1);
                });

                it("Increments counter when limit is not exceeded", async () => {
                    const { rateLimiter, getDocument, uniqueCollectionName, qualifier } = mock(backend, {
                        maxCalls: 10,
                    });

                    const noOfTestCalls = 5;
                    for (let i = 0; i < noOfTestCalls; i++) {
                        await BluebirdPromise.delay(5);
                        await rateLimiter.isQuotaExceeded(qualifier);
                    }

                    const doc = await getDocument(uniqueCollectionName, qualifier);

                    const record = doc as PersistenceRecord;
                    expect(record.u)
                        .to.be.an("array")
                        .with.length(noOfTestCalls);
                });

                it("Does not increment counter when limit is exceeded", async () => {
                    const maxCalls = 5;
                    const noOfTestCalls = 10;

                    const { rateLimiter, getDocument, uniqueCollectionName, qualifier } = mock(backend, {
                        maxCalls,
                    });

                    for (let i = 0; i < noOfTestCalls; i++) {
                        await BluebirdPromise.delay(5);
                        await rateLimiter.isQuotaExceeded(qualifier);
                    }

                    const doc = await getDocument(uniqueCollectionName, qualifier);

                    const record = doc as PersistenceRecord;
                    expect(record.u)
                        .to.be.an("array")
                        .with.length(maxCalls);
                });

                it("Limit is exceeded if too much calls in specified period", async () => {
                    const maxCalls = 5;
                    const noOfTestCalls = 10;

                    const { rateLimiter, qualifier } = mock(backend, {
                        maxCalls,
                    });

                    for (let i = 0; i < noOfTestCalls; i++) {
                        await BluebirdPromise.delay(5);
                        await rateLimiter.isQuotaExceeded(qualifier);
                    }

                    expect(await rateLimiter.isQuotaExceeded(qualifier)).to.be.equal(true);
                });

                it("Limit is not exceeded if too much calls not in specified period", async function() {
                    this.timeout(3000);

                    const maxCalls = 2;
                    const periodSeconds = 1;

                    const { rateLimiter, qualifier } = mock(backend, {
                        maxCalls,
                        periodSeconds,
                    });

                    await rateLimiter.isQuotaExceeded(qualifier);
                    await BluebirdPromise.delay(periodSeconds * 1000 + 200);
                    expect(await rateLimiter.isQuotaExceeded(qualifier)).to.be.equal(false);
                });

                it("Calls older than period are removed from the database", async function() {
                    this.timeout(3000);

                    const maxCalls = 2;
                    const periodSeconds = 1;

                    const { rateLimiter, qualifier, uniqueCollectionName, getDocument } = mock(backend, {
                        maxCalls,
                        periodSeconds,
                    });

                    await rateLimiter.isQuotaExceeded(qualifier);
                    await BluebirdPromise.delay(periodSeconds * 1000 + 200);
                    await rateLimiter.isQuotaExceeded(qualifier);
                    await BluebirdPromise.delay(200);

                    const doc = await getDocument(uniqueCollectionName, qualifier);
                    const record = doc as PersistenceRecord;
                    expect(record.u)
                        .to.be.an("array")
                        .with.length(1);
                });
            });

            describe("rejectIfQuotaExceededOrRecordCall", () => {
                it("throws functions.https.HttpsException when limit is exceeded", async () => {
                    const maxCalls = 1;
                    const noOfTestCalls = 2;

                    const { rateLimiter, qualifier } = mock(backend, {
                        maxCalls,
                    });

                    for (let i = 0; i < noOfTestCalls; i++) {
                        await BluebirdPromise.delay(5);
                        await rateLimiter.isQuotaExceeded(qualifier);
                    }

                    await expect(rateLimiter.rejectOnQuotaExceeded(qualifier)).to.eventually.be.rejectedWith(
                        functions.https.HttpsError,
                    );
                });
            });
        }),
    );

    describe("Firestore backend specific tests", () => {
        it("Writes to specified collection", async () => {
            const { rateLimiter, firestore, uniqueCollectionName } = mock("firestore", {});
            await rateLimiter.isQuotaExceeded();

            const collection = await firestore.collection(uniqueCollectionName).get();
            expect(collection.size).to.be.equal(1);
        });
    });

    describe("Realtimedb backend specific tests", () => {
        it("Writes to specified key", async () => {
            const { rateLimiter, database, uniqueCollectionName } = mock("realtimedb", {});
            await rateLimiter.isQuotaExceeded();

            const collection = (await database.ref(`${uniqueCollectionName}`).once("value")).val();
            expect(_.keys(collection).length).to.be.equal(1);
        });
    });
});
