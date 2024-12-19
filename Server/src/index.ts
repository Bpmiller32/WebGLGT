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
app.get("/getApiKey", (req: Request, res: Response) => {
  res.status(200).send(envVariables.GOOGLE_VISION_API_KEY);
});

/* ------------------------------- Login Route ------------------------------ */
app.post("/login", async (req: Request, res: Response) => {
  // Grab password from request
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).send("Missing username or password");
  }

  try {
    // Query Firestore for the user document by username (document ID)
    const usersRef = db.collection("users");
    const userDocRef = usersRef.doc(username);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.status(401).send("Invalid username");
    }

    // Access the password field
    const userData = userDoc.data();
    const userPassword = userData?.password;

    // Check the password, TODO: encrypt and compare with bcrypt once passwords are hashed in FireStore
    if (password !== userPassword) {
      return res.status(401).send("Invalid username or password");
    }

    // Password is valid, update the lastLoggedInTime
    await userDocRef.update({
      lastLoggedInTime: new Date().toISOString(),
    });

    // Password is valid, create a JWT
    const token = jwt.sign(
      { username: username },
      envVariables.JWT_KEY,
      { expiresIn: "1h" } // token expires in 1 hour, adjust as needed
    );

    // Return the token to the client
    return res.send({ token });
  } catch (error) {
    return res.status(500).send("Internal server error");
  }
});

/* ------------------------------- Next image ------------------------------- */
app.get(
  "/next",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    // Grab username from request modified by requireAuth middleware
    const username = req.user?.username;

    if (!username) {
      return res.status(401).send("User not authenticated");
    }

    try {
      // Update the lastAccessedTime field for the user
      const userRef = db.collection("users").doc(username);
      await userRef.update({
        lastAccessedTime: new Date().toISOString(),
      });

      // Look to grab next image in collection
      const dbResult = await db.runTransaction(
        // Use a Firestore transaction to atomically query
        async (transaction: Transaction) => {
          const userDoc = await transaction.get(userRef);
          const userData = userDoc.data() || {
            currentEntryId: null,
            history: [] as string[],
          };

          // Push current entry to history if it exists
          const history = userData.history || [];
          if (userData.currentEntryId) {
            history.push(userData.currentEntryId);
          }

          // Ensure history has no more than 5 entries
          if (history.length > 5) {
            history.shift(); // Remove the oldest entry
          }

          // TODO: grab collection name from body
          const entriesRef = db.collection("test");

          // Query for an unclaimed entry, try to find unclaimed entry first
          let query = entriesRef
            .where("status", "==", "unclaimed")
            .orderBy("createdAt", "asc")
            .limit(1);

          // Run the query, get a snapshot of the db
          let snapshot = await transaction.get(query);

          let entryDoc;
          let entryData;
          let entryRef;

          // No unclaimed entries found
          if (snapshot.empty) {
            // Try finding an inProgress entry assigned to this user
            query = entriesRef
              .where("status", "==", "inProgress")
              .where("assignedTo", "==", username)
              .orderBy("createdAt", "asc")
              // Increase the limit so we can skip the currentEntryId if encountered.
              .limit(10);

            // Run the query, get a snapshot of the db
            snapshot = await transaction.get(query);

            // No available entries (unclaimed or already inProgress for this user)
            if (snapshot.empty) {
              transaction.set(userRef, { history }, { merge: true });
              return null;
            }

            // Find an inProgress entry that isn't the current entry
            const candidateDoc = snapshot.docs.find(
              (doc) => doc.id !== userData.currentEntryId
            );

            // All inProgress entries belong to currentEntryId, no other entry to return
            if (!candidateDoc) {
              transaction.set(userRef, { history }, { merge: true });
              return null;
            }

            // Found a suitable inProgress entry
            entryDoc = candidateDoc;
            entryRef = entryDoc.ref;
            entryData = entryDoc.data();

            // Since it's already inProgress and assigned to this user, we don't need to update the entry. Just set currentEntryId and history.
            transaction.set(
              userRef,
              {
                currentEntryId: entryDoc.id,
                history: history,
              },
              { merge: true }
            );

            // Return the valid db entry, only part to care about on valid is imageName
            return {
              id: entryDoc.id,
              imageName: entryData.imageName,
              assignedTo: username,
              status: "inProgress",
            };
          } else {
            // Unclaimed entry found
            entryDoc = snapshot.docs[0];
            entryRef = entryDoc.ref;
            entryData = entryDoc.data();

            // Double-check status is still unclaimed
            if (entryData.status !== "unclaimed") {
              // If somehow changed, return null
              return null;
            }

            // Assign to the user who made the request
            transaction.update(entryRef, {
              assignedTo: username,
              status: "inProgress",
              claimedAt: new Date(),
            });

            // Update user doc
            transaction.set(
              userRef,
              {
                currentEntryId: entryDoc.id,
                history: history,
              },
              { merge: true }
            );

            // Return the valid db entry, only part to care about on valid is imageName
            return {
              id: entryDoc.id,
              imageName: entryData.imageName,
              assignedTo: username,
              status: "inProgress",
            };
          }
        }
      );

      // No viable images in collection to grab
      if (!dbResult) {
        return res.status(404).send({ message: "No available entries" });
      }

      // Check if Firestore result has an imageName
      if (!dbResult.imageName) {
        return res
          .status(400)
          .send({ error: "Image name is missing in entry" });
      }

      // Construct the full path to the image
      const imagePath = path.join(envVariables.IMAGES_PATH, dbResult.imageName);

      // Check if the image exists on disk
      if (!fs.existsSync(imagePath)) {
        return res.status(404).send({ error: "Image not found on disk" });
      }

      // Read and encode the image as a Base64 string
      const imageBuffer = fs.readFileSync(imagePath);
      const imageBlob = imageBuffer.toString("base64");

      // Spread dbResult, add imageBlob, send the response
      return res.send({
        ...dbResult,
        imageBlob,
      });
    } catch (error: any) {
      // This is a "FAILED_PRECONDITION" error, often related to missing indexes
      if (error.code === 9) {
        return res
          .status(400)
          .send({ error: "Index required or failed precondition" });
      }

      return res.status(500).send({ error: "Internal server error" });
    }
  }
);

