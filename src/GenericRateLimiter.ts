import ow from "ow";

import { FirebaseFunctionsRateLimiterConfiguration } from "./FirebaseFunctionsRateLimiterConfiguration";
import { PersistenceProvider } from "./persistence/PersistenceProvider";
import { PersistenceRecord } from "./persistence/PersistenceRecord";
import { TimestampProvider } from "./timestamp/TimestampProvider";

export class GenericRateLimiter {
    private configuration: FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull;
    private persistenceProvider: PersistenceProvider;
    private timestampProvider: TimestampProvider;

    public constructor(
        configuration: FirebaseFunctionsRateLimiterConfiguration,
        persistenceProvider: PersistenceProvider,
        timestampProvider: TimestampProvider,
    ) {
        this.configuration = { ...FirebaseFunctionsRateLimiterConfiguration.DEFAULT_CONFIGURATION, ...configuration };
        ow(this.configuration, "configuration", ow.object);
        FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull.validate(this.configuration);

        this.persistenceProvider = persistenceProvider;
        ow(this.persistenceProvider, "persistenceProvider", ow.object);

        this.timestampProvider = timestampProvider;
        ow(this.timestampProvider, "timestampProvider", ow.object);
    }

    public async isQuotaExceededOrRecordCall(qualifier: string): Promise<boolean> {
        const timestampsSeconds = this.getTimestampsSeconds();

        const result = {
            isQuotaExceeded: false,
        };
        await this.persistenceProvider.runTransaction(async () => {
            const record = await this.getRecord(qualifier);
            const recentUsages: number[] = this.selectRecentUsages(record.usages, timestampsSeconds.threshold);

            result.isQuotaExceeded = this.isQuotaExceeded(recentUsages.length);

            if (!result.isQuotaExceeded) {
                recentUsages.push(timestampsSeconds.current);
            }
            const newRecord: PersistenceRecord = {
                usages: recentUsages,
            };

            await this.saveRecord(qualifier, newRecord);
        });
        return result.isQuotaExceeded;
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

    private async getRecord(qualifier: string): Promise<PersistenceRecord> {
        return this.persistenceProvider.getRecord(this.configuration.firebaseCollectionKey, qualifier);
    }

    private async saveRecord(qualifier: string, record: PersistenceRecord): Promise<void> {
        return this.persistenceProvider.saveRecord(this.configuration.firebaseCollectionKey, qualifier, record);
    }
}
