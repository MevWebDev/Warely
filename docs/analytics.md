# Analytics API

## Overview

The analytics API provides comprehensive event tracking and business intelligence for warehouse operations. It captures detailed analytics events across all system operations and provides aggregated insights for decision-making. All analytics are warehouse-scoped and support flexible time-based filtering.

## Base URL

```
/api/analytics
```

## Event Types

The system automatically tracks various event types:

- **USER_ACTION**: User interactions (login, logout, role changes)
- **INVENTORY_CHANGE**: Stock movements, product changes
- **ORDER_ACTIVITY**: Order creation, status changes, fulfillment
- **WAREHOUSE_OPERATION**: Location changes, transfers, adjustments
- **SYSTEM_EVENT**: Automated processes, integrations, errors

## Endpoints

### Track Custom Event

**POST** `/api/analytics/events`

Records a custom analytics event. All system operations automatically generate events, but this endpoint allows tracking additional custom events.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
Content-Type: application/json
```

#### Request Body

```json
{
  "eventType": "USER_ACTION",
  "action": "PRODUCT_SEARCH",
  "entityType": "PRODUCT",
  "entityId": "product_123",
  "metadata": {
    "searchTerm": "arduino",
    "resultsCount": 5,
    "responseTime": 150
  }
}
```

#### Validation Rules

- `eventType`: Required, enum (USER_ACTION/INVENTORY_CHANGE/ORDER_ACTIVITY/WAREHOUSE_OPERATION/SYSTEM_EVENT)
- `action`: Required, string, describes the specific action taken
- `entityType`: Optional, string, type of entity involved (PRODUCT/ORDER/LOCATION/USER)
- `entityId`: Optional, string, ID of the specific entity
- `metadata`: Optional, object, additional event-specific data

#### Response

**201 Created**

```json
{
  "success": true,
  "data": {
    "id": "event_123",
    "eventType": "USER_ACTION",
    "action": "PRODUCT_SEARCH",
    "entityType": "PRODUCT",
    "entityId": "product_123",
    "userId": "user_456",
    "warehouseId": "warehouse_123",
    "metadata": {
      "searchTerm": "arduino",
      "resultsCount": 5,
      "responseTime": 150
    },
    "timestamp": "2024-01-16T15:30:00.000Z",
    "createdAt": "2024-01-16T15:30:00.000Z"
  }
}
```

### Get Analytics Dashboard

**GET** `/api/analytics/dashboard`

Returns comprehensive dashboard metrics for the warehouse including key performance indicators and trends.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `period` (optional): Time period (24h, 7d, 30d, 90d, 1y), default 30d
- `timezone` (optional): Timezone for date grouping, default UTC

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "period": "30d",
    "summary": {
      "totalEvents": 2456,
      "activeUsers": 8,
      "ordersProcessed": 45,
      "stockMovements": 234,
      "inventoryValue": 125750.5,
      "utilizationRate": 78.5
    },
    "trends": {
      "dailyActivity": [
        {
          "date": "2024-01-16",
          "events": 89,
          "users": 6,
          "orders": 3,
          "movements": 12
        }
      ],
      "userActivity": [
        {
          "userId": "user_456",
          "name": "Jane Smith",
          "events": 156,
          "lastActive": "2024-01-16T15:30:00.000Z"
        }
      ],
      "popularActions": [
        {
          "action": "VIEW_PRODUCT",
          "count": 567,
          "percentage": 23.1
        },
        {
          "action": "STOCK_TRANSFER",
          "count": 234,
          "percentage": 9.5
        }
      ]
    },
    "inventory": {
      "totalProducts": 456,
      "lowStockItems": 12,
      "outOfStockItems": 3,
      "topMovingProducts": [
        {
          "productId": "product_123",
          "name": "LED Strip",
          "movements": 45,
          "totalQuantity": 1250
        }
      ]
    },
    "orders": {
      "inboundOrders": 28,
      "outboundOrders": 17,
      "completionRate": 94.4,
      "averageProcessingTime": "2.3 days"
    }
  }
}
```

### Get Event History

**GET** `/api/analytics/events`

