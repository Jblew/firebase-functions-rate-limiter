import ow from "ow";

import { RealtimeDbEquivalent } from "../types/RealtimeDbEquivalent";

import { PersistenceProvider } from "./PersistenceProvider";
import { PersistenceRecord } from "./PersistenceRecord";

export class RealtimeDbPersistenceProvider implements PersistenceProvider {
    private database: RealtimeDbEquivalent;

    private debugFn: (msg: string) => void;

    /* istanbul ignore next (debugFn), because typescript injects if for default parameters */
    public constructor(
        database: RealtimeDbEquivalent,
        debugFn: (msg: string) => void = (msg: string) => {
            /* */
        },
    ) {
        this.database = database;
        ow(this.database, "database", ow.object);

        this.debugFn = debugFn;
    }

    public async updateAndGet(
        collectionName: string,
        recordName: string,
        updaterFn: (record: PersistenceRecord) => PersistenceRecord,
    ): Promise<PersistenceRecord> {
        const ref = this.getDatabaseRef(collectionName, recordName);

        const response = await ref.transaction(dataToUpdate => this.wrapUpdaterFn(updaterFn)(dataToUpdate));
        const { snapshot, committed } = response;
        /* istanbul ignore next because this is not testable locally */
        if (!snapshot) throw new Error("RealtimeDbPersistenceProvider: realtime db didn't respond with data");
        /* istanbul ignore next because this is not testable locally */
        if (!committed) throw new Error("RealtimeDbPersistenceProvider: could not save data");

        const data = snapshot.val();
        if (data === null) return this.createEmptyRecord();
        else return data as PersistenceRecord;
    }

    public async get(collectionName: string, recordName: string): Promise<PersistenceRecord> {
        const snapshot = await this.getDatabaseRef(collectionName, recordName).once("value");

        const data = snapshot.val();
        if (data === null) return this.createEmptyRecord();
        else return data as PersistenceRecord;
    }

    public setDebugFn(debugFn: (msg: string) => void) {
        this.debugFn = debugFn;
    }

    private wrapUpdaterFn(updaterFn: (record: PersistenceRecord) => PersistenceRecord): (data: any) => any {
        return (data: any) => {
            this.debugFn("RealtimeDbPersistenceProvider: updateFn called with data of type" + typeof data);
            if (data === null) {
                const emptyRecord = this.createEmptyRecord();
                const updatedPr = updaterFn(emptyRecord);
                return updatedPr;
            } else {
                const updatedPr = updaterFn(data);
                return updatedPr;
            }
        };
    }

    private getDatabaseRef(collectionName: string, recordName: string) {
        const refName = `${collectionName}/${recordName}`;
        return this.database.ref(refName);
    }

    private createEmptyRecord(): PersistenceRecord {
        return {
            u: [],
            expireAt: null
        };
    }
}
