# Locations API

## Overview

The locations API manages physical storage locations within warehouses and tracks stock movements between locations. It provides detailed audit trails for all stock transfers and supports flexible location hierarchies for efficient warehouse organization.

## Base URL

```
/api/locations
```

## Endpoints

### Get All Locations

**GET** `/api/locations`

Returns all locations in the specified warehouse with current stock information.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `includeEmpty` (optional): Include locations with zero stock, default true
- `search` (optional): Search in location name or barcode
- `hasStock` (optional): Filter locations that have stock (true/false)

#### Response

**200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "loc_123",
      "name": "A-01-01",
      "barcode": "LOC123456789",
      "type": "SHELF",
      "description": "Aisle A, Row 1, Position 1",
      "capacity": 1000,
      "currentStock": 245,
      "productCount": 3,
      "lastActivity": "2024-01-15T14:30:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T14:30:00.000Z"
    },
    {
      "id": "loc_456",
      "name": "B-02-03",
      "barcode": "LOC456789123",
      "type": "BIN",
      "description": "Aisle B, Row 2, Bin 3",
      "capacity": 500,
      "currentStock": 67,
      "productCount": 1,
      "lastActivity": "2024-01-14T09:15:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-14T09:15:00.000Z"
    }
  ]
}
```

### Get Location by ID

**GET** `/api/locations/:id`

Returns detailed information about a specific location including stock breakdown by product.

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
    "id": "loc_123",
    "name": "A-01-01",
    "barcode": "LOC123456789",
    "type": "SHELF",
    "description": "Aisle A, Row 1, Position 1",
    "capacity": 1000,
    "currentStock": 245,
    "availableCapacity": 755,
    "utilizationPercentage": 24.5,
    "productCount": 3,
    "stockByProduct": [
      {
        "productId": "product_123",
        "product": {
          "id": "product_123",
          "name": "LED Strip",
          "sku": "LED-001",
          "barcode": "1234567890123"
        },
        "quantity": 150,
        "reservedQuantity": 10,
        "availableQuantity": 140,
        "lastMovement": "2024-01-15T14:30:00.000Z"
      },
      {
        "productId": "product_456",
        "product": {
          "id": "product_456",
          "name": "Arduino Uno",
          "sku": "ARD-UNO-001",
          "barcode": "9876543210987"
        },
        "quantity": 95,
        "reservedQuantity": 5,
        "availableQuantity": 90,
        "lastMovement": "2024-01-14T11:20:00.000Z"
      }
    ],
    "recentMovements": [
      {
        "id": "movement_123",
        "productId": "product_123",
        "fromLocationId": "loc_456",
        "fromLocationName": "B-02-03",
        "toLocationId": "loc_123",
        "toLocationName": "A-01-01",
        "quantity": 25,
        "type": "TRANSFER",
        "reason": "Stock reorganization",
        "performedBy": "user_123",
        "performedByName": "John Doe",
        "createdAt": "2024-01-15T14:30:00.000Z"
      }
    ],
    "lastActivity": "2024-01-15T14:30:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T14:30:00.000Z"
  }
}
```

### Get Location by Barcode

**GET** `/api/locations/barcode/:barcode`

Looks up a location by its barcode. Useful for barcode scanning applications.

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
    "id": "loc_123",
    "name": "A-01-01",
    "barcode": "LOC123456789",
    "type": "SHELF",
    "currentStock": 245,
    "capacity": 1000,
    "availableCapacity": 755
  }
}
```

### Create Location

**POST** `/api/locations`

Creates a new storage location in the warehouse. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "C-03-05",
  "barcode": "LOC789123456",
  "type": "PALLET",
  "description": "Aisle C, Row 3, Pallet Position 5",
  "capacity": 2000
}
```

#### Validation Rules

- `name`: Required, string, 1-50 characters, unique within warehouse
- `barcode`: Optional, string, unique within warehouse if provided
- `type`: Required, enum (SHELF, BIN, PALLET, FLOOR, RACK)
- `description`: Optional, string, max 200 characters
- `capacity`: Optional, positive integer, default 1000

#### Response

**201 Created**

