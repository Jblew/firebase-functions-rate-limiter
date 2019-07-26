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
        await this.persistenceProvider.updateAndGet(this.configuration.firebaseCollectionKey, qualifier, record => {
            return this.runTransactionForAnswer(record, resultHolder);
        });

        return resultHolder.isQuotaExceeded;
    }

    private runTransactionForAnswer(
        input: PersistenceRecord,
        resultHolder: { isQuotaExceeded: boolean },
    ): PersistenceRecord {
        const timestampsSeconds = this.getTimestampsSeconds();

        this.debugFn("Got record with usages " + input.usages.length);

        const recentUsages: number[] = this.selectRecentUsages(input.usages, timestampsSeconds.threshold);
        this.debugFn("Of these usages there are" + recentUsages.length + " usages that count into period");

        const result = this.isQuotaExceeded(recentUsages.length);
        resultHolder.isQuotaExceeded = result;
        this.debugFn("The result is quotaExceeded=" + result);

        if (!result) {
            this.debugFn("Quota was not exceeded, so recording a usage at " + timestampsSeconds.current);
            recentUsages.push(timestampsSeconds.current);
        }

        const newRecord: PersistenceRecord = {
            usages: recentUsages,
        };
        return newRecord;
    }

    private selectRecentUsages(allUsages: number[], timestampThresholdSeconds: number): number[] {
        const recentUsages: number[] = [];

        for (const usageTime of allUsages) {
            if (usageTime > timestampThresholdSeconds) {
                recentUsages.push(usageTime);
            }
        }
        return recentUsages;
    }

    private isQuotaExceeded(numOfRecentUsages: number): boolean {
        return numOfRecentUsages >= this.configuration.maxCallsPerPeriod;
    }

    private getTimestampsSeconds(): { current: number; threshold: number } {
        const currentServerTimestampSeconds: number = this.timestampProvider.getTimestampSeconds();
        return {
            current: currentServerTimestampSeconds,
            threshold: currentServerTimestampSeconds - this.configuration.periodSeconds,
        };
    }
}
