import { Request, Response, NextFunction } from "express";
import fs from "fs/promises";
import path from "path";
import { google } from "googleapis";
import { envVariables } from "./envConfig";

export default class Utils {
  // Reads and validates the presence of an image file, returns its Base64 encoded string.
  public static readImageAsBase64 = async (imagePath: string) => {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      return imageBuffer.toString("base64");
    } catch (error) {
      throw new Error("Image not found on disk");
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

    const token = authHeader.split(" ")[1];

    if (!token) {
      throw new Error("Invalid authorization format");
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
      throw new Error("Failed to read image directory");
    }
  };

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
    } catch (error: any) {
      throw new Error("Failed to create Firestore index");
    }
  };
}
