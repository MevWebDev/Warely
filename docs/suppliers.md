# Suppliers API

## Overview

The suppliers API manages supplier information for warehouses. Suppliers are associated with products and orders, helping track procurement sources and maintain vendor relationships. All suppliers are scoped to specific warehouses and support soft deletion.

## Base URL

```
/api/suppliers
```

## Endpoints

### Get All Suppliers

**GET** `/api/suppliers`

Returns all active suppliers in the specified warehouse.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `includeDeleted` (optional): Include soft-deleted suppliers, default false
- `search` (optional): Search in name, email, or phone

#### Response

**200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "sup_123",
      "name": "TechnoSupply Corp",
      "email": "orders@technosupply.com",
      "phone": "+1-555-0123",
      "address": "123 Industrial Ave, Tech City, TC 12345",
      "contactPerson": "John Smith",
      "website": "https://technosupply.com",
      "notes": "Primary electronics supplier, 30-day payment terms",
      "productCount": 25,
      "totalOrders": 48,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "sup_456",
      "name": "MechParts Ltd",
      "email": "sales@mechparts.com",
      "phone": "+1-555-0456",
      "address": "456 Manufacturing St, Industry Town, IT 67890",
      "contactPerson": "Sarah Johnson",
      "website": "https://mechparts.com",
      "notes": "Mechanical components, bulk discounts available",
      "productCount": 42,
      "totalOrders": 67,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Business Logic

- Returns only active (non-deleted) suppliers by default
- Includes product count and total orders for each supplier
- Ordered by name alphabetically
- Warehouse-scoped results only

### Get Supplier by ID

**GET** `/api/suppliers/:id`

