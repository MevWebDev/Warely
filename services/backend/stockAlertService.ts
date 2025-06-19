import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

export interface AlertProduct {
  sku: string;
  name: string;
  alertStatus: "OUT_OF_STOCK" | "LOW_STOCK" | "WARNING";
  currentStock: number;
  reorderPoint: number;
}

export class StockAlertService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async testEmailConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log("✅ Email connection successful");
      return true;
    } catch (error) {
      console.error("❌ Email connection failed:", error);
      return false;
    }
  }

  // Get products with alerts (same logic as your route)
  async getProductsWithAlerts(warehouseId: number): Promise<AlertProduct[]> {
    const products = await prisma.product.findMany({
      where: {
        warehouseId: warehouseId,
        isActive: true,
      },
      select: {
        sku: true,
        name: true,
        currentStock: true,
        reorderPoint: true,
      },
      orderBy: { name: "asc" },
    });

    // Filter only products that need alerts using your existing logic
    const alertProducts: AlertProduct[] = [];

    products.forEach((product) => {
      const alertStatus = this.getAlertStatus(
        product.currentStock,
        product.reorderPoint
      );

      if (alertStatus !== "NORMAL") {
        alertProducts.push({
          sku: product.sku,
          name: product.name,
          alertStatus: alertStatus as "OUT_OF_STOCK" | "LOW_STOCK" | "WARNING",
          currentStock: product.currentStock,
          reorderPoint: product.reorderPoint,
        });
      }
    });

    return alertProducts;
  }

  // Same alert logic as your route
  private getAlertStatus(currentStock: number, reorderPoint: number): string {
    if (currentStock <= 0) return "OUT_OF_STOCK";
    if (currentStock <= reorderPoint) return "LOW_STOCK";
    if (currentStock <= reorderPoint * 1.5) return "WARNING";
    return "NORMAL";
  }

  // Send email alerts
  async sendStockAlerts(
    warehouseId: number,
    recipients: string[]
  ): Promise<void> {
    console.log(`📧 Starting email send to ${recipients.length} recipients`);

    const alertProducts = await this.getProductsWithAlerts(warehouseId);
    console.log(`📦 Found ${alertProducts.length} products with alerts`);

    if (alertProducts.length === 0) {
      console.log("📦 No stock alerts needed");
      return;
    }

    // Test email connection first
    const connectionOk = await this.testEmailConnection();
    if (!connectionOk) {
      throw new Error("Email connection failed");
    }

    // Get warehouse name
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
      select: { name: true },
    });

    const warehouseName = warehouse?.name || `Warehouse ${warehouseId}`;
    console.log(`🏢 Warehouse: ${warehouseName}`);

    // Categorize products
    const outOfStock = alertProducts.filter(
      (p) => p.alertStatus === "OUT_OF_STOCK"
    );
    const lowStock = alertProducts.filter((p) => p.alertStatus === "LOW_STOCK");
    const warning = alertProducts.filter((p) => p.alertStatus === "WARNING");

    console.log(
      `📊 Product breakdown: ${outOfStock.length} out of stock, ${lowStock.length} low stock, ${warning.length} warning`
    );

    // Create email
    const subject =
      outOfStock.length > 0
        ? `🚨 URGENT: ${outOfStock.length} items out of stock - ${warehouseName}`
        : `⚠️ Stock Alert: ${alertProducts.length} items need attention - ${warehouseName}`;

    console.log(`📝 Email subject: ${subject}`);

    const html = this.generateEmailHTML(warehouseName, {
      outOfStock,
      lowStock,
      warning,
    });
    console.log(`📄 Generated HTML email (${html.length} characters)`);

    // Send to all recipients
    for (const recipient of recipients) {
      try {
        console.log(`📤 Sending email to ${recipient}...`);

        const result = await this.transporter.sendMail({
          from: process.env.SMTP_FROM,
          to: recipient,
          subject,
          html,
        });

        console.log(
          `✅ Email sent to ${recipient}. Message ID: ${result.messageId}`
        );
      } catch (error) {
        console.error(`❌ Failed to send email to ${recipient}:`, error);
        throw error; // Re-throw to stop the process
      }
    }
  }

  private generateEmailHTML(
    warehouseName: string,
    products: {
      outOfStock: AlertProduct[];
      lowStock: AlertProduct[];
      warning: AlertProduct[];
    }
  ): string {
    const totalItems =
      products.outOfStock.length +
      products.lowStock.length +
      products.warning.length;

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
          margin: 0; 
          padding: 20px; 
          background-color: #f5f5f5; 
        }
        .container { 
          max-width: 600px; 
          margin: 0 auto; 
          background: white; 
          border-radius: 12px; 
          overflow: hidden; 
          box-shadow: 0 4px 20px rgba(0,0,0,0.1); 
        }
        .header { 
          background: linear-gradient(135deg, #dc2626, #b91c1c); 
          color: white; 
          padding: 30px 20px; 
          text-align: center; 
        }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .header p { margin: 10px 0 0 0; opacity: 0.9; }
        .content { padding: 30px 20px; }
        
        .alert-section { 
          margin-bottom: 25px; 
          border-radius: 8px; 
          overflow: hidden; 
          border: 2px solid; 
        }
        .critical { border-color: #dc2626; }
        .warning { border-color: #ea580c; }
        .info { border-color: #d97706; }
        
        .section-header { 
          padding: 15px 20px; 
          font-weight: 600; 
          color: white; 
          font-size: 16px;
        }
        .critical-header { background: #dc2626; }
        .warning-header { background: #ea580c; }
        .info-header { background: #d97706; }
        
        .product-list { background: #fafafa; }
        .product-item { 
          padding: 15px 20px; 
          border-bottom: 1px solid #e5e7eb; 
          display: flex; 
          justify-content: space-between; 
          align-items: center;
        }
        .product-item:last-child { border-bottom: none; }
        
        .product-info h4 { 
          margin: 0 0 5px 0; 
          font-size: 16px; 
          font-weight: 600; 
          color: #111827; 
        }
        .product-sku { 
          font-size: 14px; 
          color: #6b7280; 
          font-family: 'Courier New', monospace;
        }
        
        .stock-badge { 
          padding: 6px 12px; 
          border-radius: 20px; 
          font-size: 12px; 
          font-weight: 600; 
          text-transform: uppercase;
        }
        .critical-badge { background: #fef2f2; color: #dc2626; }
        .warning-badge { background: #fff7ed; color: #ea580c; }
        .info-badge { background: #fffbeb; color: #d97706; }
        
        .summary { 
          background: #f9fafb; 
          padding: 20px; 
          border-radius: 8px; 
          margin-bottom: 30px;
        }
        .summary h3 { margin: 0 0 15px 0; color: #374151; }
        .summary ul { margin: 0; padding-left: 20px; }
        .summary li { margin: 5px 0; color: #6b7280; }
        
        .btn { 
          display: inline-block; 
          padding: 15px 30px; 
          background: #2563eb; 
          color: white; 
          text-decoration: none; 
          border-radius: 8px; 
          font-weight: 600;
          text-align: center;
        }
        .btn:hover { background: #1d4ed8; }
        
        .footer { 
          background: #f9fafb; 
          padding: 20px; 
          text-align: center; 
          color: #6b7280; 
          font-size: 14px; 
        }
        
        .center { text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🚨 Stock Alert - ${warehouseName}</h1>
          <p>${totalItems} product(s) require immediate attention</p>
        </div>
        
        <div class="content">
          ${
            products.outOfStock.length > 0
              ? `
            <div class="alert-section critical">
              <div class="section-header critical-header">
                🚨 CRITICAL - Out of Stock (${products.outOfStock.length} items)
              </div>
              <div class="product-list">
                ${products.outOfStock
                  .map(
                    (product) => `
                  <div class="product-item">
                    <div class="product-info">
                      <h4>${product.name}</h4>
                      <div class="product-sku">SKU: ${product.sku}</div>
                    </div>
                    <div class="stock-badge critical-badge">OUT OF STOCK</div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          ${
            products.lowStock.length > 0
              ? `
            <div class="alert-section warning">
              <div class="section-header warning-header">
                ⚠️ LOW STOCK - Reorder Immediately (${
                  products.lowStock.length
                } items)
              </div>
              <div class="product-list">
                ${products.lowStock
                  .map(
                    (product) => `
                  <div class="product-item">
                    <div class="product-info">
                      <h4>${product.name}</h4>
                      <div class="product-sku">SKU: ${product.sku}</div>
                    </div>
                    <div class="stock-badge warning-badge">
                      ${product.currentStock} LEFT
                    </div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          ${
            products.warning.length > 0
              ? `
            <div class="alert-section info">
              <div class="section-header info-header">
                💡 WARNING - Consider Reordering (${
                  products.warning.length
                } items)
              </div>
              <div class="product-list">
                ${products.warning
                  .map(
                    (product) => `
                  <div class="product-item">
                    <div class="product-info">
                      <h4>${product.name}</h4>
                      <div class="product-sku">SKU: ${product.sku}</div>
                    </div>
                    <div class="stock-badge info-badge">
                      ${product.currentStock} LEFT
                    </div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }

          <div class="summary">
            <h3>📋 Action Required:</h3>
            <ul>
              ${
                products.outOfStock.length > 0
                  ? "<li><strong>Place emergency orders</strong> for out-of-stock items</li>"
                  : ""
              }
              ${
                products.lowStock.length > 0
                  ? "<li><strong>Reorder low stock items</strong> immediately</li>"
                  : ""
              }
              ${
                products.warning.length > 0
                  ? "<li><strong>Review reorder points</strong> for warning items</li>"
                  : ""
              }
              <li>Update stock levels after receiving new inventory</li>
              <li>Consider adjusting reorder points for frequently low items</li>
            </ul>
          </div>

          <div class="center">
            <a href="${
              process.env.FRONTEND_URL || "http://localhost:3000"
            }/inventory" class="btn">
              📦 View Inventory Dashboard
            </a>
          </div>
        </div>

        <div class="footer">
          <p><strong>Warely Inventory Management System</strong></p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
      </div>
    </body>
    </html>
    `;
  }
}
