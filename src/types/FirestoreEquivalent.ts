export interface FirestoreEquivalent {
    runTransaction(tCallback: (transaction: any) => Promise<void>): Promise<void>;

    collection(
        name: string,
    ): {
        doc(name: string): FirestoreEquivalent.DocumentReferenceEquivalent;
    };
}

export namespace FirestoreEquivalent {
    export interface DocumentReferenceEquivalent {
        get(): Promise<{
            exists: boolean;
            data(): object | undefined;
        }>;
        set(record: object): Promise<any>;
    }
}
