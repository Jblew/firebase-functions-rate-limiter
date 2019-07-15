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
};
const sampleQualifier = "samplequalifier";

describe("GenericRateLimiter", () => {
    describe("isQuotaUsed", () => {
        it("Does not fail on empty collection", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            persistenceProviderMock.persistenceObject = {};
            const genericRateLimiter = new GenericRateLimiter(
                sampleConfiguration,
                persistenceProviderMock,
                new TimestampProviderMock(),
            );

            await genericRateLimiter.isQuotaExceeded(sampleQualifier);
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

            await genericRateLimiter.isQuotaExceeded(sampleQualifier);

            expect((persistenceProviderMock.getRecord as SinonSpy).callCount, "getRecord call count").to.be.equal(1);
            expect((persistenceProviderMock.saveRecord as SinonSpy).callCount, "saveRecord call count").to.be.equal(1);
            expect(
                (persistenceProviderMock.saveRecord as SinonSpy).calledAfter(
                    persistenceProviderMock.getRecord as SinonSpy,
                ),
                "saveRecord called after getRecord",
            ).to.be.equal(true);
        });

        it("saved record contains new current timestamp", async () => {
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();
            const timestampProviderMock = new TimestampProviderMock();
            const genericRateLimiter = new GenericRateLimiter(
                sampleConfiguration,
                persistenceProviderMock,
                timestampProviderMock,
            );

            const sampleTimestamp = _.random(10, 5000);
            timestampProviderMock.setTimestampSeconds(sampleTimestamp);

            await genericRateLimiter.isQuotaExceeded(sampleQualifier);

            expect(_.values(persistenceProviderMock.persistenceObject)[0].usages).to.contain(sampleTimestamp);
        });

        describe("threshold tests", () => {
            const savedTimestamps: number[] = [];
            const persistenceProviderMock: PersistenceProviderMock = new PersistenceProviderMock();

            before(async () => {
                const timestampProviderMock = new TimestampProviderMock();
                const periodSeconds = 5;
                const maxCallsPerPeriod = 1;
                const genericRateLimiter = new GenericRateLimiter(
                    { ...sampleConfiguration, periodSeconds, maxCallsPerPeriod },
                    persistenceProviderMock,
                    timestampProviderMock,
                );

                let timestamp = _.random(10, 5000);

                for (let i = 0; i < 6; i++) {
                    timestampProviderMock.setTimestampSeconds(timestamp);
                    savedTimestamps.push(timestamp);
                    await genericRateLimiter.isQuotaExceeded(sampleQualifier);
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
                await genericRateLimiter.isQuotaExceeded(sampleQualifier);
                timestamp += 1;
            }
            expect(await genericRateLimiter.isQuotaExceeded(sampleQualifier)).to.be.equal(true);
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
                await genericRateLimiter.isQuotaExceeded(sampleQualifier);
                timestamp += 1;
            }
            // the following call is the third, should be passed
            expect(await genericRateLimiter.isQuotaExceeded(sampleQualifier)).to.be.equal(false);
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
            expect(await genericRateLimiter.isQuotaExceeded(sampleQualifier)).to.be.equal(false);
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
                await genericRateLimiter.isQuotaExceeded(sampleQualifier);
                timestamp += 1;
            }
            // the following call is the third, should be passed
            expect(await genericRateLimiter.isQuotaExceeded(sampleQualifier)).to.be.equal(false);
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
                await genericRateLimiter.isQuotaExceeded(sampleQualifier);
                timestamp += 1;
            }

            timestamp += 30;
            timestampProviderMock.setTimestampSeconds(timestamp);

            expect(await genericRateLimiter.isQuotaExceeded(sampleQualifier)).to.be.equal(false);
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
                await genericRateLimiter.isQuotaExceeded(sampleQualifier);
                timestamp += 1;
            }

            timestampProviderMock.setTimestampSeconds(timestamp);
            expect(await genericRateLimiter.isQuotaExceeded("another_qualifier")).to.be.equal(false);
        });
    });
});
