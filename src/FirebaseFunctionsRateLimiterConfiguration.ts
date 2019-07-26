import ow from "ow";

export interface FirebaseFunctionsRateLimiterConfiguration {
    name?: string;
    periodSeconds?: number;
    maxCalls?: number;
    debug?: boolean;
}

export namespace FirebaseFunctionsRateLimiterConfiguration {
    export interface ConfigurationFull extends FirebaseFunctionsRateLimiterConfiguration {
        name: string;
        periodSeconds: number;
        maxCalls: number;
        debug: boolean;
    }

    export namespace ConfigurationFull {
        export function validate(o: ConfigurationFull & FirebaseFunctionsRateLimiterConfiguration) {
            ow(o.name, "configuration.name", ow.string.nonEmpty);
            ow(o.periodSeconds, "configuration.periodSeconds", ow.number.integer.finite.greaterThan(0));
            ow(o.maxCalls, "configuration.maxCalls", ow.number.integer.finite.greaterThan(0));
            ow(o.debug, "configuration.debug", ow.boolean);
        }
    }

    export const DEFAULT_CONFIGURATION: ConfigurationFull = {
        name: "rlimit",
        periodSeconds: 5 * 60,
        maxCalls: 5,
        debug: false,
    };
}
