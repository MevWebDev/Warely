import dotenv from "dotenv";
dotenv.config();

import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { Request, Response, NextFunction } from "express";

interface AuthRequest extends Request {
  user?: any;
}

const client = jwksClient({
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  requestHeaders: {}, // Optional
  timeout: 30000, // Defaults to 30s
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error("JWKS Error:", err);
      return callback(err);
    }
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

export const checkAuth0JWT = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  console.log("🔐 Auth middleware called");
  console.log("📋 Headers:", req.headers.authorization);

  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    console.log("❌ No token provided");
    return res.status(401).json({
      error: "No token provided",
      message: "Authorization header with Bearer token required",
    });
  }

  console.log(
    "🔍 Token received (first 50 chars):",
    token.substring(0, 50) + "..."
  );
  console.log("🎯 Expected audience:", process.env.AUTH0_AUDIENCE);
  console.log("🏢 Expected issuer:", `https://${process.env.AUTH0_DOMAIN}/`);

  jwt.verify(
    token,
    getKey,
    {
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ["RS256"],
    },
    (err, decoded) => {
      if (err) {
        console.error("❌ JWT verification error:", err.message);
        console.error("❌ Full error:", err);
        return res.status(401).json({
          error: "Invalid token",
          message: err.message,
          details: process.env.NODE_ENV === "development" ? err : undefined,
        });
      }

      console.log("✅ JWT verified successfully");
      console.log("👤 User info:", decoded);
      req.user = decoded;
      next();
    }
  );
};
