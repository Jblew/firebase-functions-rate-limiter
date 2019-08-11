/* tslint:disable:max-classes-per-file no-console */
import * as firebase from "@firebase/testing";
import * as _ from "lodash";
import "mocha";
import * as uuid from "uuid/v4";

import { FirebaseFunctionsRateLimiter } from "./FirebaseFunctionsRateLimiter";
import { FirebaseFunctionsRateLimiterConfiguration } from "./FirebaseFunctionsRateLimiterConfiguration";
import { PersistenceProviderMock } from "./persistence/PersistenceProviderMock";

export function mock(
    backend: "firestore" | "realtimedb" | "mock",
    configApply: FirebaseFunctionsRateLimiterConfiguration,
) {
    const app = firebase.initializeTestApp({ projectId: "unit-testing-" + Date.now(), databaseName: "db" });
    const uniqueCollectionName = uuid();
    const uniqueDocName = uuid();
    const qualifier = uuid();
    const firestore = app.firestore();
    const database = app.database();
    const persistenceProviderMock = new PersistenceProviderMock();
    async function getDocument(collection: string, doc: string): Promise<any> {
        if (backend === "firestore") {
            return (await firestore
                .collection(collection)
                .doc(doc)
                .get()).data();
        } else if (backend === "realtimedb") {
            return (await database.ref(`${collection}/${doc}`).once("value")).val();
        } else if (backend === "mock") {
            return persistenceProviderMock.getRecord(collection, doc);
        } else throw new Error("Unknown backend " + backend);
    }
    const config: FirebaseFunctionsRateLimiterConfiguration = {
        name: uniqueCollectionName,
        debug: false,
        ...configApply,
    };
    let rateLimiter: FirebaseFunctionsRateLimiter;
    if (backend === "firestore") rateLimiter = FirebaseFunctionsRateLimiter.withFirestoreBackend(config, firestore);
    else if (backend === "realtimedb") {
        rateLimiter = FirebaseFunctionsRateLimiter.withRealtimeDbBackend(config, database);
    } else if (backend === "mock") rateLimiter = FirebaseFunctionsRateLimiter.mock(config, persistenceProviderMock);
    else throw new Error("Unknown backend " + backend);
    return {
        app,
        firestore,
        database,
        uniqueCollectionName,
        uniqueDocName,
        qualifier,
        rateLimiter,
        getDocument,
    };
}
