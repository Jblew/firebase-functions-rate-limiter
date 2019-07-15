import * as BluebirdPromise from "bluebird";

import { PersistenceProvider } from "./PersistenceProvider";
import { PersistenceRecord } from "./PersistenceRecord";

export class PersistenceProviderMock implements PersistenceProvider {
    public persistenceObject: { [x: string]: PersistenceRecord } = {};

    public async runTransaction(asyncTransactionFn: () => Promise<void>): Promise<void> {
        await asyncTransactionFn();
    }

    public async getRecord(collectionName: string, recordName: string): Promise<PersistenceRecord> {
        await BluebirdPromise.delay(2);
        const key = this.getKey(collectionName, recordName);
        return this.persistenceObject[key] || this.createEmptyRecord();
    }

    public async saveRecord(collectionName: string, recordName: string, record: PersistenceRecord): Promise<void> {
        await BluebirdPromise.delay(2);
        const key = this.getKey(collectionName, recordName);
        this.persistenceObject[key] = record;
    }

    private getKey(collectionName: string, recordName: string): string {
        return collectionName + "_" + recordName;
    }

    private createEmptyRecord(): PersistenceRecord {
        return {
            usages: [],
        };
    }
}
