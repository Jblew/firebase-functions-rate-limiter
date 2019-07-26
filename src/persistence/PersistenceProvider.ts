import { PersistenceRecord } from "./PersistenceRecord";

export interface PersistenceProvider {
    updateAndGet(
        collectionName: string,
        recordName: string,
        updater: (record: PersistenceRecord) => PersistenceRecord,
    ): Promise<PersistenceRecord>;
}
