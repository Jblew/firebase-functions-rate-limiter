// tslint:disable no-console
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import ow from "ow";

import { FirebaseFunctionsRateLimiterConfiguration } from "./FirebaseFunctionsRateLimiterConfiguration";
import { GenericRateLimiter } from "./GenericRateLimiter";
import { FirestorePersistenceProvider } from "./persistence/FirestorePersistenceProvider";
import { PersistenceProvider } from "./persistence/PersistenceProvider";
import { RealtimeDbPersistenceProvider } from "./persistence/RealtimeDbPersistenceProvider";
import { FirebaseTimestampProvider } from "./timestamp/FirebaseTimestampProvider";
import { FirestoreEquivalent } from "./types/FirestoreEquivalent";
import { RealtimeDbEquivalent } from "./types/RealtimeDbEquivalent";

export class FirebaseFunctionsRateLimiter {
    public static withFirestoreBackend(
        configuration: FirebaseFunctionsRateLimiterConfiguration,
        firestore: admin.firestore.Firestore | FirestoreEquivalent,
    ): FirebaseFunctionsRateLimiter {
        const provider = new FirestorePersistenceProvider(firestore);
        return new FirebaseFunctionsRateLimiter(configuration, provider);
    }

    public static withRealtimeDbBackend(
        configuration: FirebaseFunctionsRateLimiterConfiguration,
        realtimeDb: admin.database.Database | RealtimeDbEquivalent,
    ): FirebaseFunctionsRateLimiter {
        const provider = new RealtimeDbPersistenceProvider(realtimeDb);
        return new FirebaseFunctionsRateLimiter(configuration, provider);
    }

    private configurationFull: FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull;
    private genericRateLimiter: GenericRateLimiter;
    private debugFn: (msg: string) => void;

    private constructor(
        configuration: FirebaseFunctionsRateLimiterConfiguration,
        persistenceProvider: PersistenceProvider,
    ) {
        this.configurationFull = {
            ...FirebaseFunctionsRateLimiterConfiguration.DEFAULT_CONFIGURATION,
            ...configuration,
        };
        ow(this.configurationFull, "configuration", ow.object);
        FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull.validate(this.configurationFull);

        this.debugFn = this.constructDebugFn(this.configurationFull);
        persistenceProvider.setDebugFn(this.debugFn);

        const timestampProvider = new FirebaseTimestampProvider();
        this.genericRateLimiter = new GenericRateLimiter(
            this.configurationFull,
            persistenceProvider,
            timestampProvider,
            this.debugFn,
        );
    }

    public async isQuotaExceeded(qualifier?: string): Promise<boolean> {
        return await this.genericRateLimiter.isQuotaExceededOrRecordCall(qualifier || "default_qualifier");
    }

    public async rejectOnQuotaExceeded(qualifier?: string): Promise<void> {
        const isExceeded = await this.genericRateLimiter.isQuotaExceededOrRecordCall(qualifier || "default_qualifier");
        if (isExceeded) {
            throw this.constructRejectionError(qualifier);
        }
    }

    private constructRejectionError(qualifier?: string): functions.https.HttpsError {
        const c = this.configurationFull;
        const msg =
            `FirebaseFunctionsRateLimiter error: Limit of ${c.maxCalls} calls per ` +
            `${c.periodSeconds} seconds exceeded for ${qualifier ? "specified qualifier in " : ""}` +
            `limiter ${c.name}`;
        return new functions.https.HttpsError("resource-exhausted", msg);
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
