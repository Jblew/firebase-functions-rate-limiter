import ow from "ow";

export interface PersistenceRecord {
    // "u" instead of "usages" to save data transfer
    u: number[];
    expireAt: number|null;
}

export namespace PersistenceRecord {
    export function validate(r: PersistenceRecord) {
        ow(r, "record", ow.object);
        ow(r.u, "record.u", ow.array); // checking item types is a costly operation so we skip it
    }
}
