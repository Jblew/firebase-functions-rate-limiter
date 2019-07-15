import { TimestampProvider } from "./TimestampProvider";

export class TimestampProviderMock implements TimestampProvider {
    private timestampNowSeconds: number | undefined = undefined;

    public getTimestampSeconds(): number {
        if (!this.timestampNowSeconds) return Date.now() / 1000;
        else return this.timestampNowSeconds;
    }

    public setTimestampSeconds(timestampSeconds: number) {
        this.timestampNowSeconds = timestampSeconds;
    }
}