Returns paginated event history with filtering options.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `page` (optional): Page number, default 1
- `limit` (optional): Items per page, default 50, max 200
- `eventType` (optional): Filter by event type
- `action` (optional): Filter by specific action
- `userId` (optional): Filter by user who performed action
- `entityType` (optional): Filter by entity type
- `entityId` (optional): Filter by specific entity ID
- `dateFrom` (optional): Filter from date (ISO 8601)
- `dateTo` (optional): Filter to date (ISO 8601)

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "event_456",
        "eventType": "INVENTORY_CHANGE",
        "action": "STOCK_TRANSFER",
        "entityType": "PRODUCT",
        "entityId": "product_123",
        "userId": "user_456",
        "user": {
          "id": "user_456",
          "name": "Jane Smith"
        },
        "metadata": {
          "fromLocationId": "loc_456",
          "toLocationId": "loc_123",
          "quantity": 25,
          "reason": "Consolidating inventory"
        },
        "timestamp": "2024-01-16T14:30:00.000Z",
        "createdAt": "2024-01-16T14:30:00.000Z"
      },
      {
        "id": "event_789",
        "eventType": "ORDER_ACTIVITY",
        "action": "ORDER_COMPLETED",
        "entityType": "ORDER",
        "entityId": "order_123",
        "userId": "user_123",
        "user": {
          "id": "user_123",
          "name": "John Doe"
        },
        "metadata": {
          "orderType": "INBOUND",
          "orderNumber": "INB-2024-001",
          "totalAmount": 1250.0,
          "itemCount": 3
        },
        "timestamp": "2024-01-16T10:15:00.000Z",
        "createdAt": "2024-01-16T10:15:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 2456,
      "pages": 50
    }
  }
}
```

### Get User Activity Report

**GET** `/api/analytics/users/:userId/activity`

Returns detailed activity report for a specific user.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `period` (optional): Time period (24h, 7d, 30d, 90d), default 30d

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "userId": "user_456",
    "user": {
      "id": "user_456",
      "name": "Jane Smith",
      "email": "jane.smith@example.com"
    },
    "period": "30d",
    "summary": {
      "totalEvents": 156,
      "activeDays": 18,
      "averageEventsPerDay": 8.7,
      "firstActivity": "2024-01-01T09:00:00.000Z",
      "lastActivity": "2024-01-16T15:30:00.000Z"
    },
    "actionBreakdown": [
      {
        "action": "VIEW_PRODUCT",
        "count": 45,
        "percentage": 28.8
      },
      {
        "action": "STOCK_TRANSFER",
        "count": 23,
        "percentage": 14.7
      },
      {
        "action": "CREATE_ORDER",
        "count": 12,
        "percentage": 7.7
      }
    ],
    "dailyActivity": [
      {
        "date": "2024-01-16",
        "events": 12,
        "timeSpent": "4.5 hours",
        "topActions": ["VIEW_PRODUCT", "STOCK_TRANSFER"]
      }
    ],
    "productivity": {
      "ordersCreated": 12,
      "stockMovements": 23,
      "productsAdded": 5,
      "issuesResolved": 3
    }
  }
}
```

### Get Product Analytics

**GET** `/api/analytics/products/:productId`

Returns detailed analytics for a specific product including movement patterns and usage trends.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `period` (optional): Time period (30d, 90d, 1y), default 90d

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "productId": "product_123",
    "product": {
      "id": "product_123",
      "name": "LED Strip",
      "sku": "LED-001",
      "currentStock": 145
    },
    "period": "90d",
    "movements": {
      "totalInbound": 500,
      "totalOutbound": 355,
      "netChange": 145,
      "turnoverRate": 2.4,
      "averageMonthlyMovement": 118
    },
    "orders": {
      "inboundOrders": 8,
      "outboundOrders": 15,
      "averageOrderQuantity": 23.7,
      "totalOrderValue": 8450.0
    },
    "trends": [
      {
        "month": "2024-01",
        "inbound": 150,
        "outbound": 125,
        "endingStock": 145
      }
    ],
    "locations": [
      {
        "locationId": "loc_123",
        "locationName": "A-01-01",
        "quantity": 95,
        "lastMovement": "2024-01-16T14:30:00.000Z"
      }
    ],
    "insights": [
      {
        "type": "TREND",
        "message": "Stock levels trending upward over past 30 days"
      },
      {
        "type": "ALERT",
        "message": "Product movement frequency above average"
      }
    ]
  }
}
```

### Get Warehouse Performance

**GET** `/api/analytics/performance`

Returns comprehensive warehouse performance metrics and operational efficiency indicators.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `period` (optional): Time period (30d, 90d, 1y), default 90d
- `includeComparisons` (optional): Include period-over-period comparisons, default true

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "period": "90d",
    "efficiency": {
      "orderFulfillmentRate": 94.2,
      "averagePickingTime": "12.5 minutes",
      "stockAccuracy": 98.7,
      "locationUtilization": 78.5,
      "inventoryTurnover": 4.2
    },
    "capacity": {
      "totalLocations": 150,
      "utilizationRate": 78.5,
      "topUtilizedLocations": [
        {
          "locationId": "loc_123",
          "name": "A-01-01",
          "utilization": 95.2
        }
      ],
      "underutilizedLocations": [
        {
          "locationId": "loc_789",
          "name": "C-05-10",
          "utilization": 12.3
        }
      ]
    },
    "financial": {
      "inventoryValue": 125750.5,
      "totalOrderValue": 45250.0,
      "costOfGoodsSold": 28350.0,
      "grossMargin": 37.4
    },
    "trends": {
      "monthlyOrderVolume": [
        {
          "month": "2024-01",
          "inbound": 28,
          "outbound": 17,
          "value": 15750.0
        }
      ],
      "stockLevels": [
        {
          "date": "2024-01-16",
          "totalStock": 12450,
          "value": 125750.5
        }
      ]
    },
    "comparisons": {
      "orderVolume": {
        "current": 45,
        "previous": 38,
        "change": 18.4,
        "trend": "UP"
      },
      "fulfillmentRate": {
        "current": 94.2,
        "previous": 91.8,
        "change": 2.4,
        "trend": "UP"
      }
    }
  }
}
```

