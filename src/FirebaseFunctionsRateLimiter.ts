// tslint:disable no-console
import * as admin from "firebase-admin";
import * as functions from "firebase-functions";
import ow from "ow";

import { FirebaseFunctionsRateLimiterConfiguration } from "./FirebaseFunctionsRateLimiterConfiguration";
import { GenericRateLimiter } from "./GenericRateLimiter";
import { FirestorePersistenceProvider } from "./persistence/FirestorePersistenceProvider";
import { PersistenceProvider } from "./persistence/PersistenceProvider";
import { PersistenceProviderMock } from "./persistence/PersistenceProviderMock";
import { RealtimeDbPersistenceProvider } from "./persistence/RealtimeDbPersistenceProvider";
import { FirebaseTimestampProvider } from "./timestamp/FirebaseTimestampProvider";
import { FirestoreEquivalent } from "./types/FirestoreEquivalent";
import { RealtimeDbEquivalent } from "./types/RealtimeDbEquivalent";

export class FirebaseFunctionsRateLimiter {
    public static DEFAULT_QUALIFIER = "default_qualifier";

    /*
     * Factories
     */
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

    public static mock(
        configuration?: FirebaseFunctionsRateLimiterConfiguration,
        persistenceProviderMock?: PersistenceProviderMock,
    ): FirebaseFunctionsRateLimiter {
        const defaultConfig: FirebaseFunctionsRateLimiterConfiguration = {
            periodSeconds: 10,
            maxCalls: Number.MAX_SAFE_INTEGER,
        };
        const provider = persistenceProviderMock || new PersistenceProviderMock();
        return new FirebaseFunctionsRateLimiter(configuration || defaultConfig, provider);
    }

    /*
     *  Implementation
     */

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

    /**
     * Checks if quota is exceeded. If not — records usage time in the backend database.
     * The method is deprecated as it was renamed to isQuotaExceededOrRecordUsage
     *
     * @param qualifier — a string that identifies the limited resource accessor (for example the user id)
     * @deprecated
     */
    public async isQuotaExceeded(qualifier?: string): Promise<boolean> {
        return this.isQuotaExceededOrRecordUsage(qualifier);
    }

    /**
     * Checks if quota is exceeded. If not — records usage time in the backend database.
     *
     * @param qualifier — a string that identifies the limited resource accessor (for example the user id)
     * @deprecated
     */
    public async isQuotaExceededOrRecordUsage(qualifier?: string): Promise<boolean> {
        return await this.genericRateLimiter.isQuotaExceededOrRecordCall(
            qualifier || FirebaseFunctionsRateLimiter.DEFAULT_QUALIFIER,
        );
    }

    /**
     * Checks if quota is exceeded. If not — records usage time in the backend database and then
     * is rejected with functions.https.HttpsError (this is the type of error that can be caught when
     * firebase function is called directly: see https://firebase.google.com/docs/functions/callable)
     * The method is deprecated as it was renamed to rejectOnQuotaExceededOrRecordUsage
     *
     * @param qualifier  — a string that identifies the limited resource accessor (for example the user id)
     * @deprecated
     */
    public async rejectOnQuotaExceeded(qualifier?: string): Promise<void> {
        await this.rejectOnQuotaExceededOrRecordUsage(qualifier);
    }

    /**
     * Checks if quota is exceeded. If not — records usage time in the backend database and then
     * is rejected with functions.https.HttpsError (this is the type of error that can be caught when
     * firebase function is called directly: see https://firebase.google.com/docs/functions/callable)
     *
     * @param qualifier  — a string that identifies the limited resource accessor (for example the user id)
     */
    public async rejectOnQuotaExceededOrRecordUsage(qualifier?: string): Promise<void> {
        const isExceeded = await this.genericRateLimiter.isQuotaExceededOrRecordCall(
            qualifier || FirebaseFunctionsRateLimiter.DEFAULT_QUALIFIER,
        );
        if (isExceeded) {
            throw this.constructRejectionError(qualifier);
        }
    }

    /**
     * Checks if quota is exceeded. If not — DOES NOT RECORD USAGE. It only checks if limit was
     * previously exceeded or not.
     * @param qualifier — a string that identifies the limited resource accessor (for example the user id)
     */
    public async isQuotaAlreadyExceeded(qualifier?: string): Promise<boolean> {
        return await this.genericRateLimiter.isQuotaAlreadyExceededDoNotRecordCall(
            qualifier || FirebaseFunctionsRateLimiter.DEFAULT_QUALIFIER,
        );
    }

    /*
     * Private methods
     */
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
