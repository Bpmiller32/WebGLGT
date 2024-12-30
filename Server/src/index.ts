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

/* ------------------------- Check if user is admin ------------------------- */
app.post(
  "/checkAdmin",
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

    // Check if user is admin
    let isAdmin = false;
    if (userData?.isAdmin) {
      isAdmin = true;
    }

    // Update the lastLoggedInTime
    await userDoc.ref.update({ lastLoggedInTime: new Date() });

    return res.send({ isAdmin });
  })
);

/* ---------------------------- Get projects info --------------------------- */
app.get(
  "/projectsInfo",
  Utils.asyncHandler(async (req: Request, res: Response) => {
    try {
      // Get all collections
      const collections = await db.listCollections();

      // Filter out 'users' and 'siteVisits' collections and map to collection names
      const projectCollections = collections
        .map((col) => col.id)
        .filter(
          (name) => name !== "users" && name !== "siteVisits"
          //  && name !== "testTjx2"
        );

      res.status(200).json(projectCollections);
    } catch (error: any) {
      console.error("Error in /projectsInfo endpoint:", error);
      res.status(500).json({ error: "Failed to fetch projects information" });
    }
  })
);

/* --------------------------- Serve PDF help file -------------------------- */
app.get("/getPdf", (req: Request, res: Response) => {
  try {
    // Construct the full path to the PDF file
    const pdfFilePath = path.join(envVariables.IMAGES_PATH, "helpFile.pdf");

    // Check if the file exists
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
  } catch (error: any) {
    console.error("Error in /getPdf endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
      const dbResult = await db.runTransaction<TransactionResult | null>(
        async (transaction: Transaction) => {
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
        }
      );

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
      return res
        .status(500)
        .send({ message: "Internal server error", error: error.message });
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
      return res
        .status(500)
        .send({ message: "Internal server error", error: error.message });
    }
  })
);

/* --------------------------- Update image data --------------------------- */
app.post(
  "/update",
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
app.post(
  "/createImageDatabase",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      // Grab project/db name from request
      const { projectName } = req.body;
      if (!projectName || typeof projectName !== "string") {
        return res
          .status(400)
          .json({ error: "Invalid or missing projectName" });
      }

      // Construct the full path to the image
      const imagePath = path.join(envVariables.IMAGES_PATH, projectName);

      // Check if the image path exists on disk
      if (!fs.existsSync(envVariables.IMAGES_PATH)) {
        return res.status(404).send({ error: "Image path not found on disk" });
      }

      // Get files, filter out only image files
      const imageFiles = await Utils.getImageFiles(imagePath);

      // Reference Firestore collection
      const collectionRef = db.collection(projectName);

      // Check if the collection already has documents
      const existingDocsSnapshot = await collectionRef.limit(1).get();
      const collectionAlreadyExists = !existingDocsSnapshot.empty;

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

      // Only create Firestore index if the collection is new
      if (!collectionAlreadyExists) {
        await Utils.createFirestoreIndex("webglgt", projectName);
      }

      return res.status(200).json({
        message: `Images added to database created for project: ${projectName}`,
        entriesAdded: entryCount,
        duplicates: duplicateCount,
        collectionAlreadyExisted: collectionAlreadyExists,
      });
    } catch (error) {
      return res.status(500).send(error);
    }
  }
);

/* -------------------------- Export project to csv ------------------------- */
app.post("/exportToCsv", requireAuth, async (req: Request, res: Response) => {
  try {
    // Get collection name from request
    const { projectName } = req.body;
    if (!projectName || typeof projectName !== "string") {
      return res
        .status(400)
        .json({ error: "Invalid or missing collectionName" });
    }

    // Fetch all documents in the specified collection
    const collectionRef = db.collection(projectName);
    const snapshot = await collectionRef.get();

    if (snapshot.empty) {
      return res
        .status(404)
        .json({ error: "No documents found in the collection" });
    }

    // Map documents to a JSON array
    const documents = snapshot.docs.map((doc) => ({
      id: doc.id, // Include document ID
      ...doc.data(), // Include document fields
    }));

    // Convert JSON to CSV
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(documents);

    // Define output file path
    const outputPath = path.join(
      envVariables.IMAGES_PATH,
      `${projectName}.csv`
    );

    // Write the CSV to a file
    fs.writeFileSync(outputPath, csv);

    return res.status(200).json({
      message: "CSV file created successfully",
      outputPath,
    });
  } catch (error) {
    console.error("Error exporting Firestore data to CSV:", error);
    return res.status(500).json({ error: "Failed to export data to CSV" });
  }
});

/* -------------------------- Get stats on project -------------------------- */
app.post(
  "/getProjectStats",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      // Extract projectName from the request body
      const { projectName } = req.body;
      if (!projectName || typeof projectName !== "string") {
        return res
          .status(400)
          .json({ error: "Invalid or missing projectName" });
      }

      // Reference the Firestore collection
      const collectionRef = db.collection(projectName);

      // Get all documents in the collection
      const snapshot = await collectionRef.get();

      // Initialize counts
      const totalDocuments = snapshot.size;
      let completedDocuments = 0;
      const userCounts: Record<string, number> = {};

      // Iterate over each document in the collection
      snapshot.forEach((doc) => {
        const data = doc.data();

        // Count completed documents
        if (data.status === "completed") {
          completedDocuments++;

          // Tally the "assignedTo" field only if status is "completed"
          if (data.assignedTo && typeof data.assignedTo === "string") {
            userCounts[data.assignedTo] =
              (userCounts[data.assignedTo] || 0) + 1;
          }
        }
      });

      // Send the counts in the response
      return res.status(200).json({
        message: `Document count for project: ${projectName}`,
        totalDocuments,
        completedDocuments,
        userCounts,
      });
    } catch (error) {
      console.error("Error fetching project stats:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  }
);

/* -------------------------------------------------------------------------- */
/*                              Start the server                              */
/* -------------------------------------------------------------------------- */
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
