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
      const imageExtensions = [".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tif"];

      return files.filter((file) =>
        imageExtensions.includes(path.extname(file).toLowerCase())
      );
    } catch (error) {
      throw new Error(`Failed to read image directory: ${directoryPath}`);
    }
  };

  // Creates necessary indices for db if they don't already exist
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

    // Define collection to add indexes to, custom indexes config - for whatever annoying reason Firestore needs two....
    const collection = `projects/${projectId}/databases/(default)/collectionGroups/${collectionId}`;
    const indexConfigs = [
      {
        fields: [
          { fieldPath: "status", order: "ASCENDING" },
          { fieldPath: "createdAt", order: "ASCENDING" },
          { fieldPath: "__name__", order: "ASCENDING" },
        ],
      },
      {
        fields: [
          { fieldPath: "assignedTo", order: "ASCENDING" },
          { fieldPath: "status", order: "ASCENDING" },
          { fieldPath: "createdAt", order: "ASCENDING" },
          { fieldPath: "__name__", order: "ASCENDING" },
        ],
      },
    ];

    try {
      // Get existing indexes
      const { data: existingIndexes } =
        await firestore.projects.databases.collectionGroups.indexes.list({
          parent: collection,
        });

      // Iterate over each index configuration to ensure it exists
      for (const indexConfig of indexConfigs) {
        // Flag to track if the index already exists
        let indexExists = false;

        // Check if the index exists in the list of existing indexes
        if (existingIndexes.indexes) {
          for (const existing of existingIndexes.indexes) {
            const existingFields = existing.fields || [];
            const configFields = indexConfig.fields;

            // Skip if the number of fields does not match
            if (existingFields.length !== configFields.length) {
              continue;
            }

            // Compare each field in the configuration with the existing index
            let fieldsMatch = true;
            for (let i = 0; i < configFields.length; i++) {
              const configField = configFields[i];
              const existingField = existingFields[i];

              // Fields do not match, exit the loop as this is not a matching index
              if (
                configField.fieldPath !== existingField.fieldPath ||
                configField.order !== existingField.order
              ) {
                fieldsMatch = false;
                break;
              }
            }

            // If all fields match, mark the index as existing and exit the loop
            if (fieldsMatch) {
              indexExists = true;
              break;
            }
          }
        }

        // Create the index if it does not already exist
        if (!indexExists) {
          await firestore.projects.databases.collectionGroups.indexes.create({
            parent: collection,
            requestBody: {
              fields: indexConfig.fields,
              queryScope: "COLLECTION",
            },
          });
        }
      }
    } catch (error: any) {
      if (!error.message?.includes("already exists")) {
        throw new Error(`Failed to create Firestore index: ${error}`);
      }
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
