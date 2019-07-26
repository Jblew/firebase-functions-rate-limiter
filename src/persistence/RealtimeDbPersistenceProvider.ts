import ow from "ow";

import { RealtimeDbEquivalent } from "../types/RealtimeDbEquivalent";

import { PersistenceProvider } from "./PersistenceProvider";
import { PersistenceRecord } from "./PersistenceRecord";

export class RealtimeDbPersistenceProvider implements PersistenceProvider {
    private database: RealtimeDbEquivalent;

    private debugFn: (msg: string) => void;

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
        const refName = `${collectionName}/${recordName}`;

        const ref = this.database.ref(refName);
        const response = await ref.transaction(dataToUpdate => this.wrapUpdaterFn(updaterFn)(dataToUpdate));
        const { snapshot, committed } = response;
        if (!snapshot) throw new Error("RealtimeDbPersistenceProvider: realtime db didn't respond with data");
        if (!committed) throw new Error("RealtimeDbPersistenceProvider: could not save data");

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

    private createEmptyRecord(): PersistenceRecord {
        return {
            u: [],
        };
    }

    /*
    private persistenceRecordToArray(r: PersistenceRecord): number[] {
        return r.usages;
    }

    private arrayToPersistenceRecord(arr: number[]): PersistenceRecord {
        return {
            usages: arr,
        };
    }*/
}
