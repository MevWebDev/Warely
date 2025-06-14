🎯 Core Features (MVP)

1. Inventory Management
   - Add/Edit/Delete products
   - Track stock levels
   - Set reorder points
   - Category management
2. Order Processing
   - Receive incoming orders
   - Process outbound orders
   - Order status tracking
   - Picking lists generation
3. AI Analytics & Predictions
   - Stock level predictions
   - Demand forecasting
   - Reorder suggestions
   - Trend analysis
4. Dashboard & Reports
   - Real-time inventory overview
   - Order statistics
   - Performance metrics
   - AI insights display

```js
// Products Routes
GET /api/products // List all products
GET /api/products/:id // Get product details
POST /api/products // Create new product
PUT /api/products/:id // Update product
DELETE /api/products/:id // Delete product
GET /api/products/low-stock // Get low stock products

// Categories Routes
GET /api/categories // List categories
POST /api/categories // Create category
PUT /api/categories/:id // Update category
DELETE /api/categories/:id // Delete category

// Orders Routes
GET /api/orders // List orders
GET /api/orders/:id // Get order details
POST /api/orders // Create new order
PUT /api/orders/:id // Update order
DELETE /api/orders/:id // Cancel order
POST /api/orders/:id/complete // Complete order

// Stock Routes
GET /api/stock/movements // Stock movement history
POST /api/stock/adjust // Manual stock adjustment
GET /api/stock/levels // Current stock levels

// Suppliers Routes
GET /api/suppliers // List suppliers
POST /api/suppliers // Create supplier
PUT /api/suppliers/:id // Update supplier
DELETE /api/suppliers/:id // Delete supplier

// Dashboard Routes
GET /api/dashboard/stats // Dashboard statistics
GET /api/dashboard/alerts // Low stock alerts
GET /api/dashboard/recent // Recent activities
```

```js
// Predictions Routes
GET    /api/ai/predictions/:productId    // Get product predictions
POST   /api/ai/predictions/generate     // Generate new predictions
GET    /api/ai/predictions/reorder      // Get reorder suggestions

// Analytics Routes
GET    /api/ai/analytics/trends         // Sales trends analysis
GET    /api/ai/analytics/demand         // Demand forecasting
GET    /api/ai/analytics/performance    // Performance metrics

// Training Routes (Admin only)
POST   /api/ai/train/demand-model       // Retrain demand model
POST   /api/ai/train/reorder-model      // Retrain reorder model
GET    /api/ai/models/status            // Model training status
```
