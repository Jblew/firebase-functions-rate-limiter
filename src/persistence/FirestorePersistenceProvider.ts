import * as admin from "firebase-admin";
import ow from "ow";

import { PersistenceProvider } from "./PersistenceProvider";
import { PersistenceRecord } from "./PersistenceRecord";

export class FirestorePersistenceProvider implements PersistenceProvider {
    private firestore: admin.firestore.Firestore | FirebasePersistenceProvider.FirestoreEquvalent;

    public constructor(firestore: FirebasePersistenceProvider.FirestoreEquvalent) {
        this.firestore = firestore;
        ow(this.firestore, "firestore", ow.object);
    }

    public async runTransaction(asyncTransactionFn: () => Promise<void>): Promise<void> {
        return await this.firestore.runTransaction(async (transaction: any) => {
            await asyncTransactionFn();
        });
    }

    public async getRecord(collectionName: string, recordName: string): Promise<PersistenceRecord> {
        const docSnapshot = await this.getDocumentRef(collectionName, recordName).get();

        if (!docSnapshot.exists) return this.createEmptyRecord();

        const record: PersistenceRecord = docSnapshot.data() as PersistenceRecord;
        PersistenceRecord.validate(record);
        return record;
    }

    public async saveRecord(collectionName: string, recordName: string, record: PersistenceRecord): Promise<void> {
        await this.getDocumentRef(collectionName, recordName).set(record);
    }

    private getDocumentRef(
        collectionName: string,
        recordName: string,
    ): FirebasePersistenceProvider.DocumentReferenceEquivalent {
        return this.firestore.collection(collectionName).doc(recordName);
    }

    private createEmptyRecord(): PersistenceRecord {
        return {
            usages: [],
        };
    }
}

export namespace FirebasePersistenceProvider {
    export interface FirestoreEquvalent {
        runTransaction(tCallback: (transaction: any) => Promise<void>): Promise<void>;

        collection(
            name: string,
        ): {
            doc(name: string): DocumentReferenceEquivalent;
        };
    }

    export interface DocumentReferenceEquivalent {
        get(): Promise<{
            exists: boolean;
            data(): object | undefined;
        }>;
        set(record: object): Promise<any>;
    }
}
