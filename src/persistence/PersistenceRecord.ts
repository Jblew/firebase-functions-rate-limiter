import ow from "ow";

export interface PersistenceRecord {
    usages: number[];
}

export namespace PersistenceRecord {
    export function validate(r: PersistenceRecord) {
        ow(r, "record", ow.object);
        ow(r.usages, "record.usages", ow.array); // checking item types is a costly operation so we skip it
    }
}