### Export Analytics Data

**GET** `/api/analytics/export`

Exports analytics data in various formats for external analysis and reporting.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: warehouse_123
```

#### Query Parameters

- `format` (optional): Export format (csv, json, xlsx), default csv
- `type` (optional): Data type (events, dashboard, performance), default events
- `period` (optional): Time period (7d, 30d, 90d, 1y), default 30d
- `dateFrom` (optional): Custom start date (ISO 8601)
- `dateTo` (optional): Custom end date (ISO 8601)

#### Response

**200 OK**

```
Content-Type: application/csv / application/json / application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="warehouse_analytics_2024-01-16.csv"

timestamp,eventType,action,entityType,entityId,userId,userName
2024-01-16T15:30:00.000Z,USER_ACTION,VIEW_PRODUCT,PRODUCT,product_123,user_456,Jane Smith
2024-01-16T14:30:00.000Z,INVENTORY_CHANGE,STOCK_TRANSFER,PRODUCT,product_123,user_456,Jane Smith
...
```

## Automatic Event Tracking

The system automatically tracks events for all major operations:

### User Actions

- LOGIN, LOGOUT
- VIEW_PRODUCT, EDIT_PRODUCT, CREATE_PRODUCT
- VIEW_ORDER, CREATE_ORDER, UPDATE_ORDER_STATUS
- SEARCH_INVENTORY, FILTER_PRODUCTS

### Inventory Changes

- STOCK_TRANSFER, STOCK_ADJUSTMENT
- INBOUND_RECEIVED, OUTBOUND_SHIPPED
- LOCATION_CREATED, LOCATION_UPDATED

### Order Activities

- ORDER_CREATED, ORDER_UPDATED, ORDER_COMPLETED, ORDER_CANCELLED
- RESERVATION_CREATED, RESERVATION_RELEASED

### Warehouse Operations

- USER_INVITED, USER_ROLE_CHANGED, USER_REMOVED
- WAREHOUSE_CREATED, WAREHOUSE_UPDATED
- SETTINGS_CHANGED, INTEGRATION_CONFIGURED

## Business Logic

### Event Processing

1. **Real-time Capture**: Events captured immediately when actions occur
2. **Metadata Enrichment**: Additional context added automatically
3. **User Attribution**: All events linked to performing user
4. **Timestamp Precision**: Microsecond precision for accurate sequencing

### Data Aggregation

1. **Real-time Calculations**: Dashboard metrics updated in real-time
2. **Efficient Queries**: Pre-aggregated data for common time periods
3. **Trend Analysis**: Automatic trend detection and pattern recognition
4. **Comparative Analysis**: Period-over-period comparisons

### Performance Optimization

1. **Async Processing**: Non-critical events processed asynchronously
2. **Data Retention**: Configurable retention policies for different event types
3. **Indexing Strategy**: Optimized indexes for common query patterns
4. **Caching Layer**: Frequently accessed metrics cached for performance

## Common Use Cases

### Operational Monitoring

- Track daily warehouse activities and productivity
- Monitor user performance and identify training needs
- Identify operational bottlenecks and inefficiencies
- Generate compliance reports and audit trails

### Business Intelligence

- Analyze inventory turnover and demand patterns
- Optimize warehouse layout and location utilization
- Track key performance indicators and trends
- Support data-driven decision making

### Continuous Improvement

- Identify process optimization opportunities
- Monitor the impact of operational changes
- Benchmark performance against industry standards
- Generate insights for strategic planning

## Error Responses

**400 Bad Request** - Invalid event data

```json
{
  "success": false,
  "message": "Validation error",
  "errors": ["eventType is required"]
}
```

**403 Forbidden** - Insufficient permissions

```json
{
  "success": false,
  "message": "Insufficient permissions to access analytics"
}
```

**429 Too Many Requests** - Rate limit exceeded

```json
{
  "success": false,
  "message": "Analytics rate limit exceeded. Please try again later."
}
```
