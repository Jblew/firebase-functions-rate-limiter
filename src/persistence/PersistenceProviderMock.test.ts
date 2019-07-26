import * as BluebirdPromise from "bluebird";

import { PersistenceProvider } from "./PersistenceProvider";
import { PersistenceRecord } from "./PersistenceRecord";

export class PersistenceProviderMock implements PersistenceProvider {
    public persistenceObject: { [x: string]: PersistenceRecord } = {};

    public async updateAndGet(
        collectionName: string,
        recordName: string,
        updaterFn: (record: PersistenceRecord) => PersistenceRecord,
    ): Promise<PersistenceRecord> {
        let result: PersistenceRecord | undefined;
        await this.runTransaction(async () => {
            const record = await this.getRecord(collectionName, recordName);
            const updatedRecord = updaterFn(record);
            await this.saveRecord(collectionName, recordName, updatedRecord);
            result = updatedRecord;
        });
        if (!result) throw new Error("PersistenceProviderMock: Persistence record could not be updated");
        return result;
    }

    public setDebugFn(debugFn: (msg: string) => void) {
        //
    }

    private async runTransaction(asyncTransactionFn: () => Promise<void>): Promise<void> {
        await asyncTransactionFn();
    }

    private async getRecord(collectionName: string, recordName: string): Promise<PersistenceRecord> {
        await BluebirdPromise.delay(2);
        const key = this.getKey(collectionName, recordName);
        return this.persistenceObject[key] || this.createEmptyRecord();
    }

    private async saveRecord(collectionName: string, recordName: string, record: PersistenceRecord): Promise<void> {
        await BluebirdPromise.delay(2);
        const key = this.getKey(collectionName, recordName);
        this.persistenceObject[key] = record;
    }

    private getKey(collectionName: string, recordName: string): string {
        return collectionName + "_" + recordName;
    }

    private createEmptyRecord(): PersistenceRecord {
        return {
            u: [],
        };
    }
}
