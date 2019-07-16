import ow from "ow";

export interface FirebaseFunctionsRateLimiterConfiguration {
    firebaseCollectionKey?: string;
    periodSeconds?: number;
    maxCallsPerPeriod?: number;
    debug?: boolean;
}

export namespace FirebaseFunctionsRateLimiterConfiguration {
    export interface ConfigurationFull {
        firebaseCollectionKey: string;
        periodSeconds: number;
        maxCallsPerPeriod: number;
        debug: boolean;
    }

    export namespace ConfigurationFull {
        export function validate(o: ConfigurationFull) {
            ow(o.firebaseCollectionKey, "configuration.FirebaseFunctionsRateLimiter", ow.string.nonEmpty);
            ow(o.periodSeconds, "configuration.periodSeconds", ow.number.integer.finite.greaterThan(0));
            ow(o.maxCallsPerPeriod, "configuration.maxCallsPerPeriod", ow.number.integer.finite.greaterThan(0));
            ow(o.debug, "configuration.debug", ow.boolean);
        }
    }

    export const DEFAULT_CONFIGURATION: ConfigurationFull = {
        firebaseCollectionKey: "rate_limiter_1",
        periodSeconds: 5 * 60,
        maxCallsPerPeriod: 1,
        debug: false,
    };
}
