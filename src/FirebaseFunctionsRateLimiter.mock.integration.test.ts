/* tslint:disable:max-classes-per-file no-console */
import * as firebase from "@firebase/testing";
import * as _ from "lodash";
import "mocha";
import * as uuid from "uuid/v4";

import { FirebaseFunctionsRateLimiter } from "./FirebaseFunctionsRateLimiter";
import { FirebaseFunctionsRateLimiterConfiguration } from "./FirebaseFunctionsRateLimiterConfiguration";

export function mock(backend: "firestore" | "realtimedb", configApply: FirebaseFunctionsRateLimiterConfiguration) {
    const app = firebase.initializeTestApp({ projectId: "unit-testing-" + Date.now(), databaseName: "db" });
    const uniqueCollectionName = uuid();
    const uniqueDocName = uuid();
    const qualifier = uuid();
    const firestore = app.firestore();
    const database = app.database();
    async function getDocument(collection: string, doc: string): Promise<any> {
        if (backend === "firestore") {
            return (await firestore
                .collection(collection)
                .doc(doc)
                .get()).data();
        } else return (await database.ref(`${collection}/${doc}`).once("value")).val();
    }
    const config: FirebaseFunctionsRateLimiterConfiguration = {
        name: uniqueCollectionName,
        debug: false,
        ...configApply,
    };
    const rateLimiter =
        backend === "firestore"
            ? FirebaseFunctionsRateLimiter.withFirestoreBackend(config, firestore)
            : FirebaseFunctionsRateLimiter.withRealtimeDbBackend(config, database);
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
