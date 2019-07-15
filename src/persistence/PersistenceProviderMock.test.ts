import * as BluebirdPromise from "bluebird";

import { PersistenceProvider } from "./PersistenceProvider";
import { PersistenceRecord } from "./PersistenceRecord";

export class PersistenceProviderMock implements PersistenceProvider {
    private persistenceObject: string[] = [];

    public async runTransaction(asyncTransactionFn: () => Promise<void>): Promise<void> {
        await asyncTransactionFn();
    }

    public async getRecord(collectionName: string, recordName: string): Promise<PersistenceRecord> {
        await BluebirdPromise.delay(4);
        return this.persistenceObject[collectionName + "_" + recordName] || this.createEmptyRecord();
    }

    public async saveRecord(collectionName: string, recordName: string, record: PersistenceRecord): Promise<void> {
        await BluebirdPromise.delay(4);
        this.persistenceObject[collectionName + "_" + recordName] = record;
    }

    private createEmptyRecord(): PersistenceRecord {
        return {
            usages: [],
        };
    }
}
