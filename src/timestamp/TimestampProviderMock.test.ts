import { TimestampProvider } from "./TimestampProvider";

export class TimestampProviderMock implements TimestampProvider {
    private timestampNowMs: number | undefined = undefined;

    public getTimestampMs(): number {
        if (!this.timestampNowMs) return Date.now();
        else return this.timestampNowMs;
    }

    public setTimestampSeconds(timestampSeconds: number) {
        this.timestampNowMs = timestampSeconds * 1000;
    }
}
