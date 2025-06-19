# Orders API

## Overview

The orders API manages inbound and outbound orders with automatic stock management. Orders handle procurement (INBOUND) and fulfillment (OUTBOUND) with automatic stock reservations, updates, and location tracking. All orders are warehouse-scoped and include comprehensive audit trails.

## Base URL

```
/api/orders
```

## Order Types

- **INBOUND**: Receiving stock from suppliers (procurement)
- **OUTBOUND**: Shipping stock to customers (fulfillment)

## Order Statuses

- **PENDING**: Order created, awaiting processing
- **IN_TRANSIT**: Order is being shipped/delivered
- **COMPLETED**: Order fulfilled, stock updated
- **CANCELLED**: Order cancelled, stock reservations released

## Endpoints

### Get All Orders

**GET** `/api/orders`

Returns paginated list of orders in the specified warehouse.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20, max 100
- `type` (optional): Filter by order type (INBOUND/OUTBOUND)
- `status` (optional): Filter by status (PENDING/IN_TRANSIT/COMPLETED/CANCELLED)
- `supplierId` (optional): Filter by supplier (INBOUND only)
- `customerId` (optional): Filter by customer (OUTBOUND only)
- `dateFrom` (optional): Filter from date (ISO 8601)
- `dateTo` (optional): Filter to date (ISO 8601)

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "order_123",
        "orderNumber": "INB-2024-001",
        "type": "INBOUND",
        "status": "COMPLETED",
        "supplierId": "sup_123",
        "supplier": {
          "id": "sup_123",
          "name": "TechnoSupply Corp"
        },
        "customerInfo": null,
        "totalAmount": 1250.0,
        "itemCount": 3,
        "expectedDate": "2024-01-15T00:00:00.000Z",
        "completedDate": "2024-01-14T15:30:00.000Z",
        "notes": "Priority delivery",
        "createdAt": "2024-01-10T00:00:00.000Z",
        "updatedAt": "2024-01-14T15:30:00.000Z"
      },
      {
        "id": "order_456",
        "orderNumber": "OUT-2024-001",
        "type": "OUTBOUND",
        "status": "PENDING",
        "supplierId": null,
        "supplier": null,
        "customerInfo": {
          "name": "ABC Manufacturing",
          "email": "orders@abcmfg.com",
          "phone": "+1-555-0001",
          "address": "123 Factory St, Industrial City, IC 11111"
        },
        "totalAmount": 875.5,
        "itemCount": 2,
        "expectedDate": "2024-01-20T00:00:00.000Z",
        "completedDate": null,
        "notes": "Rush order - expedite shipping",
        "createdAt": "2024-01-12T00:00:00.000Z",
        "updatedAt": "2024-01-12T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "pages": 8
    }
  }
}
```

### Get Order by ID

**GET** `/api/orders/:id`

Returns detailed information about a specific order including all order items and stock movements.

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
    "id": "order_123",
    "orderNumber": "INB-2024-001",
    "type": "INBOUND",
    "status": "COMPLETED",
    "supplierId": "sup_123",
    "supplier": {
      "id": "sup_123",
      "name": "TechnoSupply Corp",
      "email": "orders@technosupply.com",
      "phone": "+1-555-0123"
    },
    "customerInfo": null,
    "totalAmount": 1250.0,
    "itemCount": 3,
    "expectedDate": "2024-01-15T00:00:00.000Z",
    "completedDate": "2024-01-14T15:30:00.000Z",
    "notes": "Priority delivery",
    "orderItems": [
      {
        "id": "item_123",
        "productId": "product_123",
        "product": {
          "id": "product_123",
          "name": "LED Strip",
          "sku": "LED-001",
          "barcode": "1234567890123"
        },
        "quantity": 50,
        "unitPrice": 12.5,
        "totalPrice": 625.0,
        "locationId": "loc_123",
        "location": {
          "id": "loc_123",
          "name": "A-01-01"
        }
      },
      {
        "id": "item_456",
        "productId": "product_456",
        "product": {
          "id": "product_456",
          "name": "Arduino Uno",
          "sku": "ARD-UNO-001",
          "barcode": "9876543210987"
        },
        "quantity": 25,
        "unitPrice": 25.0,
        "totalPrice": 625.0,
        "locationId": "loc_456",
        "location": {
          "id": "loc_456",
          "name": "B-02-03"
        }
      }
    ],
    "stockMovements": [
      {
        "id": "movement_123",
        "productId": "product_123",
        "fromLocationId": null,
        "toLocationId": "loc_123",
        "quantity": 50,
        "type": "INBOUND",
        "createdAt": "2024-01-14T15:30:00.000Z"
      }
    ],
    "createdAt": "2024-01-10T00:00:00.000Z",
    "updatedAt": "2024-01-14T15:30:00.000Z"
  }
}
```

