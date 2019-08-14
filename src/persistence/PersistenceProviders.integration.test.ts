/* tslint:disable:max-classes-per-file */
import * as firebase from "@firebase/testing";

import { _, expect, sinon, uuid } from "../_test/test_environment";

import { FirestorePersistenceProvider } from "./FirestorePersistenceProvider";
import { PersistenceProvider } from "./PersistenceProvider";
import { PersistenceProviderMock } from "./PersistenceProviderMock";
import { PersistenceRecord } from "./PersistenceRecord";
import { RealtimeDbPersistenceProvider } from "./RealtimeDbPersistenceProvider";

describe("PersistenceProviders", function() {
    this.timeout(4000);

    function mock() {
        const app = firebase.initializeTestApp({ projectId: "unit-testing-" + Date.now(), databaseName: "db" });
        const uniqueCollectionName = uuid();
        const uniqueDocName = uuid();
        const firestore = app.firestore();
        const database = app.database();
        const provider: PersistenceProvider = undefined as any;
        const emptyPersistenceRecord: PersistenceRecord = { u: [] };
        const nonModifyingUpdater = (pr: PersistenceRecord) => pr;
        return {
            app,
            firestore,
            database,
            uniqueCollectionName,
            uniqueDocName,
            provider,
            emptyPersistenceRecord,
            nonModifyingUpdater,
        };
    }

    const mockFirestoreProvider: typeof mock = () => {
        const mockResult = mock();
        const provider = new FirestorePersistenceProvider(mockResult.firestore);
        return { ...mockResult, provider };
    };

    const mockRealtimeProvider: typeof mock = () => {
        const mockResult = mock();
        const provider = new RealtimeDbPersistenceProvider(mockResult.database);
        return { ...mockResult, provider };
    };

    const mockMockProvider: typeof mock = () => {
        const mockResult = mock();
        const provider = new PersistenceProviderMock();
        return { ...mockResult, provider };
    };

    afterEach(async () => {
        await Promise.all(firebase.apps().map(app => app.delete()));
    });

    before("startup", async function() {
        this.timeout(4000);
        const { firestore, database } = mock();
        await firestore
            .collection("a")
            .doc("a")
            .get();
        await database.ref("a").set({ a: "a" });
    });

    [
        { name: "FirestorePersistenceProvider", mockFactory: mockFirestoreProvider },
        { name: "RealtimeDbPersistenceProvider", mockFactory: mockRealtimeProvider },
        { name: "PersistenceProviderMock", mockFactory: mockMockProvider },
    ].forEach(test =>
        describe(test.name, () => {
            describe("#updateAndGet", () => {
                it("Runs transaction code", async () => {
                    const {
                        provider,
                        uniqueCollectionName,
                        uniqueDocName,
                        emptyPersistenceRecord,
                    } = test.mockFactory();
                    const spy = sinon.spy();
                    await provider.updateAndGet(uniqueCollectionName, uniqueDocName, record => {
                        spy();
                        return emptyPersistenceRecord;
                    });
                    expect(spy.callCount).to.be.equal(1);
                });

                it("Resolves when transaction callback is finshed", async () => {
                    const { provider, uniqueCollectionName, uniqueDocName } = test.mockFactory();
                    const spy = sinon.spy();
                    await provider.updateAndGet(uniqueCollectionName, uniqueDocName, record => {
                        spy();
                        return { u: [] };
                    });
                    expect(spy.callCount).to.be.equal(1);
                });

                it("Returns empty record when no data", async () => {
                    const { provider, uniqueCollectionName, uniqueDocName, nonModifyingUpdater } = test.mockFactory();
                    const rec = await provider.updateAndGet(uniqueCollectionName, uniqueDocName, nonModifyingUpdater);
                    expect(rec.u)
                        .to.be.an("array")
                        .with.length(0);
                });

                it("Saves record properly", async () => {
                    const { provider, uniqueCollectionName, uniqueDocName, nonModifyingUpdater } = test.mockFactory();

                    const recToBeSaved: PersistenceRecord = {
                        u: [1, 2, 3],
                    };
                    await provider.updateAndGet(uniqueCollectionName, uniqueDocName, r => recToBeSaved);

                    const recRetrived = await provider.updateAndGet(
                        uniqueCollectionName,
                        uniqueDocName,
                        nonModifyingUpdater,
                    );
                    expect(recRetrived.u)
                        .to.be.an("array")
                        .with.length(recToBeSaved.u.length)
                        .that.have.members(recToBeSaved.u);
                });
            });

            describe("#get", () => {
                it("Returns empty record when no data", async () => {
                    const { provider, uniqueCollectionName, uniqueDocName } = test.mockFactory();
                    const rec = await provider.get(uniqueCollectionName, uniqueDocName);
                    expect(rec.u)
                        .to.be.an("array")
                        .with.length(0);
                });

                it("Returns previously saved record", async () => {
                    const { provider, uniqueCollectionName, uniqueDocName } = test.mockFactory();

                    const recToBeSaved: PersistenceRecord = {
                        u: [1, 2, 3],
                    };
                    await provider.updateAndGet(uniqueCollectionName, uniqueDocName, r => recToBeSaved);

                    const recRetrived = await provider.get(uniqueCollectionName, uniqueDocName);
                    expect(recRetrived.u)
                        .to.be.an("array")
                        .with.length(recToBeSaved.u.length)
                        .that.have.members(recToBeSaved.u);
                });
            });
        }),
    );
});
