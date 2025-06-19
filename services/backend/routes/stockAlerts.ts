import { Router, Response } from "express";
import {
  authenticateToken,
  requireWarehouseAccess,
  AuthRequest,
} from "../middleware/auth0";
import { StockAlertService } from "../stockAlertService";

const router: Router = Router();
const stockAlertService = new StockAlertService();

// GET /api/stock-alerts - Get current stock alerts
router.get(
  "/",
  authenticateToken,
  requireWarehouseAccess,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = req.user!.currentWarehouse!.warehouseId;

      const alertProducts = await stockAlertService.getProductsWithAlerts(
        warehouseId
      );

      // Categorize for summary
      const summary = {
        total: alertProducts.length,
        outOfStock: alertProducts.filter(
          (p) => p.alertStatus === "OUT_OF_STOCK"
        ).length,
        lowStock: alertProducts.filter((p) => p.alertStatus === "LOW_STOCK")
          .length,
        warning: alertProducts.filter((p) => p.alertStatus === "WARNING")
          .length,
      };

      res.json({
        success: true,
        data: {
          summary,
          products: alertProducts,
        },
      });
    } catch (error: any) {
      console.error("Get stock alerts error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get stock alerts",
      });
    }
  }
);

router.post(
  "/send",
  authenticateToken,
  requireWarehouseAccess,

  async (req: AuthRequest, res: Response) => {
    try {
      // Use the same warehouseId logic as other routes
      const warehouseId = req.user!.currentWarehouse!.warehouseId;
      const { recipients } = req.body;

      if (
        !recipients ||
        !Array.isArray(recipients) ||
        recipients.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Recipients array is required and cannot be empty",
        });
      }

      const alertProducts = await stockAlertService.getProductsWithAlerts(
        warehouseId
      );

      if (alertProducts.length === 0) {
        return res.json({
          success: true,
          message: "No stock alerts to send - all products are well stocked!",
          data: { alertsSent: 0, productsAlerted: 0 },
        });
      }

      await stockAlertService.sendStockAlerts(warehouseId, recipients);

      res.json({
        success: true,
        message: `Stock alerts sent successfully to ${recipients.length} recipient(s)`,
        data: {
          alertsSent: recipients.length,
          productsAlerted: alertProducts.length,
          recipients: recipients,
          summary: {
            outOfStock: alertProducts.filter(
              (p) => p.alertStatus === "OUT_OF_STOCK"
            ).length,
            lowStock: alertProducts.filter((p) => p.alertStatus === "LOW_STOCK")
              .length,
            warning: alertProducts.filter((p) => p.alertStatus === "WARNING")
              .length,
          },
        },
      });
    } catch (error: any) {
      console.error("Send stock alerts error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send stock alerts",
        error: error.message,
      });
    }
  }
);

// POST /api/stock-alerts/test - Send test alert with sample data
router.post(
  "/test",
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const warehouseId = parseInt(req.headers["x-warehouse-id"] as string);
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Email is required",
        });
      }

      // Get real products for testing, or create sample data
      let alertProducts = await stockAlertService.getProductsWithAlerts(
        warehouseId
      );

      // If no real alerts, create sample data for testing
      if (alertProducts.length === 0) {
        alertProducts = [
          {
            sku: "TEST-001",
            name: "Sample Product A",
            alertStatus: "OUT_OF_STOCK" as const,
            currentStock: 0,
            reorderPoint: 10,
          },
          {
            sku: "TEST-002",
            name: "Sample Product B",
            alertStatus: "LOW_STOCK" as const,
            currentStock: 3,
            reorderPoint: 15,
          },
          {
            sku: "TEST-003",
            name: "Sample Product C",
            alertStatus: "WARNING" as const,
            currentStock: 12,
            reorderPoint: 10,
          },
        ];
      }

      await stockAlertService.sendStockAlerts(warehouseId, [email]);

      res.json({
        success: true,
        message: `Test stock alert sent to ${email}`,
        data: {
          productsIncluded: alertProducts.length,
          testEmail: email,
        },
      });
    } catch (error: any) {
      console.error("Send test alert error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to send test alert",
        error: error.message,
      });
    }
  }
);

export default router;
