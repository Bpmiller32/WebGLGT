import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { db } from "./firebaseAdmin";
import { FieldPath, Transaction } from "firebase-admin/firestore";
import path from "path";
import fs from "fs";
import { AuthenticatedRequest } from "./types/authenticatedRequest";
import { configureMiddleware, requireAuth } from "./middleware";
import { envVariables } from "./envConfig";
import { ImageDocument } from "./types/imageDocument";
import Utils from "./utils";
import { TransactionResult } from "./types/transactionResult";
import { Parser } from "json2csv";
import archiver from "archiver";

/* -------------------------------------------------------------------------- */
/*                                    Setup                                   */
/* -------------------------------------------------------------------------- */
const app = express();
const port = 3002;
// const reverseProxySubdomain = "/rafgroundtruth";
const reverseProxySubdomain = "/webglgt";
// const reverseProxySubdomain = "";
configureMiddleware(app); // Global middleware setup

/* -------------------------------------------------------------------------- */
/*                                  Requests                                  */
/* -------------------------------------------------------------------------- */

/* -------------------------------- Ping Echo ------------------------------- */
app.get(
  `${reverseProxySubdomain}/pingServer`,
  Utils.asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).send("Hello, World!");
  })
);

/* -------------------------- Serve Vision API key -------------------------- */
app.get(
  `${reverseProxySubdomain}/getApiKey`,
  requireAuth,
  Utils.asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).send(envVariables.GOOGLE_VISION_API_KEY);
  })
);

/* ------------------------------- Login Route ------------------------------ */
app.post(
  `${reverseProxySubdomain}/login`,
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
  `${reverseProxySubdomain}/checkAdmin`,
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
  `${reverseProxySubdomain}/projectsInfo`,
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
  `${reverseProxySubdomain}/getPdf`,
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

/* ------------------------- Get project images ------------------------- */
app.post(
  `${reverseProxySubdomain}/getProjectImages`,
  requireAuth,
  Utils.asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Verify there is a valid user
    const username = req.user?.username;
    if (!username) {
      return res.status(401).send("User not authenticated");
    }

    // Grab project/db name from request
    const { projectName } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }

    // Reference the Firestore collection
    const collectionRef = db.collection(projectName);
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      return res.status(404).json({ error: "No images found in project" });
    }

    // Map the documents to the required format
    const images = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        name: data.imageName,
        status: data.status || "unclaimed", // Default to unclaimed if status is not set
      };
    });

    res.status(200).json(images);
  })
);

/* ------------------------------- Next image ------------------------------- */
app.post(
  `${reverseProxySubdomain}/next`,
  requireAuth,
  Utils.asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Verify there is a valid user.
    const username = req.user?.username;
    if (!username) {
      return res.status(401).send("User not authenticated");
    }

    // Grab projectName, directoryPath, and skipCurrent flag from request.
    const { projectName, directoryPath, skipCurrent } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }
    if (!directoryPath || typeof directoryPath !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid or missing directoryPath" });
    }
    const shouldSkipCurrent = Boolean(skipCurrent);

    // Update lastAccessedTime for user.
    await Utils.updateUserTimestamp(username);

    // Define a stale threshold (e.g., 5 minutes).
    const STALE_THRESHOLD_MS = 5 * 60 * 1000;
    const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

    // Run a transaction that first performs all reads, then all writes.
    const dbResult = await db.runTransaction<TransactionResult | null>(
      async (transaction: Transaction) => {
        // --- READ PHASE ---
        // 1. Read the user's document.
        const userRef = db.collection("users").doc(username);
        const userSnap = await transaction.get(userRef);
        const userData = userSnap.data() || {
          currentEntryId: null,
          history: [],
        };
        let history: string[] = userData.history || [];

        // Trim history to at most 5 entries.
        if (history.length > 5) {
          history = history.slice(-5);
        }

        // Variable to hold our candidate entry (if any).
        let candidateEntry: FirebaseFirestore.DocumentSnapshot | null = null;

        // 2. Check if there is a current entry.
        if (userData.currentEntryId) {
          if (!shouldSkipCurrent) {
            // Attempt to resume the current entry.
            const currentEntryRef = db
              .collection(projectName)
              .doc(userData.currentEntryId);
            const currentEntrySnap = await transaction.get(currentEntryRef);
            if (
              currentEntrySnap.exists &&
              currentEntrySnap.data()?.status === "inProgress" &&
              currentEntrySnap.data()?.assignedTo === username
            ) {
              candidateEntry = currentEntrySnap;
            } else {
              history.push(userData.currentEntryId);
            }
          } else {
            // If skipping is requested, add the current entry to history.
            history.push(userData.currentEntryId);
          }
        }

        // 3. If no candidate was chosen from the resume step, run candidate queries.
        if (!candidateEntry) {
          // Query 1: Fetch unclaimed entries.
          const queryUnclaimed = db
            .collection(projectName)
            .where("status", "==", "unclaimed")
            .orderBy("createdAt", "asc")
            .limit(1);

          const snapUnclaimed = await transaction.get(queryUnclaimed);
          if (!snapUnclaimed.empty) {
            candidateEntry = snapUnclaimed.docs[0];
          } else {
            // Query 2: Fetch in-progress entries assigned to this user.
            let queryInProgressMine = db
              .collection(projectName)
              .where("status", "==", "inProgress")
              .where("assignedTo", "==", username)
              .orderBy("createdAt", "asc")
              .limit(10);

            if (history.length > 0) {
              queryInProgressMine = queryInProgressMine.where(
                FieldPath.documentId(),
                "not-in",
                history
              );
            }
            const snapInProgressMine = await transaction.get(
              queryInProgressMine
            );
            if (!snapInProgressMine.empty) {
              candidateEntry = snapInProgressMine.docs[0];
            } else {
              // Query 3: Fetch stale entries.
              // Note: We cannot add the "not-in" filter here because it would conflict
              // with the "!=" filter on assignedTo. Instead, we fetch a few candidates and
              // then filter them in memory.
              const queryStale = db
                .collection(projectName)
                .where("status", "==", "inProgress")
                .where("assignedTo", "!=", username)
                .where("claimedAt", "<", staleThreshold)
                .orderBy("claimedAt", "asc")
                .limit(10);
              const snapStale = await transaction.get(queryStale);
              if (!snapStale.empty) {
                // Manually filter out documents that are in the history.
                for (const doc of snapStale.docs) {
                  if (!history.includes(doc.id)) {
                    candidateEntry = doc;
                    break;
                  }
                }
              }
            }
          }
        }

        // --- WRITE PHASE (after all reads) ---
        if (candidateEntry) {
          // Update the candidate entry to mark it as in-progress and assign it to the current user.
          transaction.update(candidateEntry.ref, {
            assignedTo: username,
            status: "inProgress",
            claimedAt: new Date(),
          });
          // Update the user's document: set currentEntryId to the candidate and store the history.
          transaction.set(
            userRef,
            { currentEntryId: candidateEntry.id, history },
            { merge: true }
          );
          const candidateData = candidateEntry.data();
          return { id: candidateEntry.id, imageName: candidateData?.imageName };
        } else {
          // No candidate found: update history and return null.
          transaction.set(userRef, { history }, { merge: true });
          return null;
        }
      }
    );

    // Check if a candidate entry was found.
    if (!dbResult) {
      return res.status(404).send({ message: "No available entries" });
    }

    // Retrieve the image file from disk.
    const imageBlob = await Utils.getImageBlob(
      directoryPath,
      dbResult.imageName
    );

    // Send the entry details and the image blob to the client.
    res.send({ ...dbResult, imageBlob });
  })
);

