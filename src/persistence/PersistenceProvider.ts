import { PersistenceRecord } from "./PersistenceRecord";

export interface PersistenceProvider {
    updateAndGet(
        collectionName: string,
        recordName: string,
        updater: (record: PersistenceRecord) => PersistenceRecord,
    ): Promise<PersistenceRecord>;
    get(collectionName: string, recordName: string): Promise<PersistenceRecord>;
    setDebugFn(debugFn: (msg: string) => void): void;
}