### Create Inbound Order

**POST** `/api/orders/inbound`

Creates a new inbound order for receiving stock from a supplier. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "supplierId": "sup_123",
  "expectedDate": "2024-01-20T00:00:00.000Z",
  "notes": "Standard monthly order",
  "orderItems": [
    {
      "productId": "product_123",
      "quantity": 100,
      "unitPrice": 12.5,
      "locationId": "loc_123"
    },
    {
      "productId": "product_456",
      "quantity": 50,
      "unitPrice": 25.0,
      "locationId": "loc_456"
    }
  ]
}
```

#### Validation Rules

- `supplierId`: Required, must exist in warehouse
- `expectedDate`: Optional, must be future date
- `notes`: Optional, string, max 500 characters
- `orderItems`: Required, array with at least one item
  - `productId`: Required, must exist in warehouse
  - `quantity`: Required, positive integer
  - `unitPrice`: Required, positive decimal
  - `locationId`: Required, must exist in warehouse

#### Response

**201 Created**

```json
{
  "success": true,
  "data": {
    "id": "order_789",
    "orderNumber": "INB-2024-002",
    "type": "INBOUND",
    "status": "PENDING",
    "supplierId": "sup_123",
    "totalAmount": 2500.0,
    "itemCount": 2,
    "expectedDate": "2024-01-20T00:00:00.000Z",
    "notes": "Standard monthly order",
    "createdAt": "2024-01-16T00:00:00.000Z",
    "updatedAt": "2024-01-16T00:00:00.000Z"
  }
}
```

#### Business Logic

- Generates unique order number (INB-YYYY-###)
- Creates order with PENDING status
- Creates order items for each product
- Calculates total amount automatically
- Validates all products and locations exist
- Logs creation event in analytics

### Create Outbound Order

**POST** `/api/orders/outbound`

Creates a new outbound order for shipping stock to customers. Automatically reserves stock. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "customerInfo": {
    "name": "XYZ Company",
    "email": "purchasing@xyzcompany.com",
    "phone": "+1-555-0002",
    "address": "456 Business Ave, Commerce City, CC 22222"
  },
  "expectedDate": "2024-01-25T00:00:00.000Z",
  "notes": "Express delivery required",
  "orderItems": [
    {
      "productId": "product_123",
      "quantity": 25,
      "unitPrice": 15.99,
      "locationId": "loc_123"
    }
  ]
}
```

#### Validation Rules

- `customerInfo`: Required object
  - `name`: Required, string, 1-100 characters
  - `email`: Optional, valid email format
  - `phone`: Optional, valid phone format
  - `address`: Optional, string, max 200 characters
- `expectedDate`: Optional, must be future date
- `notes`: Optional, string, max 500 characters
- `orderItems`: Required, array with at least one item
  - `productId`: Required, must exist in warehouse
  - `quantity`: Required, positive integer, must not exceed available stock
  - `unitPrice`: Required, positive decimal
  - `locationId`: Required, must exist in warehouse and have sufficient stock

#### Response

**201 Created**

```json
{
  "success": true,
  "data": {
    "id": "order_890",
    "orderNumber": "OUT-2024-002",
    "type": "OUTBOUND",
    "status": "PENDING",
    "customerInfo": {
      "name": "XYZ Company",
      "email": "purchasing@xyzcompany.com",
      "phone": "+1-555-0002",
      "address": "456 Business Ave, Commerce City, CC 22222"
    },
    "totalAmount": 399.75,
    "itemCount": 1,
    "expectedDate": "2024-01-25T00:00:00.000Z",
    "notes": "Express delivery required",
    "reservedStock": [
      {
        "productId": "product_123",
        "locationId": "loc_123",
        "quantity": 25
      }
    ],
    "createdAt": "2024-01-16T00:00:00.000Z",
    "updatedAt": "2024-01-16T00:00:00.000Z"
  }
}
```

#### Business Logic