/* ----------------------------- Previous image ----------------------------- */
app.get(
  "/previous",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    // Grab username from request modified by requireAuth middleware
    const username = req.user?.username;

    if (!username) {
      return res.status(401).send("User not authenticated");
    }

    try {
      // Update the lastAccessedTime field for the user
      const userRef = db.collection("users").doc(username);
      await userRef.update({
        lastAccessedTime: new Date().toISOString(),
      });

      const dbResult = await db.runTransaction(
        // Use a Firestore transaction to atomically query
        async (transaction: Transaction) => {
          const userDoc = await transaction.get(userRef);
          const userData = userDoc.data()!;
          const history = userData.history || [];

          // Check if history is empty before doing any writes
          if (history.length === 0) {
            return { message: "No previous entry" };
          }

          // Pop the last visited entry from history
          const prevEntryId = history.pop();

          // Fix for bug: get the entryDoc as well before any writes, after this all reads are done and can now write (firestore requirement)
          // TODO: grab collection name from body instead of test
          const entryRef = db.collection("test").doc(prevEntryId);
          const entryDoc = await transaction.get(entryRef);

          // Update user doc
          transaction.set(
            userRef,
            {
              currentEntryId: prevEntryId,
              history: history,
            },
            { merge: true }
          );

          // Reclaim the previous entry for this user
          const entryData = entryDoc.data()!;

          transaction.update(entryRef, {
            assignedTo: username,
            status: "inProgress",
            claimedAt: new Date(),
          });

          transaction.set(
            userRef,
            {
              currentEntryId: prevEntryId,
              history: history,
            },
            { merge: true }
          );

          return {
            id: prevEntryId,
            imageName: entryData.imageName,
            assignedTo: username,
            status: "inProgress",
          };
        }
      );

      // If no previous entry
      if (
        dbResult &&
        "message" in dbResult &&
        dbResult.message === "No previous entry"
      ) {
        return res.status(404).send({ message: "No previous entry" });
      }

      // If previous entry not found
      if (
        dbResult &&
        "message" in dbResult &&
        dbResult.message === "Previous entry not found"
      ) {
        return res.status(404).send(dbResult);
      }

      // Check if we have a valid dbResult with imageName
      if (!dbResult || !("imageName" in dbResult)) {
        return res
          .status(400)
          .send({ error: "Image name is missing in entry" });
      }

      const imageName = dbResult.imageName as string;

      // Construct the full path to the image
      const imagePath = path.join(envVariables.IMAGES_PATH, imageName);

      // Check if the image exists on disk
      if (!fs.existsSync(imagePath)) {
        return res.status(404).send({ error: "Image not found on disk" });
      }

      // Read and encode the image as a Base64 string
      const imageBuffer = fs.readFileSync(imagePath);
      const imageBlob = imageBuffer.toString("base64");

      return res.send({
        ...dbResult,
        imageBlob,
      });
    } catch (error) {
      console.error("Error retrieving previous entry:", error);
      return res.status(500).send({ error: "Internal server error" });
    }
  }
);

/* -------------------------------------------------------------------------- */
/*                               Debug requests                               */
/* -------------------------------------------------------------------------- */

/* -------------------------- Test Protected Route -------------------------- */
app.get("/protected", (req: Request, res: Response) => {
  // Check for header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "No token provided" });
  }

  // Verify the token itself against the JWT_KEY
  const token = authHeader.split(" ")[1];
  jwt.verify(token, envVariables.JWT_KEY, (err, decoded) => {
    if (err || !decoded) {
      return res.status(403).json({ message: "Failed to authenticate token" });
    }

    // Send response with message and token
    return res.json({ message: "Welcome to the protected route!", decoded });
  });
});

/* ------------------------- Create a new project db ------------------------ */
app.post("/createImageDatabase", async (req: Request, res: Response) => {
  // Grab project/db name from request
  const { projectName } = req.body;

  // Check if the image path exists on disk
  if (!fs.existsSync(envVariables.IMAGES_PATH)) {
    return res.status(404).send({ error: "Image path not found on disk" });
  }

  // Get list of files in the directory
  const files = fs.readdirSync(envVariables.IMAGES_PATH);

  // Filter out only image files
  const imageExtensions = [".jpg", ".jpeg", ".png", ".bmp", ".gif"];
  const imageFiles = files.filter((file) =>
    imageExtensions.includes(path.extname(file).toLowerCase())
  );

  // Reference db collection
  const collectionRef = db.collection(projectName);

  let entryCount = 0;
  let duplicateCount = 0;
  let errorCount = 0;
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
    try {
      await collectionRef.add(docData);
      entryCount++;
    } catch (error) {
      errorCount++;
    }
  }

  return res
    .status(200)
    .send(
      `New database created for project: ${projectName}. Entries added: ${entryCount}. Duplicates: ${duplicateCount}. Errors: ${errorCount}`
    );
});

/* -------------------------------------------------------------------------- */
/*                              Start the server                              */
/* -------------------------------------------------------------------------- */
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
