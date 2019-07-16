import * as admin from "firebase-admin";
import ow from "ow";

import { FirestoreEquivalent } from "../FirestoreEquivalent";

import { PersistenceProvider } from "./PersistenceProvider";
import { PersistenceRecord } from "./PersistenceRecord";

export class FirestorePersistenceProvider implements PersistenceProvider {
    private firestore: admin.firestore.Firestore | FirestoreEquivalent;
    private debugFn: (msg: string) => void;

    public constructor(
        firestore: FirestoreEquivalent,
        debugFn: (msg: string) => void = (msg: string) => {
            /* */
        },
    ) {
        this.firestore = firestore;
        ow(this.firestore, "firestore", ow.object);

        this.debugFn = debugFn;
    }

    public async runTransaction(asyncTransactionFn: () => Promise<void>): Promise<void> {
        return await this.firestore.runTransaction(async (transaction: any) => {
            await asyncTransactionFn();
        });
    }

    public async getRecord(collectionName: string, recordName: string): Promise<PersistenceRecord> {
        const docSnapshot = await this.getDocumentRef(collectionName, recordName).get();
        this.debugFn("Got record from collection=" + collectionName + ", document=" + recordName);

        if (!docSnapshot.exists) return this.createEmptyRecord();

        const record: PersistenceRecord = docSnapshot.data() as PersistenceRecord;
        PersistenceRecord.validate(record);
        return record;
    }

    public async saveRecord(collectionName: string, recordName: string, record: PersistenceRecord): Promise<void> {
        this.debugFn("Save record collection=" + collectionName + ", document=" + recordName);
        await this.getDocumentRef(collectionName, recordName).set(record);
    }

    private getDocumentRef(
        collectionName: string,
        recordName: string,
    ): FirestoreEquivalent.DocumentReferenceEquivalent {
        return this.firestore.collection(collectionName).doc(recordName);
    }

    private createEmptyRecord(): PersistenceRecord {
        return {
            usages: [],
        };
    }
}
