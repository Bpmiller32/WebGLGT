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
import { TransactionResult } from "./types/transactionResult";
import { Parser } from "json2csv";

/* -------------------------------------------------------------------------- */
/*                                    Setup                                   */
/* -------------------------------------------------------------------------- */
const app = express();
const port = 3000;
configureMiddleware(app); // Global middleware setup

/* -------------------------------------------------------------------------- */
/*                                  Requests                                  */
/* -------------------------------------------------------------------------- */

/* -------------------------------- Ping Echo ------------------------------- */
app.get(
  "/pingServer",
  Utils.asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).send("Hello, World!");
  })
);

/* -------------------------- Serve Vision API key -------------------------- */
app.get(
  "/getApiKey",
  requireAuth,
  Utils.asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).send(envVariables.GOOGLE_VISION_API_KEY);
  })
);

/* ------------------------------- Login Route ------------------------------ */
app.post(
  "/login",
  Utils.asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const { userDoc } = await Utils.verifyUserCredentials(username, password);

    // Update lastLoggedInTime
    await userDoc.ref.update({ lastLoggedInTime: new Date() });

    // Create a JWT (6h expiry)
    const token = jwt.sign({ username }, envVariables.JWT_KEY, {
      expiresIn: "6h",
    });

    res.send({ token });
  })
);

/* ------------------------- Check if user is admin ------------------------- */
app.post(
  "/checkAdmin",
  Utils.asyncHandler(async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const { userDoc, userData } = await Utils.verifyUserCredentials(
      username,
      password
    );

    // Update lastLoggedInTime
    await userDoc.ref.update({ lastLoggedInTime: new Date() });

    // Check for admin field set to true
    let isAdmin = false;
    if (userData && userData.isAdmin) {
      isAdmin = true;
    }

    res.send({ isAdmin });
  })
);

/* ---------------------------- Get projects info --------------------------- */
app.get(
  "/projectsInfo",
  Utils.asyncHandler(async (_req: Request, res: Response) => {
    const collections = await db.listCollections();

    // Filter out 'users' and 'siteVisits' from collections returned from Firestore
    const projectCollections = collections
      .map((collection) => collection.id)
      .filter((name) => name !== "users" && name !== "siteVisits");

    res.status(200).json(projectCollections);
  })
);

/* --------------------------- Serve PDF help file -------------------------- */
app.get(
  "/getPdf",
  Utils.asyncHandler(async (_req: Request, res: Response) => {
    // Construct file path
    const pdfFilePath = path.join(envVariables.IMAGES_PATH, "helpFile.pdf");

    // Check if the file exists on disk
    if (!fs.existsSync(pdfFilePath)) {
      return res.status(404).json({ error: "PDF file not found" });
    }

    // Send the file to the client
    res.sendFile(pdfFilePath, (err) => {
      if (err) {
        console.error("Error sending the file:", err);
        res.status(500).json({ error: "Error sending the PDF file" });
      }
    });
  })
);

