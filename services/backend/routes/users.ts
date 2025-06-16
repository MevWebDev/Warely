import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import {
  authenticateToken,
  requireAuth,
  requireWarehouseAccess,
  requireWarehouseRole,
} from "../middleware/auth0";

const router: Router = Router();
const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: {
    sub: string;
    email: string;
    name: string;
    picture?: string;
    dbUser?: any;
    warehouses?: any[];
    currentWarehouse?: any;
    [key: string]: any;
  };
}

router.post("/auth/login", authenticateToken, (req: any, res) => {
  res.json({
    success: true,
    message: "User authenticated and created in database",
    user: {
      id: req.user.dbUser.id,
      email: req.user.dbUser.email,
      name: req.user.dbUser.name,
      profilePicture: req.user.dbUser.profilePicture,
    },
  });
});

export default router;
