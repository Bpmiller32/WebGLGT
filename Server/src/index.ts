import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "./firebaseAdmin";
import { Transaction } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";
import { AuthenticatedRequest } from "./types/authenticatedRequest";
import { configureMiddleware, requireAuth } from "./middleware";
import { envVariables } from "./envConfig";
import { ImageDocument } from "./types/imageDocument";
import Utils from "./utils";

interface TransactionResult {
  id: string;
  imageName: string;
}

/* -------------------------------------------------------------------------- */
/*                                    Setup                                   */
/* -------------------------------------------------------------------------- */
// Expressjs fields
const app = express();
const port = 3000;

// Middleware
configureMiddleware(app);

/* -------------------------------------------------------------------------- */
/*                                  Requests                                  */
/* -------------------------------------------------------------------------- */

/* -------------------------------- Ping Echo ------------------------------- */
app.get("/pingServer", (req: Request, res: Response) => {
  res.status(200).send("Hello, World!");
});

/* -------------------------- Serve Vision API key -------------------------- */
app.get("/getApiKey", requireAuth, (req: Request, res: Response) => {
  res.status(200).send(envVariables.GOOGLE_VISION_API_KEY);
});

/* ------------------------------- Login Route ------------------------------ */
app.post(
  "/login",
  Utils.asyncHandler(async (req: Request, res: Response) => {
    // Grab password from request
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).send("Missing username or password");
    }

    // Query Firestore for the user document by username (document ID)
    const userDoc = await db.collection("users").doc(username).get();

    if (!userDoc.exists) {
      return res.status(401).send("Invalid username");
    }

    // Access the password field
    const userData = userDoc.data();
    const userPassword = userData?.password;

    // Check the password, TODO: encrypt and compare with bcrypt once passwords are hashed in FireStore
    if (password !== userPassword) {
      return res.status(401).send("Invalid password");
    }

    // Update the lastLoggedInTime
    await userDoc.ref.update({ lastLoggedInTime: new Date() });

    // Create a JWT
    const token = jwt.sign({ username }, envVariables.JWT_KEY, {
      expiresIn: "6h",
    });

    return res.send({ token });
  })
);

/* ------------------------------- Next image ------------------------------- */
app.post(
  "/next",
  requireAuth,
  Utils.asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Grab username from request modified by requireAuth middleware
    const username = req.user?.username;
    if (!username) {
      return res.status(401).send("User not authenticated");
    }

    // Grab project/db name from request
    const { projectName, directoryPath } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }
    if (!directoryPath || typeof directoryPath !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid or missing directoryPath" });
    }

    // Update the lastAccessedTime field for the user
    const userRef = db.collection("users").doc(username);
    await userRef.update({ lastAccessedTime: new Date() });

    try {
      // Use a Firestore transaction to atomically query
      const dbResult = await db.runTransaction<TransactionResult | null>(async (transaction: Transaction) => {
        // Get user that sent request
        const userDoc = await transaction.get(userRef);
        const userData = userDoc.data() || {
          currentEntryId: null,
          history: [],
        };
        const history = userData.history || [];

        // Push current entry to history if it exists
        if (userData.currentEntryId) {
          history.push(userData.currentEntryId);
        }

        // Ensure history has no more than 5 entries, remove the oldest entry
        if (history.length > 5) {
          history.shift();
        }

        // Grab collection name from body
        const entriesRef = db.collection(projectName);

        // Run the query against snapshot of the db, try to find unclaimed entry first
        let snapshot = await transaction.get(
          entriesRef
            .where("status", "==", "unclaimed")
            .orderBy("createdAt", "asc")
            .limit(1)
        );

        // Unclaimed entry found
        if (!snapshot.empty) {
          const entryDoc = snapshot.docs[0];
          const entryData = entryDoc.data();

          // Update entry status to inProgress and assign to the user
          transaction.update(entryDoc.ref, {
            assignedTo: username,
            status: "inProgress",
            claimedAt: new Date(),
          });

          // Update user
          transaction.set(
            userRef,
            {
              currentEntryId: entryDoc.id,
              history,
            },
            { merge: true }
          );

          return { id: entryDoc.id, imageName: entryData.imageName };
        }

        // No unclaimed entry found, look for an inProgress entry assigned to the user
        snapshot = await transaction.get(
          entriesRef
            .where("status", "==", "inProgress")
            .where("assignedTo", "==", username)
            .orderBy("createdAt", "asc")
            // Increase the limit to ensure a valid entry is found
            .limit(10)
        );

        // Debug logging
        console.log("Found inProgress entries:", snapshot.docs.length);
        console.log("Current entry ID:", userData.currentEntryId);
        snapshot.docs.forEach((doc, i) => {
          console.log(`Entry ${i}:`, { id: doc.id, data: doc.data() });
        });

        // No unclaimed or inProgress entries found, update user and return
        if (snapshot.empty) {
          // Update user
          transaction.set(userRef, { history }, { merge: true });
          return null;
        }

        // Find an inProgress entry that isn't the current entry
        const candidateDoc = snapshot.docs[0]; // Just take the first one for now
        if (!candidateDoc) {
          transaction.set(userRef, { history }, { merge: true });
          return null;
        }

        // Update the user document with the new current entry
        transaction.set(
          userRef,
          {
            currentEntryId: candidateDoc.id,
            history,
          },
          { merge: true }
        );

        const entryData = candidateDoc.data();
        return { id: candidateDoc.id, imageName: entryData.imageName };
      });

      // No viable images in collection to grab
      if (!dbResult) {
        return res.status(404).send({ message: "No available entries" });
      }

      // Construct the full path to the image
      const imagePath = path.join(
        envVariables.IMAGES_PATH,
        directoryPath,
        dbResult.imageName
      );
      // Check if the image exists on disk
      const imageBlob = await Utils.readImageAsBase64(imagePath);

      // Spread dbResult, add imageBlob, send the response
      res.send({ ...dbResult, imageBlob });
    } catch (error: any) {
      console.error("Error in /next endpoint:", error);
      return res.status(500).send({ message: "Internal server error", error: error.message });
    }
  })
);

