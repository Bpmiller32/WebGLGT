import { Request, Response, NextFunction } from "express";
import fs from "fs/promises";
import path from "path";
import { google } from "googleapis";
import { envVariables } from "./envConfig";
import { db } from "./firebaseAdmin";
import sharp from "sharp";

export default class Utils {
  // Reads and validates the presence of an image file, returns its Base64 encoded string.
  public static readImageAsBase64 = async (imagePath: string) => {
    try {
      const fileBuffer = await fs.readFile(imagePath);

      if (imagePath.toLowerCase().endsWith(".tif")) {
        // Convert .tif to .png using Sharp
        const pngBuffer = await sharp(fileBuffer).png().toBuffer();
        return pngBuffer.toString("base64");
      }

      // For other formats, directly encode as base64
      return fileBuffer.toString("base64");
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

  // Creates necessary indices for Firestore if they don't already exist
  public static createFirestoreIndex = async (
    projectId: string,
    collectionId: string
  ) => {
    // Create a custom JWT auth client.
    const authClient = new google.auth.JWT({
      email: envVariables.GOOGLECLOUD_SERVICE_ACCOUNT.client_email,
      key: envVariables.GOOGLECLOUD_SERVICE_ACCOUNT.private_key,
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });

    // Instantiate the Firestore API client.
    const firestore = google.firestore({
      version: "v1",
      auth: authClient,
    });

    // Define the parent path for the collection group.
    const collectionPath = `projects/${projectId}/databases/(default)/collectionGroups/${collectionId}`;
    console.log("Creating indexes on:", collectionPath);

    // Define the desired composite index configurations.
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
      {
        fields: [
          { fieldPath: "assignedTo", order: "ASCENDING" },
          { fieldPath: "status", order: "ASCENDING" },
          { fieldPath: "claimedAt", order: "ASCENDING" },
          { fieldPath: "__name__", order: "ASCENDING" },
        ],
      },
    ];

    try {
      // Retrieve existing composite indexes for the collection group.
      const { data: existingIndexes } =
        await firestore.projects.databases.collectionGroups.indexes.list({
          parent: collectionPath,
        });

      // Loop over each desired index configuration.
      for (const config of indexConfigs) {
        // Check if an existing index with the same configuration, query scope,
        // and that is READY exists.
        const isExistingIndexReady = existingIndexes?.indexes?.some(
          (existing) => {
            // Ensure existing.fields is defined.
            if (!existing.fields) return false;
            // Check that the number of fields match.
            if (existing.fields.length !== config.fields.length) return false;
            // Ensure the index has the proper query scope.
            if (existing.queryScope !== "COLLECTION_GROUP") return false;
            // Only consider the index if its state is READY.
            if (existing.state !== "READY") return false;
            // Compare each field in order.
            return config.fields.every((fieldConfig, i) => {
              const existingField = existing.fields![i];
              return (
                fieldConfig.fieldPath === existingField.fieldPath &&
                fieldConfig.order === existingField.order
              );
            });
          }
        );

        if (!isExistingIndexReady) {
          console.log("Creating new index with config:", config.fields);
          const op =
            await firestore.projects.databases.collectionGroups.indexes.create({
              parent: collectionPath,
              requestBody: {
                fields: config.fields,
                queryScope: "COLLECTION_GROUP", // Change from "COLLECTION" to "COLLECTION_GROUP"
              },
            });
          console.log("Index creation operation:", op.data);
          // Optionally, you could implement polling here to wait until the index is READY.
        } else {
          console.log(
            "Index already exists and is ready for config:",
            config.fields
          );
        }
      }
    } catch (error: any) {
      if (!error.message?.includes("already exists")) {
        throw new Error(`Error creating Firestore index: ${error}`);
      } else {
        console.log("Index already exists:", error.message);
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

    const base64Data = await Utils.readImageAsBase64(imagePath);

    // Check if the Base64 data is valid
    if (!base64Data || typeof base64Data !== "string") {
      throw new Error("Failed to encode the image as Base64.");
    }

    const mimeType = imageName.toLowerCase().endsWith(".tif")
      ? "image/png"
      : Utils.getMimeType(imageName);

    const dataUrl = `data:${mimeType};base64,${base64Data}`;

    // // Save the data URL to a file for debugging
    // const debugFilePath = path.join(
    //   envVariables.IMAGES_PATH,
    //   "debug_dataUrl.txt"
    // );
    // await fs.writeFile(debugFilePath, dataUrl, { encoding: "utf8" });

    return dataUrl;
  };

  // Helper method to determine MIME type
  private static getMimeType(imageName: string) {
    const extension = path.extname(imageName).toLowerCase();
    switch (extension) {
      case ".png":
        return "image/png";
      case ".jpg":
      case ".jpeg":
        return "image/jpeg";
      case ".gif":
        return "image/gif";
      case ".bmp":
        return "image/bmp";
      default:
        // Default MIME type
        return "application/octet-stream";
    }
  }
}
