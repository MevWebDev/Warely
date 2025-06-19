# Authentication & Users API

## Overview

The authentication and user management endpoints handle Auth0 JWT token validation and automatic user creation. Users are automatically created in the database when they first authenticate with a valid Auth0 token.

## Base URL

```
/api/users
```

## Endpoints

### Get Current User

**GET** `/api/users/me`

Returns the current authenticated user's profile information.

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
    "id": "user_123",
    "auth0Id": "auth0|123456789",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://example.com/avatar.jpg",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Business Logic

- Validates JWT token via Auth0 middleware
- If user doesn't exist in database, automatically creates a new user record
- Uses Auth0 user information (sub, email, name, picture) to populate user data
- Returns existing user if already in database

#### Error Responses

**401 Unauthorized**

```json
{
  "success": false,
  "message": "Unauthorized"
}
```

**500 Internal Server Error**

```json
{
  "success": false,
  "message": "Failed to fetch user"
}
```

## Authentication Flow

1. Frontend obtains JWT token from Auth0
2. All API requests include `Authorization: Bearer <token>` header
3. Auth0 middleware validates token and extracts user information
4. If user doesn't exist in database, automatically creates user record
5. User information is attached to request object for subsequent middleware/routes

## User Auto-Creation

When a user first authenticates, the system automatically:

1. Extracts user data from Auth0 token (sub, email, name, picture)
2. Creates a new User record in the database
3. Maps Auth0 `sub` field to `auth0Id` in the database
4. Uses provided email, name, and picture from Auth0 profile

## Security Notes

- All endpoints require valid Auth0 JWT token
- Tokens are validated against Auth0 public keys
- User creation is idempotent - duplicate users are not created
- No password storage - authentication is handled entirely by Auth0