```json
{
  "success": true,
  "data": {
    "id": "loc_789",
    "name": "C-03-05",
    "barcode": "LOC789123456",
    "type": "PALLET",
    "description": "Aisle C, Row 3, Pallet Position 5",
    "capacity": 2000,
    "currentStock": 0,
    "productCount": 0,
    "warehouseId": "warehouse_123",
    "createdAt": "2024-01-16T00:00:00.000Z",
    "updatedAt": "2024-01-16T00:00:00.000Z"
  }
}
```

#### Business Logic

- Validates name and barcode uniqueness within warehouse
- Automatically associates with current warehouse
- Initializes with zero stock
- Logs creation event in analytics

### Update Location

**PUT** `/api/locations/:id`

Updates location information. Stock cannot be modified directly through this endpoint. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "C-03-05-UPDATED",
  "description": "Updated description for location",
  "capacity": 2500
}
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "loc_789",
    "name": "C-03-05-UPDATED",
    "description": "Updated description for location",
    "capacity": 2500,
    "updatedAt": "2024-01-16T12:00:00.000Z"
  }
}
```

### Delete Location

**DELETE** `/api/locations/:id`

Deletes a location. Only empty locations (zero stock) can be deleted. Requires MANAGER or OWNER role.

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
  "message": "Location deleted successfully"
}
```

#### Business Logic

- Validates location is empty (no current stock)
- Preserves historical stock movement data
- Logs deletion event in analytics
- Cannot delete if location has active stock

### Transfer Stock Between Locations

**POST** `/api/locations/transfer`

Transfers stock from one location to another within the warehouse. Requires WORKER, MANAGER, or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "productId": "product_123",
  "fromLocationId": "loc_456",
  "toLocationId": "loc_123",
  "quantity": 25,
  "reason": "Consolidating inventory for easier access"
}
```

#### Validation Rules

- `productId`: Required, must exist in warehouse
- `fromLocationId`: Required, must exist in warehouse and have sufficient stock
- `toLocationId`: Required, must exist in warehouse and have sufficient capacity
- `quantity`: Required, positive integer, cannot exceed available stock
- `reason`: Optional, string, max 200 characters

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "movementId": "movement_456",
    "productId": "product_123",
    "productName": "LED Strip",
    "fromLocation": {
      "id": "loc_456",
      "name": "B-02-03",
      "newStock": 70
    },
    "toLocation": {
      "id": "loc_123",
      "name": "A-01-01",
      "newStock": 175
    },
    "quantity": 25,
    "reason": "Consolidating inventory for easier access",
    "performedBy": "user_123",
    "performedAt": "2024-01-16T15:45:00.000Z"
  }
}
```

#### Business Logic

- Validates sufficient stock in source location
- Validates sufficient capacity in destination location
- Creates stock movement record for audit trail
- Updates stock quantities in both locations atomically
- Logs transfer event in analytics
- Records user who performed the transfer

### Get Stock Movements

**GET** `/api/locations/movements`

Returns paginated list of stock movements with filtering options.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 20, max 100
- `productId` (optional): Filter by product
- `locationId` (optional): Filter by location (from or to)
- `type` (optional): Filter by movement type (INBOUND/OUTBOUND/TRANSFER/ADJUSTMENT)
- `dateFrom` (optional): Filter from date (ISO 8601)
- `dateTo` (optional): Filter to date (ISO 8601)
- `userId` (optional): Filter by user who performed movement

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "movements": [
      {
        "id": "movement_123",
        "productId": "product_123",
        "product": {
          "id": "product_123",
          "name": "LED Strip",
          "sku": "LED-001"
        },
        "fromLocationId": "loc_456",
        "fromLocation": {
          "id": "loc_456",
          "name": "B-02-03"
        },
        "toLocationId": "loc_123",
        "toLocation": {
          "id": "loc_123",
          "name": "A-01-01"
        },
        "quantity": 25,
        "type": "TRANSFER",
        "reason": "Stock reorganization",
        "orderId": null,
        "performedBy": "user_123",
        "performedByName": "John Doe",
        "createdAt": "2024-01-15T14:30:00.000Z"
      },
      {
        "id": "movement_456",
        "productId": "product_456",
        "product": {
          "id": "product_456",
          "name": "Arduino Uno",
          "sku": "ARD-UNO-001"
        },
        "fromLocationId": null,
        "fromLocation": null,
        "toLocationId": "loc_123",
        "toLocation": {
          "id": "loc_123",
          "name": "A-01-01"
        },
        "quantity": 50,
        "type": "INBOUND",
        "reason": "Order received",
        "orderId": "order_123",
        "performedBy": "user_456",
        "performedByName": "Jane Smith",
        "createdAt": "2024-01-14T10:15:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 487,
      "pages": 25
    }
  }
}
```

### Adjust Stock in Location

**POST** `/api/locations/:id/adjust`

Manually adjusts stock quantity in a location for inventory corrections. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "productId": "product_123",
  "adjustment": -5,
  "reason": "Physical count correction - damaged items removed"
}
```

