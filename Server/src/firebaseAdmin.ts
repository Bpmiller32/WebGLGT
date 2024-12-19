import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { envVariables } from "./envConfig";

// Initialize the Admin SDK
initializeApp({
  credential: cert(envVariables.GOOGLECLOUD_SERVICE_ACCOUNT),
});

// Get a Firestore instance
const db = getFirestore();

export { db };
