// tslint:disable no-console
import * as admin from "firebase-admin";
import ow from "ow";

import { FirebaseFunctionsRateLimiterConfiguration } from "./FirebaseFunctionsRateLimiterConfiguration";
import { FirestoreEquivalent } from "./FirestoreEquivalent";
import { GenericRateLimiter } from "./GenericRateLimiter";
import { FirestorePersistenceProvider } from "./persistence/FirestorePersistenceProvider";
import { FirebaseTimestampProvider } from "./timestamp/FirebaseTimestampProvider";

export class FirebaseFunctionsRateLimiter {
    private genericRateLimiter: GenericRateLimiter;
    private debugFn: (msg: string) => void;

    public constructor(
        configuration: FirebaseFunctionsRateLimiterConfiguration,
        firestore: admin.firestore.Firestore | FirestoreEquivalent,
    ) {
        const configurationFull: FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull = {
            ...FirebaseFunctionsRateLimiterConfiguration.DEFAULT_CONFIGURATION,
            ...configuration,
        };
        ow(configurationFull, "configuration", ow.object);
        FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull.validate(configurationFull);

        ow(firestore, "firestore", ow.object);

        this.debugFn = this.constructDebugFn(configurationFull);

        const persistenceProvider = new FirestorePersistenceProvider(firestore);
        const timestampProvider = new FirebaseTimestampProvider();
        this.genericRateLimiter = new GenericRateLimiter(
            configurationFull,
            persistenceProvider,
            timestampProvider,
            this.debugFn,
        );
    }

    public async isQuotaExceededOrRecordCall(qualifier?: string): Promise<boolean> {
        return await this.genericRateLimiter.isQuotaExceededOrRecordCall(qualifier || "default_qualifier");
    }

    private constructDebugFn(
        config: FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull,
    ): (msg: string) => void {
        if (config.debug) return (msg: string) => console.log(msg);
        else {
            return (msg: string) => {
                /* */
            };
        }
    }
}
