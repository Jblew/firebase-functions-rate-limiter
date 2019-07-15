import * as admin from "firebase-admin";
import ow from "ow";
import { FirebaseFunctionsRateLimiterConfiguration } from "./FirebaseFunctionsRateLimiterConfiguration";
import { GenericRateLimiter } from "./GenericRateLimiter";
import { FirestorePersistenceProvider } from "./persistence/FirestorePersistenceProviter";
import { FirebaseTimestampProvider } from "./timestamp/FirebaseTimestampProvider";

export class FirebaseFunctionsRateLimiter {
    private genericRateLimiter: GenericRateLimiter;

    public constructor(configuration: FirebaseFunctionsRateLimiterConfiguration, firestore: admin.firestore.Firestore) {
        const configurationFull: FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull = {
            ...FirebaseFunctionsRateLimiterConfiguration.DEFAULT_CONFIGURATION,
            ...configuration,
        };
        ow(configurationFull, "configuration", ow.object);
        FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull.validate(configurationFull);

        ow(firestore, "firestore", ow.object);

        const persistenceProvider = new FirestorePersistenceProvider(firestore);
        const timestampProvider = new FirebaseTimestampProvider();
        this.genericRateLimiter = new GenericRateLimiter(configurationFull, persistenceProvider, timestampProvider);
    }

    public async isQuotaUsed(qualifier: string): Promise<boolean> {
        return await this.genericRateLimiter.isQuotaUsed(qualifier);
    }
}