/* ------------------------------- Next image ------------------------------- */
app.post(
  "/next",
  requireAuth,
  Utils.asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Verify there is a valid user
    const username = req.user?.username;
    if (!username) {
      return res.status(401).send("User not authenticated");
    }

    // Grab project/db name and path to images from request
    const { projectName, directoryPath } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }
    if (!directoryPath || typeof directoryPath !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid or missing directoryPath" });
    }

    // Updates lastAccessedTime for user
    await Utils.updateUserTimestamp(username);

    // Use a Firestore transaction to atomically query
    const dbResult = await db.runTransaction<TransactionResult | null>(
      async (transaction: Transaction) => {
        // Get user that sent request
        const userRef = db.collection("users").doc(username);
        const userDoc = await transaction.get(userRef);
        const userData = userDoc.data() || {
          currentEntryId: null,
          history: [],
        };

        // Push current entry to history if it exists
        const history = userData.history || [];
        if (userData.currentEntryId) {
          history.push(userData.currentEntryId);
        }
        // Keep history array max size of 5
        if (history.length > 5) {
          history.shift();
        }

        const entriesRef = db.collection(projectName);

        // 1) Try to find an unclaimed entry
        let snapshot = await transaction.get(
          entriesRef
            .where("status", "==", "unclaimed")
            .orderBy("createdAt", "asc")
            .limit(1)
        );

        if (!snapshot.empty) {
          const entryDoc = snapshot.docs[0];
          transaction.update(entryDoc.ref, {
            assignedTo: username,
            status: "inProgress",
            claimedAt: new Date(),
          });
          transaction.set(
            userRef,
            { currentEntryId: entryDoc.id, history },
            { merge: true }
          );
          const entryData = entryDoc.data();
          return { id: entryDoc.id, imageName: entryData.imageName };
        }

        // 2) If no unclaimed, find inProgress assigned to this user
        snapshot = await transaction.get(
          entriesRef
            .where("status", "==", "inProgress")
            .where("assignedTo", "==", username)
            .orderBy("createdAt", "asc")
            .limit(10)
        );

        // If no entries are returned from query, exit
        if (snapshot.empty) {
          transaction.set(userRef, { history }, { merge: true });
          return null;
        }

        const candidateDoc = snapshot.docs[0];
        if (!candidateDoc) {
          transaction.set(userRef, { history }, { merge: true });
          return null;
        }

        // Set the candidate entry to the user's profile, return from internal function
        transaction.set(
          userRef,
          { currentEntryId: candidateDoc.id, history },
          { merge: true }
        );

        const entryData = candidateDoc.data();
        return { id: candidateDoc.id, imageName: entryData.imageName };
      }
    );

    if (!dbResult) {
      return res.status(404).send({ message: "No available entries" });
    }

    // Get image from disk, return image to Client
    const imageBlob = await Utils.getImageBlob(
      directoryPath,
      dbResult.imageName
    );

    res.send({ ...dbResult, imageBlob });
  })
);

/* ----------------------------- Previous image ----------------------------- */
app.post(
  "/prev",
  requireAuth,
  Utils.asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Verify there is a valid user
    const username = req.user?.username;
    if (!username) {
      return res.status(401).send("User not authenticated");
    }

    // Grab project/db name and path to images from request
    const { projectName, directoryPath } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }
    if (!directoryPath || typeof directoryPath !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid or missing directoryPath" });
    }

    // Updates lastAccessedTime for user
    await Utils.updateUserTimestamp(username);

    // Use a Firestore transaction to atomically query
    const dbResult = await db.runTransaction<TransactionResult | null>(
      async (transaction: Transaction) => {
        // Get user that sent request
        const userRef = db.collection("users").doc(username);
        const userDoc = await transaction.get(userRef);
        const userData = userDoc.data() || {
          currentEntryId: null,
          history: [],
        };

        // Update history array
        const history = userData.history || [];
        if (history.length === 0) {
          return null;
        }

        // Get the last visited entry
        const prevEntryId = history.pop();
        const entryRef = db.collection(projectName).doc(prevEntryId);
        const entryDoc = await transaction.get(entryRef);

        // Set the candidate entry to the user's profile, return from internal function
        transaction.update(entryRef, {
          assignedTo: username,
          status: "inProgress",
          claimedAt: new Date(),
        });
        transaction.set(
          userRef,
          { currentEntryId: prevEntryId, history },
          { merge: true }
        );

        return { id: prevEntryId, imageName: entryDoc.data()?.imageName };
      }
    );

    if (!dbResult) {
      return res.status(404).send({ message: "No previous entry" });
    }

    // Get image from disk, return image to Client
    const imageBlob = await Utils.getImageBlob(
      directoryPath,
      dbResult.imageName
    );

    res.send({ ...dbResult, imageBlob });
  })
);

/* --------------------------- Update image data ---------------------------- */
app.post(
  "/update",
  requireAuth,
  Utils.asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Verify there is a valid user
    const username = req.user?.username;
    if (!username) {
      return res.status(401).send("User not authenticated");
    }

    // Grab project/db name and update data from request
    const { projectName, updateData } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }
    if (!updateData || typeof updateData !== "object") {
      return res.status(400).json({ error: "Invalid or missing updateData" });
    }

    // Get the user's current entry ID
    const userDoc = await db.collection("users").doc(username).get();
    const currentEntryId = userDoc.data()?.currentEntryId;
    if (!currentEntryId) {
      return res.status(404).json({ error: "No current image selected" });
    }

    // Fetch the image document
    const imageRef = db.collection(projectName).doc(currentEntryId);
    const imageDoc = await imageRef.get();
    if (!imageDoc.exists) {
      return res.status(404).json({ error: "Image document not found" });
    }

    // Append finishedAt timestamp
    updateData.finishedAt = new Date();
    await imageRef.update(updateData);

    res.status(200).json({ message: "Image document updated successfully" });
  })
);

