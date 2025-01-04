import { Request, Response, NextFunction } from "express";
import fs from "fs/promises";
import path from "path";
import { google } from "googleapis";
import { envVariables } from "./envConfig";
import { db } from "./firebaseAdmin";

export default class Utils {
  // Reads and validates the presence of an image file, returns its Base64 encoded string.
  public static readImageAsBase64 = async (imagePath: string) => {
    try {
      // Directly specify base64 encoding
      return await fs.readFile(imagePath, { encoding: "base64" });
    } catch (error) {
      throw new Error(`Image not found or unreadable at path: ${imagePath}`);
    }
  };

  // Neat error handler for async routes in express.
  public static asyncHandler =
    (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
    (req: Request, res: Response, next: NextFunction) =>
      fn(req, res, next).catch(next);

  // Checks the presence of an authorization header and returns the token.
  public static extractToken = (authHeader: string | undefined) => {
    if (!authHeader) {
      throw new Error("No token provided");
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2) {
      throw new Error("Invalid authorization format");
    }

    const token = parts[1];
    if (!token) {
      throw new Error("No token found in authorization header");
    }

    return token;
  };

  // Filters image files from the specified directory.
  public static getImageFiles = async (directoryPath: string) => {
    try {
      const files = await fs.readdir(directoryPath);
      const imageExtensions = [".jpg", ".jpeg", ".png", ".bmp", ".gif"];

      return files.filter((file) =>
        imageExtensions.includes(path.extname(file).toLowerCase())
      );
    } catch (error) {
      throw new Error(`Failed to read image directory: ${directoryPath}`);
    }
  };

  // Creates nessasary indicies for db, or at least tries to....
  public static createFirestoreIndex = async (
    projectId: string,
    collectionId: string
  ) => {
    // Create a custom JWT auth client
    const authClient = new google.auth.JWT({
      email: envVariables.GOOGLECLOUD_SERVICE_ACCOUNT.client_email,
      key: envVariables.GOOGLECLOUD_SERVICE_ACCOUNT.private_key,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    // Grab service account's Firestore
    const firestore = google.firestore({
      version: "v1",
      auth: authClient,
    });

    // Define collection to add indexes to, custom indexes config
    const collection = `projects/${projectId}/databases/(default)/collectionGroups/${collectionId}`;
    const indexConfigOriginal = {
      fields: [
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "createdAt", order: "ASCENDING" },
        { fieldPath: "__name__", order: "ASCENDING" },
      ],
    };
    const indexConfigEndOfDeck = {
      fields: [
        { fieldPath: "assignedTo", order: "ASCENDING" },
        { fieldPath: "status", order: "ASCENDING" },
        { fieldPath: "createdAt", order: "ASCENDING" },
        { fieldPath: "__name__", order: "ASCENDING" },
      ],
    };

    try {
      // Create the indexes, for whatever annoying reason Firestore needs two....
      await firestore.projects.databases.collectionGroups.indexes.create({
        parent: collection,
        requestBody: {
          fields: indexConfigOriginal.fields,
          queryScope: "COLLECTION",
        },
      });

      await firestore.projects.databases.collectionGroups.indexes.create({
        parent: collection,
        requestBody: {
          fields: indexConfigEndOfDeck.fields,
          queryScope: "COLLECTION",
        },
      });
    } catch (error) {
      throw new Error(`Failed to create Firestore index: ${error}`);
    }
  };

  // Verifies user credentials against Firestore, throws an error if invalid username/password.
  public static verifyUserCredentials = async (
    username: string,
    password: string
  ) => {
    if (!username || !password) {
      throw new Error("Missing username or password");
    }

    const userDoc = await db.collection("users").doc(username).get();
    if (!userDoc.exists) {
      throw new Error("Invalid username");
    }

    const userData = userDoc.data();
    if (password !== userData?.password) {
      throw new Error("Invalid password");
    }

    return { userDoc, userData };
  };

  // Updates a user's Firestore field, default lastAccesstime, to the current date.
  public static updateUserTimestamp = async (
    username: string,
    fieldName = "lastAccessedTime"
  ) => {
    await db
      .collection("users")
      .doc(username)
      .update({
        [fieldName]: new Date(),
      });
  };

  // Reads an image from disk, returning a base64-encoded string.
  public static getImageBlob = async (
    directoryPath: string,
    imageName: string
  ) => {
    const imagePath = path.join(
      envVariables.IMAGES_PATH,
      directoryPath,
      imageName
    );
    return Utils.readImageAsBase64(imagePath);
  };
}
