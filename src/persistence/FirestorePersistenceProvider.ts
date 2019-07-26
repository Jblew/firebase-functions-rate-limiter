import * as admin from "firebase-admin";
import ow from "ow";

import { FirestoreEquivalent } from "../types/FirestoreEquivalent";

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

    public async updateAndGet(
        collectionName: string,
        recordName: string,
        updaterFn: (record: PersistenceRecord) => PersistenceRecord,
    ): Promise<PersistenceRecord> {
        let result: PersistenceRecord | undefined;
        await this.runTransaction(async () => {
            const record = await this.getRecord(collectionName, recordName);
            const updatedRecord = updaterFn(record);
            if (this.hasRecordChanged(record, updatedRecord)) {
                await this.saveRecord(collectionName, recordName, updatedRecord);
            }
            result = updatedRecord;
        });
        if (!result) throw new Error("FirestorePersistenceProvider: Persistence record could not be updated");
        return result;
    }

    public setDebugFn(debugFn: (msg: string) => void) {
        this.debugFn = debugFn;
    }

    private async runTransaction(asyncTransactionFn: () => Promise<void>): Promise<void> {
        return await this.firestore.runTransaction(async (transaction: any) => {
            await asyncTransactionFn();
        });
    }

    private async getRecord(collectionName: string, recordName: string): Promise<PersistenceRecord> {
        const docSnapshot = await this.getDocumentRef(collectionName, recordName).get();
        this.debugFn("Got record from collection=" + collectionName + ", document=" + recordName);

        if (!docSnapshot.exists) return this.createEmptyRecord();

        const record: PersistenceRecord = docSnapshot.data() as PersistenceRecord;
        PersistenceRecord.validate(record);
        return record;
    }

    private async saveRecord(collectionName: string, recordName: string, record: PersistenceRecord): Promise<void> {
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
            u: [],
        };
    }

    private hasRecordChanged(oldRecord: PersistenceRecord, newRecord: PersistenceRecord): boolean {
        if (oldRecord.u.length !== newRecord.u.length) {
            return true;
        } else {
            const a1 = oldRecord.u.concat().sort();
            const a2 = newRecord.u.concat().sort();
            for (let i = 0; i < a1.length; i++) {
                if (a1[i] !== a2[i]) return true;
            }
            return false;
        }
    }
}
