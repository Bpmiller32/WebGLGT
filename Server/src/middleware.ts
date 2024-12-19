import cors from "cors";
import { AuthenticatedRequest } from "./types/authenticatedRequest";
import { Response, NextFunction, Application } from "express";
import jwt, { VerifyErrors } from "jsonwebtoken";
import bodyParser from "body-parser";
import { envVariables } from "./envConfig";

export const configureMiddleware = (app: Application) => {
  // Middleware to parse JSON bodies
  app.use(bodyParser.json());

  // Middleware configure CORS
  app.use(
    cors({
      origin: ["http://localhost:5173", "https://webglgt.web.app"], // Replace with approved frontend URLs
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );
};

// Export middleware for use in endpoints
export const requireAuth = (
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
  jwt.verify(
    token,
    envVariables.JWT_KEY,
    (err: VerifyErrors | null, decoded: any) => {
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
    }
  );
};