/* ----------------------------- Previous image ----------------------------- */
app.post(
  `${reverseProxySubdomain}/prev`,
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

    // Get db result - use a Firestore transaction to atomically query
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

        // Check if the document exists
        if (!entryDoc.exists) {
          return null;
        }
        const entryData = entryDoc.data();

        // Helper function to format selection groups
        const formatSelectionGroups = (groups: any) => {
          const formattedGroups: Record<string, any> = {};
          ["group0", "group1", "group2"].forEach((groupKey) => {
            const group = groups[groupKey] || {};
            formattedGroups[groupKey] = {
              text: group.text || "",
              type: group.type || "",
              boxes: Object.values(group.boxes || {}).map((mesh: any) => ({
                id: mesh.id || null,
                position: mesh.position || {},
                size: mesh.size || {},
              })),
            };
          });
          return formattedGroups;
        };

        // Format selection groups
        const selectionGroups = formatSelectionGroups(
          entryData?.selectionGroups || {}
        );

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

        return {
          id: prevEntryId,
          imageName: entryData?.imageName,
          imageType: entryData?.imageType || "mp", // Default to "mp" if not set
          rotation: entryData?.rotation || 0,
          selectionGroups,
        };
      }
    );

    // Check if db result was successful
    if (!dbResult) {
      return res.status(404).send({ message: "No previous entry" });
    }

    // Retrieve the image file from disk
    const imageBlob = await Utils.getImageBlob(
      directoryPath,
      dbResult.imageName
    );

    // Send the entry details and the image blob to the client
    res.send({ ...dbResult, imageBlob });
  })
);