- Generates unique order number (OUT-YYYY-###)
- Creates order with PENDING status
- Validates sufficient stock availability
- Automatically reserves stock for order items
- Creates order items with location assignments
- Calculates total amount automatically
- Logs creation and stock reservation events

### Update Order Status

**PATCH** `/api/orders/:id/status`

Updates the status of an order with automatic stock management. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "status": "COMPLETED",
  "notes": "Order received in good condition"
}
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "order_123",
    "status": "COMPLETED",
    "completedDate": "2024-01-16T14:30:00.000Z",
    "notes": "Order received in good condition",
    "stockUpdates": [
      {
        "productId": "product_123",
        "locationId": "loc_123",
        "quantityChanged": 100,
        "newStock": 145
      }
    ]
  }
}
```

#### Business Logic

**INBOUND Orders:**

- PENDING → IN_TRANSIT: No stock changes
- IN_TRANSIT → COMPLETED: Adds stock to specified locations
- Any → CANCELLED: No stock changes (order not yet received)

**OUTBOUND Orders:**

- PENDING → IN_TRANSIT: No additional changes (stock already reserved)
- IN_TRANSIT → COMPLETED: Removes reserved stock from locations
- Any → CANCELLED: Releases reserved stock back to available

### Cancel Order

**DELETE** `/api/orders/:id`

Cancels an order and releases any stock reservations. Requires MANAGER or OWNER role.

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
  "message": "Order cancelled successfully",
  "data": {
    "id": "order_123",
    "status": "CANCELLED",
    "cancelledDate": "2024-01-16T16:00:00.000Z",
    "stockReleased": [
      {
        "productId": "product_123",
        "locationId": "loc_123",
        "quantityReleased": 25
      }
    ]
  }
}
```

#### Business Logic

- Sets order status to CANCELLED
- Releases any reserved stock (OUTBOUND orders)
- Creates stock movement records for audit trail
- Logs cancellation event in analytics
- Preserves order data for historical records

### Get Order Analytics

**GET** `/api/orders/analytics`

Returns order analytics and trends for the warehouse.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `period` (optional): Time period (7d, 30d, 90d, 1y), default 30d
- `type` (optional): Filter by order type (INBOUND/OUTBOUND)

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalOrders": 156,
      "inboundOrders": 89,
      "outboundOrders": 67,
      "totalValue": 125750.5,
      "averageOrderValue": 806.09,
      "completionRate": 92.3
    },
    "trends": [
      {
        "date": "2024-01-01",
        "inboundOrders": 4,
        "outboundOrders": 3,
        "inboundValue": 1250.0,
        "outboundValue": 875.5
      }
    ],
    "topProducts": [
      {
        "productId": "product_123",
        "productName": "LED Strip",
        "orderedQuantity": 500,
        "orderCount": 12,
        "totalValue": 7500.0
      }
    ],
    "topSuppliers": [
      {
        "supplierId": "sup_123",
        "supplierName": "TechnoSupply Corp",
        "orderCount": 25,
        "totalValue": 31250.0
      }
    ]
  }
}
```

## Stock Management Integration

### Automatic Stock Updates

1. **INBOUND Completion**: Adds stock to specified locations
2. **OUTBOUND Creation**: Reserves stock from available inventory
3. **OUTBOUND Completion**: Removes reserved stock from locations
4. **Order Cancellation**: Releases reserved stock back to available

### Stock Validation

1. **OUTBOUND Orders**: Validates sufficient available stock before creation
2. **Location Verification**: Ensures specified locations exist and have capacity
3. **Product Validation**: Confirms products belong to the warehouse
4. **Reservation System**: Prevents overselling through stock reservations

### Audit Trail

1. **Stock Movements**: Every order creates detailed movement records
2. **Event Logging**: All order operations logged in analytics
3. **Historical Data**: Complete order history preserved for compliance
4. **Traceability**: Full traceability from order to stock location

## Business Logic

### Order Lifecycle

1. **Creation**: Validates data, creates order, reserves stock (if OUTBOUND)
2. **Processing**: Status updates with appropriate stock management
3. **Completion**: Final stock adjustments and movement recording
4. **Cancellation**: Stock reservation cleanup and audit logging

### Numbering System

- **INBOUND**: INB-YYYY-### (e.g., INB-2024-001)
- **OUTBOUND**: OUT-YYYY-### (e.g., OUT-2024-001)
- Sequential numbering within each year and type

### Access Control

- **WORKER**: Read-only access to orders
- **MANAGER/OWNER**: Full CRUD operations on orders

## Error Responses

**400 Bad Request** - Invalid data or insufficient stock

```json
{
  "success": false,
  "message": "Insufficient stock",
  "errors": ["Product LED Strip only has 15 available, requested 25"]
}
```

**403 Forbidden** - Insufficient permissions

```json
{
  "success": false,
  "message": "Insufficient permissions. MANAGER role required."
}
```

**404 Not Found** - Order not found

```json
{
  "success": false,
  "message": "Order not found"
}
```

**409 Conflict** - Invalid status transition

```json
{
  "success": false,
  "message": "Cannot change status from COMPLETED to PENDING"
}
```