/* -------------------------- Test Protected Route -------------------------- */
app.get(
  "/protected",
  Utils.asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    const token = Utils.extractToken(authHeader);

    jwt.verify(token, envVariables.JWT_KEY, (err, decoded) => {
      if (err || !decoded) {
        return res.status(403).send("Failed to authenticate token");
      }
      res.json({ message: "Welcome to the protected route!", decoded });
    });
  })
);

/* ------------------------- Create a new project db ------------------------ */
app.post(
  "/createImageDatabase",
  requireAuth,
  Utils.asyncHandler(async (req: Request, res: Response) => {
    // Grab project/db name from request
    const { projectName } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }

    // Construct the full path to the image, verify it exists
    const projectPath = path.join(envVariables.IMAGES_PATH, projectName);
    if (!fs.existsSync(envVariables.IMAGES_PATH)) {
      return res.status(404).send({ error: "Image path not found on disk" });
    }

    // Get files from path, filter out only image files
    const imageFiles = await Utils.getImageFiles(projectPath);
    const collectionRef = db.collection(projectName);

    // Check if collection already has at least 1 doc
    const existingDocsSnapshot = await collectionRef.limit(1).get();
    const collectionAlreadyExists = !existingDocsSnapshot.empty;

    // Counts for successful and duplicate entries, useful feedback especially when rerunning a project to add new images
    let entryCount = 0;
    let duplicateCount = 0;

    for (const imageFile of imageFiles) {
      // Check if a document with the same imageName already exists
      const existingDocSnapshot = await collectionRef
        .where("imageName", "==", imageFile)
        .get();

      if (!existingDocSnapshot.empty) {
        duplicateCount++;
        continue;
      }

      // Create a new document
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

    // Only create Firestore index if this is a brand new collection
    if (!collectionAlreadyExists) {
      await Utils.createFirestoreIndex("webglgt", projectName);
    }

    res.status(200).json({
      message: `Images added to database created for project: ${projectName}`,
      entriesAdded: entryCount,
      duplicates: duplicateCount,
      collectionAlreadyExisted: collectionAlreadyExists,
    });
  })
);

/* -------------------------- Export project to CSV ------------------------- */
app.post(
  "/exportToCsv",
  requireAuth,
  Utils.asyncHandler(async (req: Request, res: Response) => {
    // Grab project/db name from request
    const { projectName } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }

    // Reference the Firestore collection, get all documents in the collection, make sure collection has documents to export
    const collectionRef = db.collection(projectName);
    const snapshot = await collectionRef.get();
    if (snapshot.empty) {
      return res.status(404).json({ error: "No documents found" });
    }

    // Convert documents to JSON array
    const documents = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Convert JSON to CSV
    const parser = new Parser();
    const csv = parser.parse(documents);

    // Write CSV
    const outputPath = path.join(
      envVariables.IMAGES_PATH,
      `${projectName}.csv`
    );
    fs.writeFileSync(outputPath, csv);

    res.status(200).json({
      message: "CSV file created successfully",
      outputPath,
    });
  })
);

/* -------------------------- Get stats on project -------------------------- */
app.post(
  "/getProjectStats",
  requireAuth,
  Utils.asyncHandler(async (req: Request, res: Response) => {
    // Grab project/db name from request
    const { projectName } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }

    // Reference the Firestore collection, get all documents in the collection
    const collectionRef = db.collection(projectName);
    const snapshot = await collectionRef.get();

    // Initialize counts
    const totalDocuments = snapshot.size;
    let completedDocuments = 0;
    const userCounts: Record<string, number> = {};

    // Iterate over each document in the collection, count only completed entries that were assigned to a user
    snapshot.forEach((doc) => {
      const data = doc.data();

      if (data.status === "completed") {
        completedDocuments++;

        if (typeof data.assignedTo === "string") {
          userCounts[data.assignedTo] = (userCounts[data.assignedTo] || 0) + 1;
        }
      }
    });

    res.status(200).json({
      message: `Document count for project: ${projectName}`,
      totalDocuments,
      completedDocuments,
      userCounts,
    });
  })
);

/* -------------------------------------------------------------------------- */
/*                              Start the server                              */
/* -------------------------------------------------------------------------- */
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
