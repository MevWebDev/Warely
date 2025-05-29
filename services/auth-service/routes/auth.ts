import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import Joi from "joi";

import { prisma, redis } from "../config/database";
import { generateTokens, verifyRefreshToken } from "../utils/jwt";

const router: Router = Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// Register
router.post("/register", async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password, firstName, lastName } = value;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);

    res.status(201).json({
      message: "User registered successfully",
      user,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate tokens
    const { accessToken, refreshToken } = await generateTokens(user.id);

    // Create session
    await prisma.session.create({
      data: {
        userId: user.id,
        token: accessToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
    });

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Refresh token
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ error: "Refresh token required" });
    }

    const userId = await verifyRefreshToken(refreshToken);
    if (!userId) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(
      userId
    );

    res.json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    console.error("Refresh error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Logout
router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const authHeader = req.headers.authorization;

    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken },
      });
    }

    if (authHeader) {
      const token = authHeader.split(" ")[1];
      await redis.setEx(`blacklist:${token}`, 86400, "true"); // Blacklist for 24 hours
    }

    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