#### Validation Rules

- `productId`: Required, must exist in warehouse
- `adjustment`: Required, integer (positive for increase, negative for decrease)
- `reason`: Required, string, 1-200 characters

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "movementId": "movement_789",
    "productId": "product_123",
    "productName": "LED Strip",
    "locationId": "loc_123",
    "locationName": "A-01-01",
    "adjustment": -5,
    "previousStock": 150,
    "newStock": 145,
    "reason": "Physical count correction - damaged items removed",
    "performedBy": "user_123",
    "performedAt": "2024-01-16T16:30:00.000Z"
  }
}
```

#### Business Logic

- Creates stock movement record with type ADJUSTMENT
- Updates stock quantity in the location
- Cannot reduce stock below zero
- Logs adjustment event in analytics
- Requires explicit reason for audit trail

## Movement Types

### INBOUND

- Stock entering warehouse from orders
- `fromLocationId` is null
- `toLocationId` specified

### OUTBOUND

- Stock leaving warehouse for orders
- `fromLocationId` specified
- `toLocationId` is null

### TRANSFER

- Stock moving between locations within warehouse
- Both `fromLocationId` and `toLocationId` specified

### ADJUSTMENT

- Manual stock corrections
- Single location with quantity adjustment
- Requires reason for audit compliance

## Location Types

- **SHELF**: Standard shelving units
- **BIN**: Small storage bins
- **PALLET**: Pallet storage positions
- **FLOOR**: Floor storage areas
- **RACK**: Heavy-duty racking systems

## Business Logic

### Stock Tracking

1. **Real-time Updates**: Stock levels updated immediately on movements
2. **Atomic Operations**: All stock transfers are database transactions
3. **Audit Trail**: Complete movement history for compliance
4. **Capacity Management**: Prevents exceeding location capacity

### Location Management

1. **Unique Naming**: Location names and barcodes unique within warehouse
2. **Flexible Hierarchy**: Support for various location types and structures
3. **Capacity Planning**: Track utilization and available space
4. **Usage Analytics**: Monitor location activity and efficiency

### Access Control

- **WORKER**: Can perform stock transfers and view movements
- **MANAGER/OWNER**: Full CRUD operations and stock adjustments

## Common Use Cases

### Inventory Organization

- Create logical storage hierarchy
- Optimize picking routes and efficiency
- Balance stock across locations
- Manage seasonal storage needs

### Stock Movements

- Transfer products between locations
- Consolidate inventory for efficiency
- Reorganize for better accessibility
- Balance capacity utilization

### Audit and Compliance

- Track complete movement history
- Perform physical count reconciliations
- Investigate stock discrepancies
- Support regulatory reporting

## Error Responses

**400 Bad Request** - Invalid movement or insufficient stock

```json
{
  "success": false,
  "message": "Insufficient stock",
  "errors": [
    "Location B-02-03 only has 20 units of LED Strip, cannot transfer 25"
  ]
}
```

**403 Forbidden** - Insufficient permissions

```json
{
  "success": false,
  "message": "Insufficient permissions. MANAGER role required for stock adjustments."
}
```

**404 Not Found** - Location not found

```json
{
  "success": false,
  "message": "Location not found"
}
```

**409 Conflict** - Cannot delete non-empty location

```json
{
  "success": false,
  "message": "Cannot delete location with existing stock. Transfer stock first."
}
```
