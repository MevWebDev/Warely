# Products API

## Overview

The products API manages product inventory with comprehensive stock tracking, barcode support, and warehouse-scoped operations. All products are scoped to specific warehouses and include real-time stock level management.

## Base URL

```
/api/products
```

## Endpoints

### Get All Products

**GET** `/api/products`

Returns paginated list of products in the specified warehouse with current stock levels.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20, max 100
- `search` (optional): Search in name, description, or barcode
- `categoryId` (optional): Filter by category ID
- `supplierId` (optional): Filter by supplier ID
- `lowStock` (optional): Filter products with stock below minimum level

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "product_123",
        "name": "Widget A",
        "description": "High-quality widget for industrial use",
        "barcode": "1234567890123",
        "sku": "WGT-A-001",
        "price": 29.99,
        "costPrice": 15.5,
        "minStockLevel": 10,
        "maxStockLevel": 100,
        "currentStock": 45,
        "reservedStock": 5,
        "availableStock": 40,
        "categoryId": "cat_123",
        "category": {
          "id": "cat_123",
          "name": "Widgets"
        },
        "supplierId": "sup_123",
        "supplier": {
          "id": "sup_123",
          "name": "Widget Supplier Inc."
        },
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

### Get Product by ID

**GET** `/api/products/:id`

Returns detailed information about a specific product including stock levels and location distribution.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "product_123",
    "name": "Widget A",
    "description": "High-quality widget for industrial use",
    "barcode": "1234567890123",
    "sku": "WGT-A-001",
    "price": 29.99,
    "costPrice": 15.5,
    "minStockLevel": 10,
    "maxStockLevel": 100,
    "currentStock": 45,
    "reservedStock": 5,
    "availableStock": 40,
    "categoryId": "cat_123",
    "category": {
      "id": "cat_123",
      "name": "Widgets",
      "description": "Industrial widgets category"
    },
    "supplierId": "sup_123",
    "supplier": {
      "id": "sup_123",
      "name": "Widget Supplier Inc.",
      "email": "orders@widgetsupplier.com",
      "phone": "+1-555-0001"
    },
    "locations": [
      {
        "locationId": "loc_123",
        "locationName": "A-01-01",
        "quantity": 25
      },
      {
        "locationId": "loc_456",
        "locationName": "B-02-03",
        "quantity": 20
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Get Product by Barcode

**GET** `/api/products/barcode/:barcode`

Looks up a product by its barcode. Useful for barcode scanning applications.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "product_123",
    "name": "Widget A",
    "barcode": "1234567890123",
    "currentStock": 45,
    "availableStock": 40,
    "price": 29.99
  }
}
```

#### Business Logic

- Searches for exact barcode match within the warehouse
- Returns minimal product information optimized for quick lookups
- Commonly used in mobile scanning applications

### Create Product

**POST** `/api/products`

Creates a new product in the warehouse. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "New Widget",
  "description": "Advanced widget with new features",
  "barcode": "9876543210987",
  "sku": "WGT-NEW-001",
  "price": 39.99,
  "costPrice": 22.0,
  "minStockLevel": 5,
  "maxStockLevel": 50,
  "categoryId": "cat_123",
  "supplierId": "sup_123"
}
```

#### Validation Rules

- `name`: Required, string, 1-100 characters
- `description`: Optional, string, max 500 characters
- `barcode`: Optional, string, unique within warehouse
- `sku`: Required, string, unique within warehouse
- `price`: Required, decimal, positive number
- `costPrice`: Optional, decimal, positive number
- `minStockLevel`: Optional, integer, non-negative
- `maxStockLevel`: Optional, integer, greater than minStockLevel
- `categoryId`: Optional, must exist in warehouse
- `supplierId`: Optional, must exist in warehouse

#### Response

**201 Created**

```json
{
  "success": true,
  "data": {
    "id": "product_789",
    "name": "New Widget",
    "description": "Advanced widget with new features",
    "barcode": "9876543210987",
    "sku": "WGT-NEW-001",
    "price": 39.99,
    "costPrice": 22.0,
    "minStockLevel": 5,
    "maxStockLevel": 50,
    "currentStock": 0,
    "reservedStock": 0,
    "availableStock": 0,
    "categoryId": "cat_123",
    "supplierId": "sup_123",
    "warehouseId": "warehouse_123",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Update Product

**PUT** `/api/products/:id`

Updates product information. Stock levels are managed through separate stock operations. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "Updated Widget Name",
  "description": "Updated description",
  "price": 34.99,
  "minStockLevel": 8,
  "maxStockLevel": 80
}
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "product_123",
    "name": "Updated Widget Name",
    "description": "Updated description",
    "price": 34.99,
    "minStockLevel": 8,
    "maxStockLevel": 80,
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### Delete Product

**DELETE** `/api/products/:id`

Soft deletes a product (marks as deleted but preserves data for audit). Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Response

**200 OK**

```json
{
  "success": true,
  "message": "Product deleted successfully"
}
```

#### Business Logic

- Performs soft delete (sets deletedAt timestamp)
- Product remains in database for audit trail
- Stock movements and order history are preserved
- Product no longer appears in regular listings

### Get Low Stock Products

**GET** `/api/products/low-stock`

Returns products where current stock is below minimum stock level.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "product_456",
      "name": "Critical Widget",
      "sku": "WGT-CRIT-001",
      "currentStock": 3,
      "minStockLevel": 10,
      "shortfall": 7,
      "category": "Critical Components",
      "supplier": "Emergency Supplier Ltd"
    }
  ]
}
```

## Stock Management

### Stock Levels

- **Current Stock**: Total quantity physically in warehouse
- **Reserved Stock**: Quantity allocated to pending outbound orders
- **Available Stock**: Current stock minus reserved stock
- **Min/Max Levels**: Automatic reorder point and maximum stock capacity

### Stock Updates

Stock levels are automatically updated through:

- **Inbound Orders**: Increase current stock when completed
- **Outbound Orders**: Reserve stock when created, decrease when completed
- **Stock Movements**: Transfer between locations
- **Manual Adjustments**: Direct stock corrections

## Business Logic

### Product Creation

1. Validates all required fields and uniqueness constraints
2. Creates product record with initial stock of 0
3. Associates with specified category and supplier
4. Logs creation event in analytics

### Stock Tracking

1. Real-time stock calculations based on movements
2. Automatic reservation system for pending orders
3. Low stock alerts when below minimum levels
4. Stock movement audit trail

### Barcode Lookups

1. Optimized for mobile scanning applications
2. Returns minimal data for fast response
3. Warehouse-scoped to prevent cross-contamination

## Error Responses

**400 Bad Request** - Invalid data or validation errors

```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["SKU already exists in this warehouse"]
}
```

**403 Forbidden** - Insufficient permissions

```json
{
  "success": false,
  "message": "Insufficient permissions. MANAGER role required."
}
```

**404 Not Found** - Product not found

```json
{
  "success": false,
  "message": "Product not found"
}
```
