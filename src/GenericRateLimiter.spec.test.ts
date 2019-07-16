/* tslint:disable:max-classes-per-file */
import { expect, use as chaiUse } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import * as _ from "lodash";
import "mocha";
import { SinonSpy, spy } from "sinon";

import { FirebaseFunctionsRateLimiterConfiguration } from "./FirebaseFunctionsRateLimiterConfiguration";
import { GenericRateLimiter } from "./GenericRateLimiter";
import { PersistenceProviderMock } from "./persistence/PersistenceProviderMock.test";
import { TimestampProviderMock } from "./timestamp/TimestampProviderMock.test";

chaiUse(chaiAsPromised);

const sampleConfiguration: FirebaseFunctionsRateLimiterConfiguration.ConfigurationFull = {
    firebaseCollectionKey: "rate_limiter_1",
    periodSeconds: 5 * 60,
    maxCallsPerPeriod: 1,
    debug: false,
};
const sampleQualifier = "samplequalifier";

describe("GenericRateLimiter", () => {
    describe("isQuotaUsed", () => {
        it("Quota is not exceeded on first call when maxCallsPerPeriod=1", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            persistenceProviderMock.persistenceObject = {};
            const genericRateLimiter = new GenericRateLimiter(
                { ...sampleConfiguration, maxCallsPerPeriod: 1 },
                persistenceProviderMock,
                new TimestampProviderMock(),
            );

            expect(await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier)).to.be.equal(false);
        });

        it("Does not fail on empty collection", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            persistenceProviderMock.persistenceObject = {};
            const genericRateLimiter = new GenericRateLimiter(
                sampleConfiguration,
                persistenceProviderMock,
                new TimestampProviderMock(),
            );

            await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);
        });

        it("calls getRecord and saveRecord", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            persistenceProviderMock.getRecord = spy(persistenceProviderMock.getRecord);
            persistenceProviderMock.saveRecord = spy(persistenceProviderMock.saveRecord);
            const genericRateLimiter = new GenericRateLimiter(
                sampleConfiguration,
                persistenceProviderMock,
                new TimestampProviderMock(),
            );

            await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);

            expect((persistenceProviderMock.getRecord as SinonSpy).callCount, "getRecord call count").to.be.equal(1);
            expect((persistenceProviderMock.saveRecord as SinonSpy).callCount, "saveRecord call count").to.be.equal(1);
            expect(
                (persistenceProviderMock.saveRecord as SinonSpy).calledAfter(
                    persistenceProviderMock.getRecord as SinonSpy,
                ),
                "saveRecord called after getRecord",
            ).to.be.equal(true);
        });

        it("puts new current timestamp when quota was not exceeded", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            const timestampProviderMock = new TimestampProviderMock();
            const genericRateLimiter = new GenericRateLimiter(
                sampleConfiguration,
                persistenceProviderMock,
                timestampProviderMock,
            );

            const sampleTimestamp = _.random(10, 5000);
            timestampProviderMock.setTimestampSeconds(sampleTimestamp);

            await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);

            expect(_.values(persistenceProviderMock.persistenceObject)[0].usages).to.contain(sampleTimestamp);
        });

        it("does not put current timestamp when quota was exceeded", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            const timestampProviderMock = new TimestampProviderMock();
            const genericRateLimiter = new GenericRateLimiter(
                { ...sampleConfiguration, maxCallsPerPeriod: 1, periodSeconds: 20 },
                persistenceProviderMock,
                timestampProviderMock,
            );

            const sampleTimestamp = _.random(10, 5000);
            timestampProviderMock.setTimestampSeconds(sampleTimestamp);
            const quotaExceeded1 = await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);
            expect(quotaExceeded1).to.be.equal(false);

            timestampProviderMock.setTimestampSeconds(sampleTimestamp + 1);
            const quotaExceeded2 = await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);
            expect(quotaExceeded2).to.be.equal(true);

            expect(_.values(persistenceProviderMock.persistenceObject)[0].usages)
                .to.be.an("array")
                .with.length(1);
        });

        describe("threshold tests", () => {
            const savedTimestamps: number[] = [];
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();

            before(async () => {
                const timestampProviderMock = new TimestampProviderMock();
                const periodSeconds = 5;
                const maxCallsPerPeriod = 10;
                const genericRateLimiter = new GenericRateLimiter(
                    { ...sampleConfiguration, periodSeconds, maxCallsPerPeriod },
                    persistenceProviderMock,
                    timestampProviderMock,
                );

                let timestamp = _.random(10, 5000);

                for (let i = 0; i < 6; i++) {
                    timestampProviderMock.setTimestampSeconds(timestamp);
                    savedTimestamps.push(timestamp);
                    await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);
                    timestamp += periodSeconds / 3 + 0.1; // remember: never push floats to the edges ;)
                }
            });

            it("saved record does not contain timestamps below threshold", () => {
                expect(_.values(persistenceProviderMock.persistenceObject)[0].usages)
                    .to.be.an("array")
                    .with.length(3)
                    .that.contains(savedTimestamps[savedTimestamps.length - 1])
                    .and.contains(savedTimestamps[savedTimestamps.length - 2])
                    .and.contains(savedTimestamps[savedTimestamps.length - 3]);
            });

            it("saved record contains all timestamps above or equal threshold", () => {
                expect(_.values(persistenceProviderMock.persistenceObject)[0].usages)
                    .to.be.an("array")
                    .with.length(3)
                    .that.does.not.contain(savedTimestamps[0])
                    .and.does.not.contains(savedTimestamps[1])
                    .and.does.not.contains(savedTimestamps[2]);
            });
        });

        it("returns true if there are more calls than maxCalls", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            const timestampProviderMock = new TimestampProviderMock();
            const periodSeconds = 20;
            const maxCallsPerPeriod = 3;
            const genericRateLimiter = new GenericRateLimiter(
                { ...sampleConfiguration, periodSeconds, maxCallsPerPeriod },
                persistenceProviderMock,
                timestampProviderMock,
            );

            let timestamp = _.random(10, 5000);

            for (let i = 0; i < 6; i++) {
                timestampProviderMock.setTimestampSeconds(timestamp);
                await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);
                timestamp += 1;
            }
            expect(await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier)).to.be.equal(true);
        });

        it("returns false if there are exactly maxCalls calls in the period", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            const timestampProviderMock = new TimestampProviderMock();
            const periodSeconds = 20;
            const maxCallsPerPeriod = 3;
            const genericRateLimiter = new GenericRateLimiter(
                { ...sampleConfiguration, periodSeconds, maxCallsPerPeriod },
                persistenceProviderMock,
                timestampProviderMock,
            );

            let timestamp = _.random(10, 5000);

            for (let i = 0; i < 2; i++) {
                timestampProviderMock.setTimestampSeconds(timestamp);
                await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);
                timestamp += 1;
            }
            // the following call is the third, should be passed
            expect(await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier)).to.be.equal(false);
        });

        it("returns false if there are no calls, maxCallsPerPeriod=1 ant this is the first call", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            const timestampProviderMock = new TimestampProviderMock();
            const periodSeconds = 20;
            const maxCallsPerPeriod = 1;
            const genericRateLimiter = new GenericRateLimiter(
                { ...sampleConfiguration, periodSeconds, maxCallsPerPeriod },
                persistenceProviderMock,
                timestampProviderMock,
            );

            const timestamp = _.random(10, 5000);
            timestampProviderMock.setTimestampSeconds(timestamp);
            expect(await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier)).to.be.equal(false);
        });

        it("returns false if there are less calls than maxCalls", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            const timestampProviderMock = new TimestampProviderMock();
            const periodSeconds = 20;
            const maxCallsPerPeriod = 10;
            const genericRateLimiter = new GenericRateLimiter(
                { ...sampleConfiguration, periodSeconds, maxCallsPerPeriod },
                persistenceProviderMock,
                timestampProviderMock,
            );

            let timestamp = _.random(10, 5000);

            for (let i = 0; i < 2; i++) {
                timestampProviderMock.setTimestampSeconds(timestamp);
                await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);
                timestamp += 1;
            }
            // the following call is the third, should be passed
            expect(await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier)).to.be.equal(false);
        });

        it("returns false if exceeding calls are out of the period", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            const timestampProviderMock = new TimestampProviderMock();
            const periodSeconds = 20;
            const maxCallsPerPeriod = 5;
            const genericRateLimiter = new GenericRateLimiter(
                { ...sampleConfiguration, periodSeconds, maxCallsPerPeriod },
                persistenceProviderMock,
                timestampProviderMock,
            );

            let timestamp = _.random(10, 5000);

            for (let i = 0; i < 10; i++) {
                timestampProviderMock.setTimestampSeconds(timestamp);
                await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);
                timestamp += 1;
            }

            timestamp += 30;
            timestampProviderMock.setTimestampSeconds(timestamp);

            expect(await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier)).to.be.equal(false);
        });

        it("updates or reads only single qualifier", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            const timestampProviderMock = new TimestampProviderMock();
            const periodSeconds = 30;
            const maxCallsPerPeriod = 3;
            const genericRateLimiter = new GenericRateLimiter(
                { ...sampleConfiguration, periodSeconds, maxCallsPerPeriod },
                persistenceProviderMock,
                timestampProviderMock,
            );

            let timestamp = _.random(10, 5000);

            for (let i = 0; i < 5; i++) {
                timestampProviderMock.setTimestampSeconds(timestamp);
                await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);
                timestamp += 1;
            }

            timestampProviderMock.setTimestampSeconds(timestamp);
            expect(await genericRateLimiter.isQuotaExceededOrRecordCall("another_qualifier")).to.be.equal(false);
        });

        it("calls saveRecord when quota exceeded but old timestamps decayed", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            const timestampProviderMock = new TimestampProviderMock();
            const periodSeconds = 20;
            const maxCallsPerPeriod = 1;
            const genericRateLimiter = new GenericRateLimiter(
                { ...sampleConfiguration, periodSeconds, maxCallsPerPeriod },
                persistenceProviderMock,
                timestampProviderMock,
            );

            let timestamp = _.random(10, 5000);

            for (let i = 0; i < 5; i++) {
                timestampProviderMock.setTimestampSeconds(timestamp);
                await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);
                timestamp += 1;
            }

            timestamp += 30;
            timestampProviderMock.setTimestampSeconds(timestamp);

            persistenceProviderMock.saveRecord = spy(persistenceProviderMock.saveRecord);
            timestamp += 1;
            timestampProviderMock.setTimestampSeconds(timestamp);
            await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);

            expect((persistenceProviderMock.saveRecord as SinonSpy).callCount, "saveRecord call count").to.be.equal(1);
        });

        it("does not call saveRecord when quota exceeded but old timestamps not decayed", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            const timestampProviderMock = new TimestampProviderMock();
            const periodSeconds = 100;
            const maxCallsPerPeriod = 1;
            const genericRateLimiter = new GenericRateLimiter(
                { ...sampleConfiguration, periodSeconds, maxCallsPerPeriod },
                persistenceProviderMock,
                timestampProviderMock,
            );

            let timestamp = _.random(10, 5000);

            for (let i = 0; i < 5; i++) {
                timestampProviderMock.setTimestampSeconds(timestamp);
                await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);
                timestamp += 1;
            }

            timestamp += 30;
            timestampProviderMock.setTimestampSeconds(timestamp);

            persistenceProviderMock.saveRecord = spy(persistenceProviderMock.saveRecord);
            timestamp += 1;
            timestampProviderMock.setTimestampSeconds(timestamp);
            await genericRateLimiter.isQuotaExceededOrRecordCall(sampleQualifier);

            expect((persistenceProviderMock.saveRecord as SinonSpy).callCount, "saveRecord call count").to.be.equal(0);
        });
    });
});
