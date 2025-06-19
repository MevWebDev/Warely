# Warehouses API

## Overview

The warehouses API handles multi-warehouse management with role-based access control. Users can create warehouses, manage access permissions, and control who can access each warehouse.

## Base URL

```
/api/warehouses
```

## Endpoints

### Get User's Warehouses

**GET** `/api/warehouses`

Returns all warehouses the authenticated user has access to, along with their role in each warehouse.

#### Headers

```
Authorization: Bearer <jwt_token>
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "warehouse_123",
      "name": "Main Warehouse",
      "address": "123 Storage St, City, State 12345",
      "phone": "+1-555-0123",
      "email": "warehouse@company.com",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "role": "OWNER"
    },
    {
      "id": "warehouse_456",
      "name": "Secondary Location",
      "address": "456 Logistics Ave, City, State 67890",
      "phone": "+1-555-0456",
      "email": "secondary@company.com",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "role": "MANAGER"
    }
  ]
}
```

### Create Warehouse

**POST** `/api/warehouses`

Creates a new warehouse and automatically assigns the creator as OWNER.

#### Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "New Warehouse",
  "address": "789 Distribution Blvd, City, State 13579",
  "phone": "+1-555-0789",
  "email": "newwarehouse@company.com"
}
```

#### Validation Rules

- `name`: Required, string, 1-100 characters
- `address`: Required, string, 1-200 characters
- `phone`: Optional, string, valid phone format
- `email`: Optional, string, valid email format

#### Response

**201 Created**

```json
{
  "success": true,
  "data": {
    "id": "warehouse_789",
    "name": "New Warehouse",
    "address": "789 Distribution Blvd, City, State 13579",
    "phone": "+1-555-0789",
    "email": "newwarehouse@company.com",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Business Logic

- Creates new warehouse record
- Automatically creates WarehouseUser record with OWNER role for creator
- OWNER role grants full access to warehouse management

### Get Warehouse Details

**GET** `/api/warehouses/:id`

Returns detailed information about a specific warehouse.

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
    "id": "warehouse_123",
    "name": "Main Warehouse",
    "address": "123 Storage St, City, State 12345",
    "phone": "+1-555-0123",
    "email": "warehouse@company.com",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Update Warehouse

**PUT** `/api/warehouses/:id`

Updates warehouse information. Only accessible to MANAGER and OWNER roles.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "Updated Warehouse Name",
  "address": "Updated Address",
  "phone": "+1-555-9999",
  "email": "updated@company.com"
}
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "warehouse_123",
    "name": "Updated Warehouse Name",
    "address": "Updated Address",
    "phone": "+1-555-9999",
    "email": "updated@company.com",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

### Delete Warehouse

**DELETE** `/api/warehouses/:id`

Permanently deletes a warehouse and all associated data. Only accessible to OWNER role.

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
  "message": "Warehouse deleted successfully"
}
```

#### Business Logic

- Performs cascade deletion of all related data:
  - Products
  - Categories
  - Suppliers
  - Orders
  - Locations
  - WarehouseUsers
  - Stock records
  - Analytics events
- Only OWNER can delete warehouse
- Irreversible operation

## Access Control

### Role Hierarchy

- **WORKER**: Read-only access to warehouse data
- **MANAGER**: Can modify warehouse data, cannot delete warehouse or manage users
- **OWNER**: Full access including warehouse deletion and user management

### Warehouse Selection

Most warehouse operations require the `X-Warehouse-Id` header to specify which warehouse the operation should target. This allows users with access to multiple warehouses to work with specific warehouse data.

## Error Responses

**400 Bad Request** - Invalid request data

```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["Name is required"]
}
```

**403 Forbidden** - Insufficient permissions

```json
{
  "success": false,
  "message": "Insufficient permissions for this warehouse"
}
```

**404 Not Found** - Warehouse not found or no access

```json
{
  "success": false,
  "message": "Warehouse not found"
}
```
