import dotenv from "dotenv";
import { EnvVariables } from "./types/envVariables";

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

// Grab and validate environment variables
export const envVariables: EnvVariables = {
  JWT_KEY: getEnvVariable("JWT_KEY"),
  GOOGLE_VISION_API_KEY: getEnvVariable("GOOGLE_VISION_API_KEY"),
  IMAGES_PATH: getEnvVariable("IMAGES_PATH"),
};
