import { updateDoc, arrayUnion, doc } from "firebase/firestore";
import { db } from ".";

export const logTrackedEvent = async (
  sessionId: string,
  trackedEvent: string
) => {
  // Log link click data to Firestore
  try {
    const docRef = doc(db, "siteVisits", sessionId);
    await updateDoc(docRef, {
      trackedEvents: arrayUnion(trackedEvent),
    });
  } catch {
    // Silently ignore Firestore errors
  }
};