Returns detailed information about a specific supplier including associated products and recent orders.

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
    "id": "sup_123",
    "name": "TechnoSupply Corp",
    "email": "orders@technosupply.com",
    "phone": "+1-555-0123",
    "address": "123 Industrial Ave, Tech City, TC 12345",
    "contactPerson": "John Smith",
    "website": "https://technosupply.com",
    "notes": "Primary electronics supplier, 30-day payment terms",
    "productCount": 25,
    "totalOrders": 48,
    "products": [
      {
        "id": "product_123",
        "name": "LED Strip",
        "sku": "LED-001",
        "currentStock": 25,
        "costPrice": 12.5
      },
      {
        "id": "product_456",
        "name": "Arduino Uno",
        "sku": "ARD-UNO-001",
        "currentStock": 12,
        "costPrice": 18.75
      }
    ],
    "recentOrders": [
      {
        "id": "order_789",
        "orderNumber": "INB-2024-001",
        "type": "INBOUND",
        "status": "COMPLETED",
        "totalAmount": 1250.0,
        "createdAt": "2024-01-15T00:00:00.000Z"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Create Supplier

**POST** `/api/suppliers`

Creates a new supplier in the warehouse. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "NewTech Suppliers",
  "email": "contact@newtech.com",
  "phone": "+1-555-0789",
  "address": "789 Innovation Blvd, Future City, FC 13579",
  "contactPerson": "Mike Wilson",
  "website": "https://newtech.com",
  "notes": "Emerging tech supplier, competitive pricing"
}
```

#### Validation Rules

- `name`: Required, string, 1-100 characters, unique within warehouse
- `email`: Optional, string, valid email format
- `phone`: Optional, string, valid phone format
- `address`: Optional, string, max 200 characters
- `contactPerson`: Optional, string, max 50 characters
- `website`: Optional, string, valid URL format
- `notes`: Optional, string, max 500 characters

#### Response

**201 Created**

```json
{
  "success": true,
  "data": {
    "id": "sup_789",
    "name": "NewTech Suppliers",
    "email": "contact@newtech.com",
    "phone": "+1-555-0789",
    "address": "789 Innovation Blvd, Future City, FC 13579",
    "contactPerson": "Mike Wilson",
    "website": "https://newtech.com",
    "notes": "Emerging tech supplier, competitive pricing",
    "productCount": 0,
    "totalOrders": 0,
    "warehouseId": "warehouse_123",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Business Logic

- Validates name uniqueness within the warehouse
- Automatically associates with the current warehouse
- Initializes with zero product and order counts
- Logs creation event in analytics

### Update Supplier

**PUT** `/api/suppliers/:id`

Updates supplier information. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "Updated Supplier Name",
  "email": "newemail@supplier.com",
  "phone": "+1-555-9999",
  "notes": "Updated notes about supplier"
}
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "sup_123",
    "name": "Updated Supplier Name",
    "email": "newemail@supplier.com",
    "phone": "+1-555-9999",
    "notes": "Updated notes about supplier",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

#### Business Logic

- Validates name uniqueness if changed
- Updates supplier information
- Product and order associations remain unchanged
- Logs update event in analytics

### Delete Supplier

**DELETE** `/api/suppliers/:id`

Soft deletes a supplier. Products and orders associated with the supplier are preserved but marked as having a deleted supplier. Requires MANAGER or OWNER role.

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
  "message": "Supplier deleted successfully"
}
```

#### Business Logic

- Performs soft delete (sets deletedAt timestamp)
- Supplier remains in database for audit trail
- Products keep supplier association for historical reference
- Orders maintain supplier information for compliance
- Supplier no longer appears in regular listings
- Logs deletion event in analytics

### Get Supplier Statistics

**GET** `/api/suppliers/:id/stats`

Returns detailed statistics about a supplier including order history and product performance.

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
    "supplierId": "sup_123",
    "supplierName": "TechnoSupply Corp",
    "totalProducts": 25,
    "totalOrders": 48,
    "totalSpent": 45750.0,
    "averageOrderValue": 953.13,
    "onTimeDeliveryRate": 94.5,
    "ordersByStatus": {
      "PENDING": 2,
      "IN_TRANSIT": 1,
      "COMPLETED": 45
    },
    "monthlyOrders": [
      {
        "month": "2024-01",
        "orders": 4,
        "totalAmount": 3250.0
      }
    ],
    "topProducts": [
      {
        "id": "product_123",
        "name": "LED Strip",
        "orderedQuantity": 500,
        "totalCost": 6250.0
      }
    ]
  }
}
```

## Business Logic

### Supplier Management

1. **Warehouse Scoping**: All suppliers are isolated within their warehouse
2. **Name Uniqueness**: Supplier names must be unique within each warehouse
3. **Soft Deletion**: Deleted suppliers are preserved for audit trails
4. **Contact Information**: Comprehensive contact details for procurement

### Product and Order Tracking

1. Real-time counting of associated products and orders
2. Historical data preservation for compliance
3. Performance metrics calculation
4. Supply chain analytics and reporting

### Access Control

- **WORKER**: Read-only access to suppliers
- **MANAGER/OWNER**: Full CRUD operations on suppliers

## Common Use Cases

### Procurement Management

- Maintain vendor contact information
- Track supplier performance metrics
- Compare supplier pricing and delivery times
- Manage supplier relationships and contracts

### Supply Chain Analytics

- Monitor supplier reliability and quality
- Track order fulfillment rates
- Analyze supplier cost trends
- Generate supplier performance reports

### Audit and Compliance

- Maintain historical supplier records
- Track product sources for quality control
- Document supplier certifications and compliance
- Support financial auditing requirements

## Error Responses

**400 Bad Request** - Invalid data or validation errors

```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["Supplier name already exists in this warehouse"]
}
```

**403 Forbidden** - Insufficient permissions

```json
{
  "success": false,
  "message": "Insufficient permissions. MANAGER role required."
}
```

**404 Not Found** - Supplier not found

```json
{
  "success": false,
  "message": "Supplier not found"
}
```

**409 Conflict** - Cannot delete supplier with active orders

```json
{
  "success": false,
  "message": "Cannot delete supplier with pending orders. Complete or cancel orders first."
}
```