/* ---------------------------- Get image by name ---------------------------- */
app.post(
  `${reverseProxySubdomain}/getByName`,
  requireAuth,
  Utils.asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // Verify there is a valid user
    const username = req.user?.username;
    if (!username) {
      return res.status(401).send("User not authenticated");
    }

    // Grab project/db name, path to images, and imageName from request
    const { projectName, directoryPath, imageName } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res.status(400).json({ error: "Invalid or missing projectName" });
    }
    if (!directoryPath || typeof directoryPath !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid or missing directoryPath" });
    }
    if (!imageName || typeof imageName !== "string") {
      return res.status(400).json({ error: "Invalid or missing imageName" });
    }

    // Updates lastAccessedTime for user
    await Utils.updateUserTimestamp(username);

    // Query Firestore for the document with matching imageName
    const snapshot = await db
      .collection(projectName)
      .where("imageName", "==", imageName)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).send({ message: "Image not found" });
    }

    const entryDoc = snapshot.docs[0];
    const entryData = entryDoc.data();

    // Helper function to format selection groups (same as in prev endpoint)
    const formatSelectionGroups = (groups: any) => {
      const formattedGroups: Record<string, any> = {};
      ["group0", "group1", "group2"].forEach((groupKey) => {
        const group = groups[groupKey] || {};
        formattedGroups[groupKey] = {
          text: group.text || "",
          type: group.type || "",
          boxes: Object.values(group.boxes || {}).map((mesh: any) => ({
            id: mesh.id || null,
            position: mesh.position || {},
            size: mesh.size || {},
          })),
        };
      });
      return formattedGroups;
    };

    // Format selection groups
    const selectionGroups = formatSelectionGroups(
      entryData?.selectionGroups || {}
    );

    // Update the document to mark it as in-progress and assign it to the current user
    await entryDoc.ref.update({
      assignedTo: username,
      status: "inProgress",
      claimedAt: new Date(),
    });

    // Update user's current entry
    await db
      .collection("users")
      .doc(username)
      .set({ currentEntryId: entryDoc.id }, { merge: true });

    // Retrieve the image file from disk
    const imageBlob = await Utils.getImageBlob(directoryPath, imageName);

    // Send the entry details and the image blob to the client
    res.send({
      id: entryDoc.id,
      imageName: entryData.imageName,
      imageType: entryData.imageType || "mp", // Default to "mp" if not set
      rotation: entryData.rotation || 0,
      selectionGroups,
      imageBlob,
    });
  })
);

/* --------------------------- Update image data ---------------------------- */
app.post(
  `${reverseProxySubdomain}/update`,
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
  `${reverseProxySubdomain}/protected`,
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
  `${reverseProxySubdomain}/createImageDatabase`,
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
        rotation: 0,
        timeOnImage: 0,
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

    // Create Firestore indexes if needed
    await Utils.createFirestoreIndex(
      envVariables.GOOGLECLOUD_SERVICE_ACCOUNT.project_id,
      projectName
    );

    res.status(200).json({
      message: `Images added to database created for project: ${projectName}`,
      entriesAdded: entryCount,
      duplicates: duplicateCount,
      collectionAlreadyExisted: collectionAlreadyExists,
    });
  })
);

/* --------------------- Export each document to JSON --------------------- */
app.post(
  `${reverseProxySubdomain}/exportToJson`,
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

    // Prepare directory for JSON files
    const outputDir = path.join(envVariables.IMAGES_PATH, projectName);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Filter out documents where `assignedTo` is null or empty
    const validDocs = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as any),
      }))
      .filter(
        (docData) =>
          docData.assignedTo &&
          docData.assignedTo.trim() !== "" &&
          docData.status !== "unclaimed" &&
          docData.status !== "inProgress"
      );

    // If no valid documents remain, return an error response
    if (validDocs.length === 0) {
      return res.status(404).json({ error: "No valid documents to export" });
    }

    // Export each valid document as a separate JSON file
    validDocs.forEach((docData) => {
      // Use `imageName` as the filename if it exists, otherwise fallback to the document ID
      const imageName =
        docData.imageName && typeof docData.imageName === "string"
          ? docData.imageName
          : docData.id;

      // Remove any file extension from `imageName`
      const nameWithoutExtension = imageName.replace(/\.[^/.]+$/, ""); // Removes file extension

      // Sanitize the filename to prevent issues
      const sanitizedFileName = nameWithoutExtension.replace(
        /[^a-z0-9-_]/gi,
        "_"
      );

      // Define file path for each document
      const filePath = path.join(outputDir, `${sanitizedFileName}.json`);

      // Write document data to JSON file
      fs.writeFileSync(filePath, JSON.stringify(docData, null, 2));
    });

    // Set the response headers to direct streaming of the zip file
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${projectName}.zip"`
    );

    const archive = archiver("zip", { zlib: { level: 9 } });

    // Event handler for error handling
    archive.on("error", (err: any) => {
      console.error("Error creating zip archive:", err);
      return res.status(500).json({ error: "Failed to create zip archive" });
    });

    archive.pipe(res);

    // Create a zip file of the json files in the output directory
    const zipFilePath = path.join(outputDir, `${projectName}.zip`);
    const output = fs.createWriteStream(zipFilePath);

    // Read all files in the `outputDir` directory
    const files = fs
      .readdirSync(outputDir)
      .filter((file) => file.endsWith(".json"));

    // Loop through each JSON file in the directory
    for (const file of files) {
      const filePath = path.join(outputDir, file);
      archive.file(filePath, { name: file });
    }

    // Ensure archive is fully finalized before closing the response
    await archive.finalize();

    // Delete the zip file after sending the response
    res.on("finish", () => {
      fs.unlink(zipFilePath, (err) => {
        if (err) {
          console.error(`Failed to delete zip file: ${zipFilePath}`, err);
        }
      });
    });
  })
);

/* -------------------------- Export project to CSV ------------------------- */
app.post(
  `${reverseProxySubdomain}/exportToCsv`,
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
  `${reverseProxySubdomain}/getProjectStats`,
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
