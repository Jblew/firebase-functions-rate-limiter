import ow from "ow";

import { FirebaseFunctionsRateLimiterConfiguration } from "./FirebaseFunctionsRateLimiterConfiguration";
import { PersistenceProvider } from "./persistence/PersistenceProvider";
import { PersistenceRecord } from "./persistence/PersistenceRecord";
import { TimestampProvider } from "./timestamp/TimestampProvider";

export class GenericRateLimiter {
    private configuration: FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull;
    private persistenceProvider: PersistenceProvider;
    private timestampProvider: TimestampProvider;
    private debugFn: (msg: string) => void;

    public constructor(
        configuration: FirebaseFunctionsRateLimiterConfiguration,
        persistenceProvider: PersistenceProvider,
        timestampProvider: TimestampProvider,
        debugFn: (msg: string) => void = (msg: string) => {
            /* */
        },
    ) {
        this.configuration = { ...FirebaseFunctionsRateLimiterConfiguration.DEFAULT_CONFIGURATION, ...configuration };
        ow(this.configuration, "configuration", ow.object);
        FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull.validate(this.configuration);

        this.persistenceProvider = persistenceProvider;
        ow(this.persistenceProvider, "persistenceProvider", ow.object);

        this.timestampProvider = timestampProvider;
        ow(this.timestampProvider, "timestampProvider", ow.object);

        this.debugFn = debugFn;
    }

    public async isQuotaExceededOrRecordCall(qualifier: string): Promise<boolean> {
        const resultHolder = {
            isQuotaExceeded: false,
        };

        await this.persistenceProvider.updateAndGet(this.configuration.name, qualifier, (record) =>
            this.runTransactionForAnswer(record, resultHolder),
        );

        return resultHolder.isQuotaExceeded;
    }

    public async isQuotaAlreadyExceededDoNotRecordCall(qualifier: string): Promise<boolean> {
        const timestampsMs = this.getTimestampsMs();
        const record = await this.persistenceProvider.get(this.configuration.name, qualifier);
        const recentUsagesMs: number[] = this.selectRecentUsages(record.u, timestampsMs.threshold);
        return this.isQuotaExceeded(recentUsagesMs.length);
    }

    private runTransactionForAnswer(
        input: PersistenceRecord,
        resultHolder: { isQuotaExceeded: boolean },
    ): PersistenceRecord {
        const timestampsMs = this.getTimestampsMs();

        this.debugFn("Got record with usages " + input.u.length);

        const recentUsagesMs: number[] = this.selectRecentUsages(input.u, timestampsMs.threshold);
        this.debugFn("Of these usages there are" + recentUsagesMs.length + " usages that count into period");

        const result = this.isQuotaExceeded(recentUsagesMs.length);
        resultHolder.isQuotaExceeded = result;
        this.debugFn("The result is quotaExceeded=" + result);

        if (!result) {
            this.debugFn("Quota was not exceeded, so recording a usage at " + timestampsMs.current);
            recentUsagesMs.push(timestampsMs.current);
        }

        const newRecord: PersistenceRecord = {
            u: recentUsagesMs,
        };
        return newRecord;
    }

    private selectRecentUsages(allUsageTimestampsMs: number[], timestampThresholdMs: number): number[] {
        const recentUsageTimestampsMs: number[] = [];

        for (const timestampMs of allUsageTimestampsMs) {
            if (timestampMs > timestampThresholdMs) {
                recentUsageTimestampsMs.push(timestampMs);
            }
        }
        return recentUsageTimestampsMs;
    }

    private isQuotaExceeded(numOfRecentUsages: number): boolean {
        return numOfRecentUsages >= this.configuration.maxCalls;
    }

    private getTimestampsMs(): { current: number; threshold: number } {
        const currentServerTimestampMs: number = this.timestampProvider.getTimestampMs();
        return {
            current: currentServerTimestampMs,
            threshold: currentServerTimestampMs - this.configuration.periodSeconds * 1000,
        };
    }
}
