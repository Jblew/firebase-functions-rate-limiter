import * as admin from "firebase-admin";

import { TimestampProvider } from "./TimestampProvider";

export class FirebaseTimestampProvider implements TimestampProvider {
    public getTimestampSeconds(): number {
        return admin.firestore.Timestamp.now().seconds;
    }
}
