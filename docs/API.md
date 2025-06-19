# Warely API Documentation

## Overview

Warely is a comprehensive warehouse management system with multi-warehouse support, role-based access control, and comprehensive inventory tracking. All API endpoints require authentication via Auth0 JWT tokens, and most endpoints are scoped to specific warehouses.

## Base URL

```
http://localhost:5000
```

## Authentication

All API endpoints (except health checks) require authentication using Auth0 JWT tokens.

### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: <warehouse_id>  // Required for warehouse-scoped operations
```

### User Roles

- **WORKER**: Basic operations, read access
- **MANAGER**: Can manage products, orders, categories, suppliers
- **OWNER**: Full control including user management and warehouse settings

## Common Response Format

### Success Response

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

### Error Response

```json
{
  "success": false,
  "message": "Error description",
  "errors": ["Detailed error messages"]
}
```

## API Endpoints

### [Authentication & Users](./auth-users.md)

- User authentication and profile management
- Auto-creation of users from Auth0 tokens

### [Warehouses](./warehouses.md)

- Warehouse CRUD operations
- Multi-warehouse management
- User access and role management

### [Products](./products.md)

- Product inventory management
- Stock tracking with reserved stock
- Barcode lookup functionality

### [Categories](./categories.md)

- Product categorization
- Warehouse-scoped category management

### [Suppliers](./suppliers.md)

- Supplier management
- Warehouse-scoped suppliers

### [Orders](./orders.md)

- INBOUND orders (from suppliers)
- OUTBOUND orders (to customers)
- Automatic stock updates and reservations

### [Locations](./locations.md)

- Location-based stock tracking
- Stock movements and transfers
- Audit trails for inventory changes

### [Warehouse Users](./warehouse-users.md)

- Team management within warehouses
- Role assignments and permissions

### [Analytics](./analytics.md)

- Event tracking and analytics
- Performance metrics

## Rate Limiting

API requests are rate limited to 100 requests per 15 minutes per IP address.

## CORS

The API supports CORS for the following origins:

- `http://localhost:3000` (Development frontend)
- `http://localhost:3001` (Alternative dev port)
- `http://frontend:3000` (Docker container)

## Error Codes

| Code | Description                              |
| ---- | ---------------------------------------- |
| 400  | Bad Request - Invalid input data         |
| 401  | Unauthorized - Missing or invalid token  |
| 403  | Forbidden - Insufficient permissions     |
| 404  | Not Found - Resource not found           |
| 409  | Conflict - Resource already exists       |
| 422  | Unprocessable Entity - Validation errors |
| 429  | Too Many Requests - Rate limit exceeded  |
| 500  | Internal Server Error                    |

## Validation

All endpoints use Zod for request validation. Validation errors return detailed error messages with field-specific information.

## Pagination

Where applicable, endpoints support pagination with the following query parameters:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50, max: 100)

## Filtering and Sorting

Most list endpoints support filtering and sorting via query parameters. Specific parameters are documented in individual endpoint sections.
