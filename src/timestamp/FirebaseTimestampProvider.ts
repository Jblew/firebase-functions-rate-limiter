import { Timestamp } from 'firebase-admin/firestore';

import { TimestampProvider } from "./TimestampProvider";

export class FirebaseTimestampProvider implements TimestampProvider {
    public getTimestampSeconds(): number {
        return Timestamp.now().seconds;
    }
}
