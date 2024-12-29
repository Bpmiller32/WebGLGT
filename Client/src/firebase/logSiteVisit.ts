import { collection, addDoc } from "firebase/firestore";
import { db } from ".";
import axios from "axios";

interface LocationData {
  ip: string;
  city: string;
  region: string;
  country: string;
  loc: string;
  org: string;
  postal: string;
  timezone: string;
}

interface SiteVisitDocument {
  trackedEvents: string[];
  ipAddress: string;
  location: LocationData;
  timestamp: Date;
}

export const logSiteVisit = async () => {
  let ipAddress = "";
  let location = {} as LocationData;

  try {
    const locationResponse = await axios.get(
      `https://ipapi.co/${ipAddress}/json/`
    );
    ipAddress = locationResponse.data.ip;
    location = locationResponse.data;
  } catch {
    // Silently ignore location fetch errors
  }

  try {
    const siteVisit: SiteVisitDocument = {
      trackedEvents: [],
      ipAddress: ipAddress,
      location: location,
      timestamp: new Date(),
    };

    const docRef = await addDoc(collection(db, "siteVisits"), siteVisit);
    return docRef.id;
  } catch {
    // Return something so to simplify typing when using other analytics methods, silently ignore other Firestore errors
    return "";
  }
};
