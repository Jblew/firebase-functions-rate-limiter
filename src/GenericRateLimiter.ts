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
        const result = {
            isQuotaExceeded: false,
        };
        await this.persistenceProvider.runTransaction(async () => {
            result.isQuotaExceeded = await this.firebaseCheckInTransaction(qualifier);
        });
        return result.isQuotaExceeded;
    }

    private async firebaseCheckInTransaction(qualifier: string): Promise<boolean> {
        const timestampsSeconds = this.getTimestampsSeconds();

        this.debugFn("Loading persistence record for qualifier '" + qualifier + "' at " + timestampsSeconds.current);

        const record = await this.getRecord(qualifier);
        this.debugFn("Got record with usages " + record.usages.length);

        const recentUsages: number[] = this.selectRecentUsages(record.usages, timestampsSeconds.threshold);
        this.debugFn("Of these usages there are" + recentUsages.length + " usages that count into period");

        const result = this.isQuotaExceeded(recentUsages.length);
        this.debugFn("The result is quotaExceeded=" + result);

        if (!result) {
            this.debugFn("Quota was not exceeded, so recording a usage at " + timestampsSeconds.current);
            recentUsages.push(timestampsSeconds.current);
        }

        const newRecord: PersistenceRecord = {
            usages: recentUsages,
        };
        if (this.hasRecordChanged(record, newRecord)) {
            this.debugFn("Record has changed. Saving");
            await this.saveRecord(qualifier, newRecord);
        } else {
            this.debugFn("Record has not hanged. No need to save");
        }
        return result;
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

    private hasRecordChanged(oldRecord: PersistenceRecord, newRecord: PersistenceRecord): boolean {
        if (oldRecord.usages.length !== newRecord.usages.length) {
            return true;
        } else {
            const a1 = oldRecord.usages.concat().sort();
            const a2 = newRecord.usages.concat().sort();
            for (let i = 0; i < a1.length; i++) {
                if (a1[i] !== a2[i]) return true;
            }
            return false;
        }
    }

    private async getRecord(qualifier: string): Promise<PersistenceRecord> {
        return this.persistenceProvider.getRecord(this.configuration.firebaseCollectionKey, qualifier);
    }

    private async saveRecord(qualifier: string, record: PersistenceRecord): Promise<void> {
        return this.persistenceProvider.saveRecord(this.configuration.firebaseCollectionKey, qualifier, record);
    }
}