/* ----------------------------- Previous image ----------------------------- */
app.post(
  "/prev",
  requireAuth,
  Utils.asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Grab username from request modified by requireAuth middleware
    const username = req.user?.username;
    if (!username) {
      return res.status(401).send("User not authenticated");
    }

    // Grab project/db name from request
    const { projectName, directoryPath } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }
    if (!directoryPath || typeof directoryPath !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid or missing directoryPath" });
    }

    // Update the lastAccessedTime field for the user
    const userRef = db.collection("users").doc(username);
    await userRef.update({
      lastAccessedTime: new Date(),
    });

    try {
      // Use a Firestore transaction to atomically query
      const dbResult = await db.runTransaction<TransactionResult | null>(
        async (transaction: Transaction) => {
        // Get user that sent request
        const userDoc = await transaction.get(userRef);
        const userData = userDoc.data() || {
          currentEntryId: null,
          history: [],
        };
        const history = userData.history || [];

        // Check if history is empty before doing any writes
        if (history.length === 0) {
          return null;
        }

        // Pop the last visited entry from history
        const prevEntryId = history.pop();

        // Fix for bug: get the entryDoc as well before any writes, after this all reads are done and can now write (firestore requirement)
        const entryRef = db.collection(projectName).doc(prevEntryId);
        const entryDoc = await transaction.get(entryRef);

        // Update entry
        transaction.update(entryRef, {
          assignedTo: username,
          status: "inProgress",
          claimedAt: new Date(),
        });

        // Update user
        transaction.set(
          userRef,
          { currentEntryId: prevEntryId, history },
          { merge: true }
        );

        return { id: prevEntryId, imageName: entryDoc.data()?.imageName };
      }
    );

      // If no previous entry
      if (!dbResult) {
        return res.status(404).send({ message: "No previous entry" });
      }

      // Construct the full path to the image
      const imagePath = path.join(
        envVariables.IMAGES_PATH,
        directoryPath,
        dbResult.imageName
      );
      // Check if the image exists on disk
      const imageBlob = await Utils.readImageAsBase64(imagePath);

      // Spread dbResult, add imageBlob, send the response
      res.send({ ...dbResult, imageBlob });
    } catch (error: any) {
      console.error("Error in /prev endpoint:", error);
      return res.status(500).send({ message: "Internal server error", error: error.message });
    }
  })
);

