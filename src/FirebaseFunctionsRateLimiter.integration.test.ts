/* tslint:disable:max-classes-per-file no-console */
import * as firebase from "@firebase/testing";
import * as BluebirdPromise from "bluebird";
import { expect, use as chaiUse } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as functions from "firebase-functions";
import * as _ from "lodash";
import "mocha";
import * as uuid from "uuid/v4";

import { FirebaseFunctionsRateLimiter } from "./FirebaseFunctionsRateLimiter";
import { FirebaseFunctionsRateLimiterConfiguration } from "./FirebaseFunctionsRateLimiterConfiguration";
import { PersistenceRecord } from "./persistence/PersistenceRecord";
chaiUse(chaiAsPromised);

function mock(configApply: FirebaseFunctionsRateLimiterConfiguration) {
    const app = firebase.initializeTestApp({ projectId: "unit-testing-" + Date.now() });
    const uniqueCollectionName = uuid();
    const uniqueDocName = uuid();
    const qualifier = uuid();
    const firestore = app.firestore();
    const config: FirebaseFunctionsRateLimiterConfiguration = {
        firebaseCollectionKey: uniqueCollectionName,
        ...configApply,
    };
    const rateLimiter = new FirebaseFunctionsRateLimiter(config, firestore);
    return {
        app,
        firestore,
        uniqueCollectionName,
        uniqueDocName,
        qualifier,
        rateLimiter,
    };
}

afterEach(async () => {
    try {
        await Promise.all(firebase.apps().map(app => app.delete()));
    } catch (error) {
        console.warn("Warning: Error in firebase shutdown " + error);
    }
});

describe("FirebaseFunctionsRateLimiter", () => {
    describe("isQuotaExceeded", () => {
        it("Writes to specified collection", async () => {
            const { rateLimiter, firestore, uniqueCollectionName } = mock({});
            await rateLimiter.isQuotaExceeded();

            const collection = await firestore.collection(uniqueCollectionName).get();
            expect(collection.size).to.be.equal(1);
        });

        it("Uses qualifier to identify document in the collection", async () => {
            const { rateLimiter, firestore, uniqueCollectionName, qualifier } = mock({});
            await rateLimiter.isQuotaExceeded(qualifier);

            const doc = await firestore
                .collection(uniqueCollectionName)
                .doc(qualifier)
                .get();

            const record = doc.data() as PersistenceRecord;
            expect(record.usages)
                .to.be.an("array")
                .with.length(1);
        });

        it("Increments counter when limit is not exceeded", async () => {
            const { rateLimiter, firestore, uniqueCollectionName, qualifier } = mock({
                maxCallsPerPeriod: 10,
            });

            const noOfTestCalls = 5;
            for (let i = 0; i < noOfTestCalls; i++) {
                await BluebirdPromise.delay(5);
                await rateLimiter.isQuotaExceeded(qualifier);
            }

            const doc = await firestore
                .collection(uniqueCollectionName)
                .doc(qualifier)
                .get();
            const record = doc.data() as PersistenceRecord;
            expect(record.usages)
                .to.be.an("array")
                .with.length(noOfTestCalls);
        });

        it("Does not increment counter when limit is exceeded", async () => {
            const maxCallsPerPeriod = 5;
            const noOfTestCalls = 10;

            const { rateLimiter, firestore, uniqueCollectionName, qualifier } = mock({
                maxCallsPerPeriod,
            });

            for (let i = 0; i < noOfTestCalls; i++) {
                await BluebirdPromise.delay(5);
                await rateLimiter.isQuotaExceeded(qualifier);
            }

            const doc = await firestore
                .collection(uniqueCollectionName)
                .doc(qualifier)
                .get();
            const record = doc.data() as PersistenceRecord;
            expect(record.usages)
                .to.be.an("array")
                .with.length(maxCallsPerPeriod);
        });

        it("Limit is exceeded if too much calls in specified period", async () => {
            const maxCallsPerPeriod = 5;
            const noOfTestCalls = 10;

            const { rateLimiter, qualifier } = mock({
                maxCallsPerPeriod,
            });

            for (let i = 0; i < noOfTestCalls; i++) {
                await BluebirdPromise.delay(5);
                await rateLimiter.isQuotaExceeded(qualifier);
            }

            expect(await rateLimiter.isQuotaExceeded(qualifier)).to.be.equal(true);
        });

        it("Limit is not exceeded if too much calls not in specified period", async function() {
            this.timeout(3000);

            const maxCallsPerPeriod = 2;
            const periodSeconds = 1;

            const { rateLimiter, qualifier } = mock({
                maxCallsPerPeriod,
                periodSeconds,
            });

            await rateLimiter.isQuotaExceeded(qualifier);
            await BluebirdPromise.delay(periodSeconds * 1000 + 200);
            expect(await rateLimiter.isQuotaExceeded(qualifier)).to.be.equal(false);
        });

        it("Calls older than period are removed from the database", async function() {
            this.timeout(3000);

            const maxCallsPerPeriod = 2;
            const periodSeconds = 1;

            const { rateLimiter, qualifier, uniqueCollectionName, firestore } = mock({
                maxCallsPerPeriod,
                periodSeconds,
            });

            await rateLimiter.isQuotaExceeded(qualifier);
            await BluebirdPromise.delay(periodSeconds * 1000 + 200);
            await rateLimiter.isQuotaExceeded(qualifier);
            await BluebirdPromise.delay(200);

            const doc = await firestore
                .collection(uniqueCollectionName)
                .doc(qualifier)
                .get();
            const record = doc.data() as PersistenceRecord;
            expect(record.usages)
                .to.be.an("array")
                .with.length(1);
        });
    });

    describe("rejectIfQuotaExceededOrRecordCall", () => {
        it("throws functions.https.HttpsException when limit is exceeded", async () => {
            const maxCallsPerPeriod = 1;
            const noOfTestCalls = 2;

            const { rateLimiter, qualifier } = mock({
                maxCallsPerPeriod,
            });

            for (let i = 0; i < noOfTestCalls; i++) {
                await BluebirdPromise.delay(5);
                await rateLimiter.isQuotaExceeded(qualifier);
            }

            expect(rateLimiter.rejectOnQuotaExceeded(qualifier)).to.eventually.be.rejectedWith(
                functions.https.HttpsError,
            );
        });
    });
});
