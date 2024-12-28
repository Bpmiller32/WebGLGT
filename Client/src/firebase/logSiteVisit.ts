import { collection, addDoc } from "firebase/firestore";
import { db } from ".";
import axios from "axios";

interface IpifyResponse {
  ip: string;
}

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
  sectionsVisited: string[];
  linksClicked: string[];
  ipAddress: string;
  location: LocationData;
  timestamp: Date;
}

export const logSiteVisit = async () => {
  let ipAddress = "";
  let location = {} as LocationData;

  try {
    const ipResponse = await axios.get<IpifyResponse>(
      "https://api.ipify.org?format=json"
    );
    ipAddress = ipResponse.data.ip;
  } catch {
    // Silently ignore IP fetch errors
  }

  try {
    const locationResponse = await axios.get(
      `https://ipapi.co/${ipAddress}/json/`
    );
    location = locationResponse.data;
  } catch {
    // Silently ignore location fetch errors
  }

  try {
    const siteVisit: SiteVisitDocument = {
      sectionsVisited: [],
      linksClicked: [],
      ipAddress: ipAddress,
      location: location,
      timestamp: new Date(),
    };

    const docRef = await addDoc(collection(db, "siteVisits"), siteVisit);
    return docRef.id;
  } catch {
    // Silently ignore Firestore errors
  }
};
