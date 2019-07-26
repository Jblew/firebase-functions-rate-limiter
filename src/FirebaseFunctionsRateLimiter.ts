// tslint:disable no-console
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import ow from "ow";

import { FirebaseFunctionsRateLimiterConfiguration } from "./FirebaseFunctionsRateLimiterConfiguration";
import { GenericRateLimiter } from "./GenericRateLimiter";
import { FirestorePersistenceProvider } from "./persistence/FirestorePersistenceProvider";
import { FirebaseTimestampProvider } from "./timestamp/FirebaseTimestampProvider";
import { FirestoreEquivalent } from "./types/FirestoreEquivalent";

export class FirebaseFunctionsRateLimiter {
    private configurationFull: FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull;
    private genericRateLimiter: GenericRateLimiter;
    private debugFn: (msg: string) => void;

    public constructor(
        configuration: FirebaseFunctionsRateLimiterConfiguration,
        firestore: admin.firestore.Firestore | FirestoreEquivalent,
    ) {
        this.configurationFull = {
            ...FirebaseFunctionsRateLimiterConfiguration.DEFAULT_CONFIGURATION,
            ...configuration,
        };
        ow(this.configurationFull, "configuration", ow.object);
        FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull.validate(this.configurationFull);

        ow(firestore, "firestore", ow.object);

        this.debugFn = this.constructDebugFn(this.configurationFull);

        const persistenceProvider = new FirestorePersistenceProvider(firestore);
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
            `FirebaseFunctionsRateLimiter error: Limit of ${c.maxCallsPerPeriod} calls per ` +
            `${c.periodSeconds} seconds exceeded for ${qualifier ? "specified qualifier in " : ""}` +
            `limiter ${c.firebaseCollectionKey}`;
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
