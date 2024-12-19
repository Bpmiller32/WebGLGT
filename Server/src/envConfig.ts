import dotenv from "dotenv";
import { EnvVariables } from "./types/envVariables";
import { readFileSync } from "fs";

// Load environment variables,
dotenv.config();

// Helper function to get a required environment variable, throws an error if the variable is missing.
const getEnvVariable = (key: keyof EnvVariables) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not defined in the environment variables`);
  }

  return value;
};

// Helper function to parse the service account from JSON file
const getServiceAccount = (serviceAccountPath?: string) => {
  // Error if not defined
  if (!serviceAccountPath) {
    throw new Error(
      "SERVICE_ACCOUNT_KEY_PATH is not defined in the environment variables"
    );
  }

  // Read from file
  try {
    const serviceAccount = JSON.parse(
      readFileSync(serviceAccountPath).toString("utf8")
    );

    return serviceAccount;
  } catch (error) {
    throw new Error(
      `Failed to parse the service account JSON file at ${serviceAccountPath}: ${error}`
    );
  }
};

// Grab and validate environment variables
export const envVariables: EnvVariables = {
  JWT_KEY: getEnvVariable("JWT_KEY"),
  GOOGLE_VISION_API_KEY: getEnvVariable("GOOGLE_VISION_API_KEY"),
  IMAGES_PATH: getEnvVariable("IMAGES_PATH"),
  GOOGLECLOUD_SERVICE_ACCOUNT: getServiceAccount(
    process.env.GOOGLECLOUD_SERVICE_ACCOUNT_KEY_PATH
  ),
};
