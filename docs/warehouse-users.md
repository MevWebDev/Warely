# Warehouse Users API

## Overview

The warehouse users API manages team access and roles within warehouses. It provides comprehensive user management including invitations, role assignments, and access control. All operations are warehouse-scoped and maintain strict role hierarchies.

## Base URL

```
/api/warehouse-users
```

## Role Hierarchy

- **WORKER**: Basic access - can view data and perform stock operations
- **MANAGER**: Enhanced access - can modify data, manage inventory, cannot delete warehouse
- **OWNER**: Full access - can delete warehouse, manage all users and settings

## Endpoints

### Get Warehouse Users

**GET** `/api/warehouse-users`

Returns all users with access to the specified warehouse, including their roles and status.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `includeInvited` (optional): Include pending invitations, default true
- `role` (optional): Filter by role (WORKER/MANAGER/OWNER)
- `status` (optional): Filter by status (ACTIVE/INVITED/SUSPENDED)

#### Response

**200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": "wu_123",
      "userId": "user_123",
      "user": {
        "id": "user_123",
        "name": "John Doe",
        "email": "john.doe@example.com",
        "picture": "https://example.com/avatars/john.jpg"
      },
      "role": "OWNER",
      "status": "ACTIVE",
      "joinedAt": "2024-01-01T00:00:00.000Z",
      "lastActivity": "2024-01-16T14:30:00.000Z",
      "invitedBy": null,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-16T14:30:00.000Z"
    },
    {
      "id": "wu_456",
      "userId": "user_456",
      "user": {
        "id": "user_456",
        "name": "Jane Smith",
        "email": "jane.smith@example.com",
        "picture": "https://example.com/avatars/jane.jpg"
      },
      "role": "MANAGER",
      "status": "ACTIVE",
      "joinedAt": "2024-01-05T00:00:00.000Z",
      "lastActivity": "2024-01-16T12:15:00.000Z",
      "invitedBy": "user_123",
      "createdAt": "2024-01-05T00:00:00.000Z",
      "updatedAt": "2024-01-10T09:30:00.000Z"
    },
    {
      "id": "wu_789",
      "userId": null,
      "user": null,
      "email": "newuser@example.com",
      "role": "WORKER",
      "status": "INVITED",
      "joinedAt": null,
      "lastActivity": null,
      "invitedBy": "user_123",
      "invitedAt": "2024-01-15T10:00:00.000Z",
      "inviteToken": "inv_abc123def456",
      "inviteExpiresAt": "2024-01-22T10:00:00.000Z",
      "createdAt": "2024-01-15T10:00:00.000Z",
      "updatedAt": "2024-01-15T10:00:00.000Z"
    }
  ]
}
```

### Get Warehouse User by ID

**GET** `/api/warehouse-users/:id`

Returns detailed information about a specific warehouse user including their activity history.

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
    "id": "wu_456",
    "userId": "user_456",
    "user": {
      "id": "user_456",
      "name": "Jane Smith",
      "email": "jane.smith@example.com",
      "picture": "https://example.com/avatars/jane.jpg",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "role": "MANAGER",
    "status": "ACTIVE",
    "joinedAt": "2024-01-05T00:00:00.000Z",
    "lastActivity": "2024-01-16T12:15:00.000Z",
    "invitedBy": "user_123",
    "invitedByName": "John Doe",
    "activityStats": {
      "ordersCreated": 15,
      "stockMovements": 67,
      "productsAdded": 8,
      "lastLogin": "2024-01-16T08:00:00.000Z"
    },
    "permissions": [
      "VIEW_INVENTORY",
      "MODIFY_INVENTORY",
      "CREATE_ORDERS",
      "MANAGE_LOCATIONS",
      "VIEW_ANALYTICS"
    ],
    "createdAt": "2024-01-05T00:00:00.000Z",
    "updatedAt": "2024-01-10T09:30:00.000Z"
  }
}
```

### Invite User to Warehouse

**POST** `/api/warehouse-users/invite`

Invites a new user to join the warehouse with a specified role. Only MANAGER and OWNER can invite users. Requires MANAGER or OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "email": "newuser@example.com",
  "role": "WORKER"
}
```

#### Validation Rules

- `email`: Required, valid email format, not already member of warehouse
- `role`: Required, enum (WORKER/MANAGER), OWNER can only be assigned during warehouse creation

#### Response

**201 Created**

```json
{
  "success": true,
  "data": {
    "id": "wu_890",
    "email": "newuser@example.com",
    "role": "WORKER",
    "status": "INVITED",
    "invitedBy": "user_123",
    "invitedAt": "2024-01-16T15:00:00.000Z",
    "inviteToken": "inv_xyz789abc123",
    "inviteExpiresAt": "2024-01-23T15:00:00.000Z",
    "inviteLink": "https://warely.com/join/inv_xyz789abc123",
    "createdAt": "2024-01-16T15:00:00.000Z"
  }
}
```

#### Business Logic

- Generates unique invitation token valid for 7 days
- Checks if email is already registered user or pending invite
- Creates pending WarehouseUser record with INVITED status
- Sends invitation email with join link
- Logs invitation event in analytics

### Accept Warehouse Invitation

**POST** `/api/warehouse-users/accept/:token`

Accepts a warehouse invitation using the invitation token. Available to any authenticated user.

#### Headers

```
Authorization: Bearer <jwt_token>
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "wu_890",
    "userId": "user_890",
    "warehouseId": "warehouse_123",
    "warehouse": {
      "id": "warehouse_123",
      "name": "Main Warehouse"
    },
    "role": "WORKER",
    "status": "ACTIVE",
    "joinedAt": "2024-01-16T16:30:00.000Z",
    "createdAt": "2024-01-16T15:00:00.000Z",
    "updatedAt": "2024-01-16T16:30:00.000Z"
  }
}
```

#### Business Logic

- Validates invitation token and expiration
- Links invitation to current authenticated user
- Updates status from INVITED to ACTIVE
- Sets joinedAt timestamp
- Logs acceptance event in analytics
- Grants immediate access to warehouse

### Update User Role

**PATCH** `/api/warehouse-users/:id/role`

Updates a user's role within the warehouse. Role hierarchy restrictions apply. Requires OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "role": "MANAGER"
}
```

