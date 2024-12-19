import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./firebaseAdmin";
import { Transaction } from "firebase-admin/firestore";

interface AuthenticatedRequest extends Request {
  user?: {
    username: string;
  };
}

/* -------------------------------------------------------------------------- */
/*                                    Setup                                   */
/* -------------------------------------------------------------------------- */
// Load environment variables
dotenv.config();

// Expressjs fields
const app = express();
const port = 3000;

// Keys
const JWT_KEY = process.env.JWT_KEY;
const GOOGLE_VISION_API_KEY = process.env.GOOGLE_VISION_API_KEY;
if (!JWT_KEY) {
  throw new Error("JWT_KEY is not defined in the environment variables");
}

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Middleware configure CORS
app.use(
  cors({
    origin: ["http://localhost:5173", "https://webglgt.web.app"], // Replace with approved frontend URLs
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

// Middleware authorization
const requireAuth = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  // Check for header
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).send("No authorization header");
  }

  // Check for header value's Bearer prefix
  const headerParts = authHeader.split(" ");
  if (headerParts.length !== 2 || headerParts[0] !== "Bearer") {
    return res.status(401).send("Invalid authorization format");
  }

  // Verify the token itself against the JWT_KEY
  const token = headerParts[1];
  jwt.verify(token, JWT_KEY, (err, decoded) => {
    if (err || !decoded) {
      return res.status(401).send("Invalid token");
    }

    // Check that decoded is an object that contains a key username
    if (typeof decoded === "object" && "username" in decoded) {
      // Attach it to the request and pass the request down the pipline
      req.user = { username: (decoded as any).username };
      return next();
    } else {
      return res.status(401).send("Invalid token payload");
    }
  });
};

/* -------------------------------------------------------------------------- */
/*                                  Requests                                  */
/* -------------------------------------------------------------------------- */

/* --------------------------- Test echo function --------------------------- */
app.get("/pingServer", (req: Request, res: Response) => {
  res.status(200).send("Hello, World!");
});

/* -------------------------- Serve Vision API key -------------------------- */
app.get("/getApiKey", (req: Request, res: Response) => {
  res.status(200).send(GOOGLE_VISION_API_KEY);
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
    const userDoc = await usersRef.doc(username).get();

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

    // Password is valid, create a JWT
    const token = jwt.sign(
      { username: username },
      JWT_KEY,
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
      // Look to grab next image in collection
      const result = await db.runTransaction(
        // Use a Firestore transaction to atomically query
        async (transaction: Transaction) => {
          const userRef = db.collection("users").doc(username);
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

          // Query for an unclaimed entry
          const entriesRef = db.collection("entries");
          const query = entriesRef
            .where("status", "==", "unclaimed")
            .orderBy("createdAt", "asc")
            .limit(1);

          // Run the query, get a snapshot of the db
          const snapshot = await transaction.get(query);

          // No entries available, just update the user doc with no changes to currentEntryId
          if (snapshot.empty) {
            transaction.set(userRef, { history }, { merge: true });
            return null;
          }

          // Entry available, grab first (only, based on limit(1)), check if it is somehow unclaimed
          const doc = snapshot.docs[0];
          const entryRef = doc.ref;
          const entryData = doc.data();

          if (entryData.status !== "unclaimed") {
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
              currentEntryId: doc.id,
              history: history,
            },
            { merge: true }
          );

          return {
            id: doc.id,
            ...entryData,
            assignedTo: username,
            status: "inProgress",
          };
        }
      );

      // No viable images in collection to grab
      if (!result) {
        return res.status(404).send({ message: "No available entries" });
      }

      // Return the db entry
      return res.send(result);
    } catch (error) {
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
  jwt.verify(token, JWT_KEY, (err, decoded) => {
    if (err || !decoded) {
      return res.status(403).json({ message: "Failed to authenticate token" });
    }

    // Send response with message and token
    return res.json({ message: "Welcome to the protected route!", decoded });
  });
});

/* -------------------------------------------------------------------------- */
/*                              Start the server                              */
/* -------------------------------------------------------------------------- */
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
