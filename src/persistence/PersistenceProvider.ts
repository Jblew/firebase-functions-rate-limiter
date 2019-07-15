import { PersistenceRecord } from "./PersistenceRecord";

export interface PersistenceProvider {
    runTransaction(asyncTransactionFn: () => Promise<void>): Promise<void>;
    getRecord(collectionName: string, recordName: string): Promise<PersistenceRecord>;
    saveRecord(collectionName: string, recordName: string, record: PersistenceRecord): Promise<void>;
}
