# Categories API

## Overview

The categories API manages product categorization within warehouses. Categories help organize products for better inventory management and reporting. All categories are scoped to specific warehouses and support soft deletion for audit trails.

## Base URL

```
/api/categories
```

## Endpoints

### Get All Categories

**GET** `/api/categories`

Returns all active categories in the specified warehouse.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `includeDeleted` (optional): Include soft-deleted categories, default false

#### Response

**200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "cat_123",
      "name": "Electronics",
      "description": "Electronic components and devices",
      "productCount": 45,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": "cat_456",
      "name": "Mechanical Parts",
      "description": "Screws, bolts, and mechanical components",
      "productCount": 128,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

#### Business Logic

- Returns only active (non-deleted) categories by default
- Includes product count for each category
- Ordered by name alphabetically
- Warehouse-scoped results only

### Get Category by ID

**GET** `/api/categories/:id`

Returns detailed information about a specific category including associated products.

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
    "id": "cat_123",
    "name": "Electronics",
    "description": "Electronic components and devices",
    "productCount": 45,
    "products": [
      {
        "id": "product_123",
        "name": "LED Strip",
        "sku": "LED-001",
        "currentStock": 25,
        "price": 15.99
      },
      {
        "id": "product_456",
        "name": "Arduino Uno",
        "sku": "ARD-UNO-001",
        "currentStock": 12,
        "price": 25.5
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

### Create Category

**POST** `/api/categories`

Creates a new category in the warehouse. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "Safety Equipment",
  "description": "Personal protective equipment and safety gear"
}
```

#### Validation Rules

- `name`: Required, string, 1-50 characters, unique within warehouse
- `description`: Optional, string, max 200 characters

#### Response

**201 Created**

```json
{
  "success": true,
  "data": {
    "id": "cat_789",
    "name": "Safety Equipment",
    "description": "Personal protective equipment and safety gear",
    "productCount": 0,
    "warehouseId": "warehouse_123",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Business Logic

- Validates name uniqueness within the warehouse
- Automatically associates with the current warehouse
- Initializes with zero product count
- Logs creation event in analytics

### Update Category

**PUT** `/api/categories/:id`

Updates category information. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "name": "Updated Category Name",
  "description": "Updated category description"
}
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "cat_123",
    "name": "Updated Category Name",
    "description": "Updated category description",
    "productCount": 45,
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
}
```

#### Business Logic

- Validates name uniqueness if changed
- Updates category information
- Product associations remain unchanged
- Logs update event in analytics

### Delete Category

**DELETE** `/api/categories/:id`

Soft deletes a category. Products in the category are not deleted but become uncategorized. Requires MANAGER or OWNER role.

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
  "message": "Category deleted successfully"
}
```

#### Business Logic

- Performs soft delete (sets deletedAt timestamp)
- Category remains in database for audit trail
- Products in category have categoryId set to null
- Category no longer appears in regular listings
- Logs deletion event in analytics

### Get Category Statistics

**GET** `/api/categories/:id/stats`

Returns detailed statistics about a category including stock values and trends.

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
    "categoryId": "cat_123",
    "categoryName": "Electronics",
    "totalProducts": 45,
    "totalStock": 1250,
    "totalValue": 18750.5,
    "averagePrice": 41.67,
    "lowStockProducts": 3,
    "outOfStockProducts": 1,
    "topProducts": [
      {
        "id": "product_123",
        "name": "LED Strip",
        "stock": 25,
        "value": 399.75
      }
    ]
  }
}
```

## Business Logic

### Category Management

1. **Warehouse Scoping**: All categories are isolated within their warehouse
2. **Name Uniqueness**: Category names must be unique within each warehouse
3. **Soft Deletion**: Deleted categories are preserved for audit trails
4. **Product Association**: Products can be assigned to categories for organization

### Product Count Maintenance

1. Real-time product counting in categories
2. Excludes soft-deleted products from counts
3. Updates automatically when products are created/deleted
4. Used for category statistics and reporting

### Access Control

- **WORKER**: Read-only access to categories
- **MANAGER/OWNER**: Full CRUD operations on categories

## Common Use Cases

### Inventory Organization

- Group similar products together
- Create logical product hierarchies
- Simplify product discovery and management
- Generate category-based reports

### Reporting and Analytics

- Track performance by product category
- Identify top-performing categories
- Monitor stock levels by category
- Generate category-specific insights

## Error Responses

**400 Bad Request** - Invalid data or validation errors

```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["Category name already exists in this warehouse"]
}
```

**403 Forbidden** - Insufficient permissions

```json
{
  "success": false,
  "message": "Insufficient permissions. MANAGER role required."
}
```

**404 Not Found** - Category not found

```json
{
  "success": false,
  "message": "Category not found"
}
```

**409 Conflict** - Cannot delete category with dependencies

```json
{
  "success": false,
  "message": "Cannot delete category. Move products to another category first."
}
```
