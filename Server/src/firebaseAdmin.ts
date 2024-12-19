import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Parse service account from json file
const serviceAccount = JSON.parse(
  readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || "").toString(
    "utf8"
  )
);

// Initialize the Admin SDK
initializeApp({
  credential: cert(serviceAccount),
});

// Get a Firestore instance
const db = getFirestore();

export { db };
