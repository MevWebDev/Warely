import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { prisma } from "../config/database";

const router: Router = Router();

// Create OAuth client (admin only)
router.post("/", async (req: any, res) => {
  try {
    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { name, redirectUris, scopes } = req.body;
    const clientId = uuidv4();
    const clientSecret = uuidv4();

    const client = await prisma.client.create({
      data: {
        clientId,
        clientSecret: await bcrypt.hash(clientSecret, 12),
        name,
        redirectUris,
        scopes,
      },
    });

    res.status(201).json({
      clientId,
      clientSecret, // Only returned once
      name: client.name,
    });
  } catch (error) {
    console.error("Create client error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
