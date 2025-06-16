import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import axios from "axios";

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

// Main authentication middleware with automatic user creation
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access token required",
    });
  }

  try {
    // Verify token with Auth0 and get user info
    const response = await axios.get(
      `https://${process.env.AUTH0_DOMAIN}/userinfo`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const auth0User = response.data;
    console.log("Auth0 user info:", auth0User);

    // Find or create user in database
    let dbUser = await prisma.user.findUnique({
      where: { auth0Id: auth0User.sub },
      include: {
        warehouseAccess: {
          include: {
            warehouse: true,
          },
          where: {
            isActive: true,
          },
        },
      },
    });

    if (!dbUser) {
      // Create new user automatically
      console.log("Creating new user for:", auth0User.email);

      dbUser = await prisma.user.create({
        data: {
          auth0Id: auth0User.sub,
          email: auth0User.email || `user-${Date.now()}@temp.com`,
          name: auth0User.name || auth0User.nickname || "New User",
          profilePicture: auth0User.picture || null,
          isActive: true,
        },
        include: {
          warehouseAccess: {
            include: {
              warehouse: true,
            },
          },
        },
      });

      console.log("New user created successfully:", dbUser.email);
    } else {
      // Update user info if it has changed
      const updates: any = {};

      if (auth0User.email && auth0User.email !== dbUser.email) {
        updates.email = auth0User.email;
      }
      if (auth0User.name && auth0User.name !== dbUser.name) {
        updates.name = auth0User.name;
      }
      if (auth0User.picture && auth0User.picture !== dbUser.profilePicture) {
        updates.profilePicture = auth0User.picture;
      }

      if (Object.keys(updates).length > 0) {
        console.log("Updating user info:", updates);
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: updates,
          include: {
            warehouseAccess: {
              include: {
                warehouse: true,
              },
            },
          },
        });
      }
    }

    // Handle warehouse context from header
    const warehouseId = req.headers["x-warehouse-id"] as string;
    let currentWarehouse = null;

    if (warehouseId) {
      // Find specific warehouse access
      currentWarehouse = dbUser.warehouseAccess.find(
        (wa) => wa.warehouseId === parseInt(warehouseId) && wa.isActive
      );

      if (!currentWarehouse) {
        return res.status(403).json({
          success: false,
          message: `No access to warehouse ${warehouseId}`,
          availableWarehouses: dbUser.warehouseAccess.map((wa) => ({
            id: wa.warehouseId,
            name: wa.warehouse.name,
            role: wa.role,
          })),
        });
      }
    } else if (dbUser.warehouseAccess.length > 0) {
      // Default to first warehouse if no header specified
      currentWarehouse = dbUser.warehouseAccess[0];
    }

    // Attach complete user data to request
    req.user = {
      sub: auth0User.sub,
      email: auth0User.email,
      name: auth0User.name,
      picture: auth0User.picture,
      dbUser: dbUser,
      warehouses: dbUser.warehouseAccess,
      currentWarehouse: currentWarehouse,
    };

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        return res.status(401).json({
          success: false,
          message: "Invalid or expired token",
        });
      }
    }

    return res.status(500).json({
      success: false,
      message: "Authentication service error",
    });
  }
};

// Updated role-based authorization for warehouse context
export const requireWarehouseRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.dbUser) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!req.user.currentWarehouse) {
      return res.status(400).json({
        success: false,
        message:
          "Warehouse context required. Please specify X-Warehouse-Id header.",
        availableWarehouses: req.user.warehouses?.map((w) => ({
          id: w.warehouseId,
          name: w.warehouse.name,
          role: w.role,
        })),
      });
    }

    const userRole = req.user.currentWarehouse.role;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Insufficient permissions in this warehouse. Required: ${allowedRoles.join(
          " or "
        )}, Current: ${userRole}`,
      });
    }

    next();
  };
};

// Check if user has access to any warehouse
export const requireWarehouseAccess = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.dbUser) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  if (!req.user.warehouses || req.user.warehouses.length === 0) {
    return res.status(403).json({
      success: false,
      message:
        "No warehouse access. Please contact an administrator to get access to a warehouse.",
    });
  }

  next();
};

// Check if user is authenticated (no warehouse required)
export const requireAuth = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.dbUser) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }
  next();
};

// Get current user's warehouse role
export const getCurrentWarehouseRole = (req: AuthRequest): string | null => {
  return req.user?.currentWarehouse?.role || null;
};

// Check if user has specific role in current warehouse
export const hasWarehouseRole = (req: AuthRequest, role: string): boolean => {
  const currentRole = getCurrentWarehouseRole(req);

  // Role hierarchy: OWNER > MANAGER > WORKER
  const roleHierarchy = {
    OWNER: 3,
    MANAGER: 2,
    WORKER: 1,
  };

  const userLevel =
    roleHierarchy[currentRole as keyof typeof roleHierarchy] || 0;
  const requiredLevel = roleHierarchy[role as keyof typeof roleHierarchy] || 0;

  return userLevel >= requiredLevel;
};

export { AuthRequest };
