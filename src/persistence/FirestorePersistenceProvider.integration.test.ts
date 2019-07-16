/* tslint:disable:max-classes-per-file */
import * as firebase from "@firebase/testing";
import { expect, use as chaiUse } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as BluebirdPromise from "bluebird";
import * as _ from "lodash";
import "mocha";
import * as sinon from "sinon";
import * as uuid from "uuid/v4";

import { FirestorePersistenceProvider } from "./FirestorePersistenceProvider";
import { PersistenceRecord } from "./PersistenceRecord";
chaiUse(chaiAsPromised);

function mock() {
    const app = firebase.initializeTestApp({ projectId: "unit-testing-" + Date.now() });
    const uniqueCollectionName = uuid();
    const uniqueDocName = uuid();
    const firestore = app.firestore();
    return {
        app,
        firestore,
        uniqueCollectionName,
        uniqueDocName,
    };
}

afterEach(async () => {
    await Promise.all(firebase.apps().map(app => app.delete()));
});

describe("FirestorePersistenceProvider", () => {
    describe("runTransaction", () => {
        it("Runs transaction code", async () => {
            const { firestore } = mock();
            const provider = new FirestorePersistenceProvider(firestore);
            const spy = sinon.spy();
            await provider.runTransaction(async () => {
                spy();
            });
            expect(spy.callCount).to.be.equal(1);
        });

        it("Resolves when transaction callback is finshed", async () => {
            const { firestore } = mock();
            const provider = new FirestorePersistenceProvider(firestore);
            const spy = sinon.spy();
            await provider.runTransaction(async () => {
                spy();
            });
            expect(spy.callCount).to.be.equal(1);
        });
    });

    describe("getRecord", () => {
        it("Returns empty record when no data", async () => {
            const { firestore, uniqueCollectionName, uniqueDocName } = mock();
            const provider = new FirestorePersistenceProvider(firestore);
            const rec = await provider.getRecord(uniqueCollectionName, uniqueDocName);
            expect(rec.usages)
                .to.be.an("array")
                .with.length(0);
        });
    });

    describe("saveRecord", () => {
        it("Returns empty record when no data", async () => {
            const { firestore, uniqueCollectionName, uniqueDocName } = mock();
            const provider = new FirestorePersistenceProvider(firestore);

            const recToBeSaved: PersistenceRecord = {
                usages: [1, 2, 3],
            };
            await provider.saveRecord(uniqueCollectionName, uniqueDocName, recToBeSaved);

            const recRetrived = await provider.getRecord(uniqueCollectionName, uniqueDocName);
            expect(recRetrived.usages)
                .to.be.an("array")
                .with.length(recToBeSaved.usages.length)
                .that.have.members(recToBeSaved.usages);
        });
    });
});