/* --------------------------- Update image data --------------------------- */
app.post(
  "/updateImage",
  requireAuth,
  Utils.asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Grab username from request modified by requireAuth middleware
    const username = req.user?.username;
    if (!username) {
      return res.status(401).send("User not authenticated");
    }

    // Grab project name and update data from request
    const { projectName, updateData } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }
    if (!updateData || typeof updateData !== "object") {
      return res.status(400).json({ error: "Invalid or missing updateData" });
    }

    // Get the user's current entry ID
    const userDoc = await db.collection("users").doc(username).get();
    const userData = userDoc.data();
    const currentEntryId = userData?.currentEntryId;

    if (!currentEntryId) {
      return res.status(404).json({ error: "No current image selected" });
    }

    // Fetch the image document
    const imageRef = db.collection(projectName).doc(currentEntryId);
    const imageDoc = await imageRef.get();

    if (!imageDoc.exists) {
      return res.status(404).json({ error: "Image document not found" });
    }

    // Set the finishedAt date here for consistency, node has a different toLocaleString than vite/browser
    updateData.finishedAt = new Date();

    // Update the document with the provided data
    await imageRef.update(updateData);

    return res
      .status(200)
      .json({ message: "Image document updated successfully" });
  })
);

/* -------------------------------------------------------------------------- */
/*                               Debug requests                               */
/* -------------------------------------------------------------------------- */

/* -------------------------- Test Protected Route -------------------------- */
app.get("/protected", (req: Request, res: Response) => {
  try {
    // Check for header
    const authHeader = req.headers.authorization;
    // Verify the token against the JWT_KEY
    const token = Utils.extractToken(authHeader);

    jwt.verify(token, envVariables.JWT_KEY, (err, decoded) => {
      if (err || !decoded) {
        return res.status(403).send("Failed to authenticate token");
      }

      // Send response with message and token
      return res.json({ message: "Welcome to the protected route!", decoded });
    });
  } catch (error) {
    return res.status(401).send(error);
  }
});

/* ------------------------- Create a new project db ------------------------ */
app.post("/createImageDatabase", async (req: Request, res: Response) => {
  try {
    // Grab project/db name from request
    const { projectName, directoryPath } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }
    if (!directoryPath || typeof directoryPath !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid or missing directoryPath" });
    }

    // Construct the full path to the image
    const imagePath = path.join(envVariables.IMAGES_PATH, directoryPath);

    // Check if the image path exists on disk
    if (!fs.existsSync(envVariables.IMAGES_PATH)) {
      return res.status(404).send({ error: "Image path not found on disk" });
    }

    // Get files, filter out only image files
    const imageFiles = await Utils.getImageFiles(imagePath);

    // Reference Firestore collection
    const collectionRef = db.collection(projectName);

    let entryCount = 0;
    let duplicateCount = 0;

    for (const imageFile of imageFiles) {
      // Check if a document with the same imageName already exists
      const existingDocSnapshot = await collectionRef
        .where("imageName", "==", imageFile)
        .get();

      // ImageDocument with the same fileName already exists in the collection, skip
      if (!existingDocSnapshot.empty) {
        duplicateCount++;
        continue;
      }

      // Create a document for each image
      const docData: ImageDocument = {
        imageName: imageFile,
        imageType: "",
        rotation: 0,
        timeOnImage: 0,
        groupText0: "",
        groupCoordinates0: "",
        groupText1: "",
        groupCoordinates1: "",
        groupText2: "",
        groupCoordinates2: "",
        assignedTo: null,
        status: "unclaimed",
        createdAt: new Date(),
        claimedAt: null,
        finishedAt: null,
        project: projectName,
      };

      // Add the document to Firestore
      await collectionRef.add(docData);
      entryCount++;
    }

    // Update and deploy index configuration file through Google Cloud, custom indexes needed for db and firestore cannot make them automatically or programmatically for some reason
    await Utils.createFirestoreIndex("webglgt", projectName);

    return res.status(200).json({
      message: `New database created for project: ${projectName}`,
      entriesAdded: entryCount,
      duplicates: duplicateCount,
    });
  } catch (error) {
    return res.status(500).send(error);
  }
});

/* -------------------------------------------------------------------------- */
/*                              Start the server                              */
/* -------------------------------------------------------------------------- */
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