#### Validation Rules

- `role`: Required, enum (WORKER/MANAGER)
- Cannot change OWNER role (only one OWNER per warehouse)
- Cannot change your own role
- Only OWNER can modify roles

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "wu_456",
    "userId": "user_456",
    "role": "MANAGER",
    "previousRole": "WORKER",
    "updatedBy": "user_123",
    "updatedAt": "2024-01-16T17:00:00.000Z"
  }
}
```

#### Business Logic

- Validates role hierarchy and permissions
- Prevents OWNER from changing their own role
- Updates user's role and permissions
- Logs role change event in analytics
- Notifies user of role change

### Remove User from Warehouse

**DELETE** `/api/warehouse-users/:id`

Removes a user from the warehouse or cancels a pending invitation. Requires OWNER role.

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
  "message": "User removed from warehouse successfully",
  "data": {
    "id": "wu_456",
    "userId": "user_456",
    "userName": "Jane Smith",
    "previousRole": "MANAGER",
    "removedBy": "user_123",
    "removedAt": "2024-01-16T17:30:00.000Z"
  }
}
```

#### Business Logic

- Cannot remove the last OWNER from warehouse
- Cannot remove yourself if you're the only OWNER
- Revokes all warehouse access immediately
- Preserves user activity history for audit
- Logs removal event in analytics
- Notifies removed user

### Get User Permissions

**GET** `/api/warehouse-users/me/permissions`

Returns the current user's permissions in the specified warehouse.

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
    "warehouseId": "warehouse_123",
    "userId": "user_456",
    "role": "MANAGER",
    "permissions": [
      "VIEW_INVENTORY",
      "MODIFY_INVENTORY",
      "CREATE_ORDERS",
      "MANAGE_LOCATIONS",
      "VIEW_ANALYTICS",
      "MANAGE_SUPPLIERS",
      "MANAGE_CATEGORIES"
    ],
    "restrictions": ["CANNOT_DELETE_WAREHOUSE", "CANNOT_MANAGE_USERS"]
  }
}
```

### Suspend/Unsuspend User

**PATCH** `/api/warehouse-users/:id/status`

Temporarily suspends or reactivates a user's access to the warehouse. Requires OWNER role.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "status": "SUSPENDED",
  "reason": "Temporary suspension pending review"
}
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "id": "wu_456",
    "userId": "user_456",
    "status": "SUSPENDED",
    "previousStatus": "ACTIVE",
    "reason": "Temporary suspension pending review",
    "suspendedBy": "user_123",
    "suspendedAt": "2024-01-16T18:00:00.000Z"
  }
}
```

## Role-Based Permissions

### WORKER Permissions

- View inventory and stock levels
- Perform stock transfers between locations
- View orders and order history
- Create basic reports
- View warehouse analytics

### MANAGER Permissions

- All WORKER permissions plus:
- Create, edit, and delete products
- Create, edit, and delete orders
- Manage suppliers and categories
- Manage locations and stock adjustments
- Invite new WORKER users
- View detailed analytics

### OWNER Permissions

- All MANAGER permissions plus:
- Delete warehouse
- Manage all users (invite, remove, change roles)
- Change warehouse settings
- Access financial reports
- Transfer ownership (future feature)

## Business Logic

### Invitation System

1. **Token Generation**: Unique, secure tokens with 7-day expiration
2. **Email Validation**: Prevents duplicate invitations to same email
3. **Role Assignment**: Invited users get assigned role immediately upon acceptance
4. **Auto-Cleanup**: Expired invitations are automatically cleaned up

### Role Management

1. **Hierarchy Enforcement**: Higher roles can manage lower roles
2. **Owner Protection**: Cannot remove last OWNER or change own OWNER role
3. **Permission Inheritance**: Roles inherit permissions from lower levels
4. **Immediate Effect**: Role changes take effect immediately

### Access Control

1. **Warehouse Scoping**: All operations scoped to specific warehouse
2. **Real-time Validation**: Permissions checked on every request
3. **Session Management**: Role changes invalidate active sessions
4. **Audit Logging**: All user management actions logged

## Common Use Cases

### Team Onboarding

- Invite new team members with appropriate roles
- Assign permissions based on job responsibilities
- Track invitation status and follow up

### Access Management

- Adjust user roles as responsibilities change
- Temporarily suspend access when needed
- Remove users who leave the organization

### Security and Compliance

- Maintain audit trail of all user activities
- Enforce role-based access controls
- Monitor user permissions and access patterns

## Error Responses

**400 Bad Request** - Invalid invitation or role data

```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["Email already has pending invitation to this warehouse"]
}
```

**403 Forbidden** - Insufficient permissions

```json
{
  "success": false,
  "message": "Insufficient permissions. OWNER role required."
}
```

**404 Not Found** - User or invitation not found

```json
{
  "success": false,
  "message": "Warehouse user not found"
}
```

**409 Conflict** - Cannot perform action due to constraints

```json
{
  "success": false,
  "message": "Cannot remove the last OWNER from warehouse"
}
```

**410 Gone** - Invitation expired

```json
{
  "success": false,
  "message": "Invitation has expired. Please request a new invitation."
}
```
