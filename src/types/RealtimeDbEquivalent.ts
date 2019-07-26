export interface RealtimeDbEquivalent {
    ref(path?: string | any | undefined): RealtimeDbEquivalent.Reference;
}

export namespace RealtimeDbEquivalent {
    export interface Reference {
        transaction(
            updateFn: (data: any) => any,
            completeFn?: any,
        ): Promise<{ committed: boolean; snapshot: DataSnapshot | null }>;
    }

    export interface DataSnapshot {
        val(): any;
        exists(): boolean;
    }
}
