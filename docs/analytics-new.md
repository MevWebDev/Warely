# Analytics API

## Overview

The analytics API provides comprehensive analytics, reporting, and KPI tracking capabilities for warehouse operations. It includes event tracking, sales analytics, inventory insights, performance metrics, and automated report generation with support for multiple export formats.

## Base URL

```
/api/analytics
```

## Endpoints

### Track Analytics Event

**POST** `/api/analytics/track`

Tracks an analytics event for warehouse operations monitoring and data collection.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: <warehouse_id>
Content-Type: application/json
```

#### Request Body

```json
{
  "eventType": "user_action",
  "eventName": "product_created",
  "description": "New product added to inventory",
  "data": {
    "productId": 123,
    "sku": "ABC-123",
    "category": "Electronics"
  },
  "value": 1,
  "productId": 123,
  "orderId": 456,
  "supplierId": 789,
  "categoryId": 10,
  "locationId": 5
}
```

#### Validation Rules

- `eventType`: Required, string, minimum 1 character
- `eventName`: Required, string, minimum 1 character
- `description`: Optional, string
- `data`: Optional, any JSON object
- `value`: Optional, number
- `productId`: Optional, number (product reference)
- `orderId`: Optional, number (order reference)
- `supplierId`: Optional, number (supplier reference)
- `categoryId`: Optional, number (category reference)
- `locationId`: Optional, number (location reference)

#### Response

**201 Created**

```json
{
  "success": true,
  "message": "Event tracked successfully",
  "data": {
    "id": 1,
    "eventType": "user_action",
    "eventName": "product_created",
    "description": "New product added to inventory",
    "data": {
      "productId": 123,
      "sku": "ABC-123",
      "category": "Electronics"
    },
    "value": 1,
    "timestamp": "2024-01-01T12:00:00.000Z",
    "warehouseId": 1,
    "userId": 1,
    "productId": 123,
    "orderId": 456,
    "supplierId": 789,
    "categoryId": 10,
    "locationId": 5
  }
}
```

**400 Bad Request**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": ["eventType is required", "eventName must be at least 1 character"]
}
```

### Get Analytics Events

**GET** `/api/analytics/events`

Retrieves analytics events with filtering and pagination.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: <warehouse_id>
```

#### Query Parameters

- `eventType` (optional): Filter by event type
- `eventName` (optional): Filter by event name
- `startDate` (optional): Filter events from date (ISO string)
- `endDate` (optional): Filter events to date (ISO string)
- `limit` (optional): Number of results per page (default: 100)
- `page` (optional): Page number (default: 1)

#### Example Request

```
GET /api/analytics/events?eventType=user_action&startDate=2024-01-01&limit=50&page=1
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "eventType": "user_action",
      "eventName": "product_created",
      "description": "New product added to inventory",
      "data": {
        "productId": 123,
        "sku": "ABC-123"
      },
      "value": 1,
      "timestamp": "2024-01-01T12:00:00.000Z",
      "warehouseId": 1,
      "userId": 1,
      "productId": 123,
      "user": {
        "id": 1,
        "name": "John Doe",
        "email": "john@example.com"
      },
      "product": {
        "id": 123,
        "sku": "ABC-123",
        "name": "Wireless Headphones"
      },
      "order": null,
      "supplier": null,
      "category": {
        "id": 10,
        "name": "Electronics"
      },
      "location": {
        "id": 5,
        "code": "A1-B2",
        "name": "Section A1, Bin B2"
      }
    }
  ],
  "meta": {
    "currentPage": 1,
    "totalPages": 5,
    "totalCount": 250,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Get Sales Analytics

**GET** `/api/analytics/sales`

Retrieves comprehensive sales analytics including revenue metrics, top products, category performance, and time series data.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: <warehouse_id>
```

#### Query Parameters

- `startDate` (optional): Start date for analysis (ISO string)
- `endDate` (optional): End date for analysis (ISO string)
- `groupBy` (optional): Time grouping - `day` (default), `week`, `month`

#### Example Request

```
GET /api/analytics/sales?startDate=2024-01-01&endDate=2024-01-31&groupBy=week
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRevenue": 50000.0,
      "totalOrders": 125,
      "averageOrderValue": 400.0,
      "period": {
        "startDate": "2024-01-01",
        "endDate": "2024-01-31"
      }
    },
    "topProducts": [
      {
        "productId": 123,
        "name": "Wireless Headphones",
        "category": "Electronics",
        "quantity": 45,
        "revenue": 13500.0
      },
      {
        "productId": 456,
        "name": "Bluetooth Speaker",
        "category": "Electronics",
        "quantity": 32,
        "revenue": 9600.0
      }
    ],
    "categoryPerformance": [
      {
        "category": "Electronics",
        "quantity": 150,
        "revenue": 35000.0,
        "orders": 75
      },
      {
        "category": "Home & Garden",
        "quantity": 80,
        "revenue": 15000.0,
        "orders": 50
      }
    ],
    "timeSeries": [
      {
        "date": "2024-01-01",
        "orders": 25,
        "revenue": 10000.0
      },
      {
        "date": "2024-01-08",
        "orders": 30,
        "revenue": 12000.0
      }
    ]
  }
}
```

### Get Inventory Analytics

**GET** `/api/analytics/inventory`

Retrieves comprehensive inventory analytics including stock levels, alerts, category distribution, and performance metrics.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: <warehouse_id>
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "summary": {
      "totalProducts": 250,
      "totalStockValue": 125000.0,
      "averageStockLevel": 45.5,
      "lowStockCount": 12,
      "outOfStockCount": 3
    },
    "alerts": {
      "lowStock": [
        {
          "id": 123,
          "sku": "ABC-123",
          "name": "Wireless Headphones",
          "currentStock": 5,
          "reorderPoint": 10
        }
      ],
      "outOfStock": [
        {
          "id": 456,
          "sku": "DEF-456",
          "name": "Bluetooth Speaker"
        }
      ]
    },
    "categoryDistribution": [
      {
        "category": "Electronics",
        "products": 120,
        "totalStock": 5500,
        "totalValue": 75000.0
      },
      {
        "category": "Home & Garden",
        "products": 80,
        "totalStock": 3200,
        "totalValue": 35000.0
      }
    ],
    "topPerformers": [
      {
        "productId": 123,
        "sku": "ABC-123",
        "name": "Wireless Headphones",
        "currentStock": 50,
        "reservedStock": 25,
        "availableStock": 25,
        "turnoverRate": 0.5,
        "stockValue": 15000.0
      }
    ],
    "slowMovers": [
      {
        "productId": 789,
        "sku": "GHI-789",
        "name": "Legacy Product",
        "currentStock": 100,
        "reservedStock": 2,
        "availableStock": 98,
        "turnoverRate": 0.02,
        "stockValue": 5000.0
      }
    ]
  }
}
```

### Get KPI Dashboard

**GET** `/api/analytics/kpis`

Retrieves key performance indicators (KPIs) for warehouse operations including fulfillment rates, processing times, and historical data.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: <warehouse_id>
```

#### Query Parameters

- `period` (optional): KPI period - `daily`, `weekly`, `monthly` (default), `quarterly`, `yearly`
- `startDate` (optional): Start date for historical KPIs (ISO string)
- `endDate` (optional): End date for historical KPIs (ISO string)

#### Example Request

```
GET /api/analytics/kpis?period=monthly&startDate=2024-01-01&endDate=2024-03-31
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "current": {
      "fulfillmentRate": 95.5,
      "avgProcessingTime": 24.5,
      "stockAccuracy": 98.2,
      "revenueGrowth": 12.5,
      "currentRevenue": 50000.0,
      "totalOrders": 125,
      "completedOrders": 119
    },
    "historical": {
      "operations": [
        {
          "id": 1,
          "category": "operations",
          "name": "Order Fulfillment Rate",
          "value": 94.2,
          "unit": "%",
          "period": "monthly",
          "date": "2024-02-01T00:00:00.000Z"
        }
      ],
      "financial": [
        {
          "id": 2,
          "category": "financial",
          "name": "Revenue Growth",
          "value": 8.7,
          "unit": "%",
          "period": "monthly",
          "date": "2024-02-01T00:00:00.000Z"
        }
      ]
    },
    "period": "monthly"
  }
}
```

### Generate Report

**POST** `/api/analytics/reports/generate`

Generates comprehensive reports in various formats (JSON, Excel, CSV) with support for scheduling and automated delivery.

**Required Role:** MANAGER or OWNER

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: <warehouse_id>
Content-Type: application/json
```

#### Request Body

```json
{
  "type": "SALES",
  "title": "Monthly Sales Report - January 2024",
  "description": "Comprehensive sales analysis for January 2024",
  "parameters": {
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "productIds": [123, 456],
    "categoryIds": [10, 20],
    "supplierIds": [1, 2],
    "orderTypes": ["OUTBOUND"],
    "includeDetails": true
  },
  "format": "EXCEL",
  "isScheduled": false,
  "frequency": "MONTHLY"
}
```

#### Validation Rules

- `type`: Required, enum: `SALES`, `INVENTORY`, `ORDERS`, `SUPPLIERS`, `WAREHOUSE_PERFORMANCE`, `PRODUCT_PERFORMANCE`, `CUSTOM`
- `title`: Required, string, 1-255 characters
- `description`: Optional, string
- `parameters`: Optional, object with report-specific parameters
  - `startDate`: Optional, ISO date string
  - `endDate`: Optional, ISO date string
  - `productIds`: Optional, array of product IDs
  - `categoryIds`: Optional, array of category IDs
  - `supplierIds`: Optional, array of supplier IDs
  - `orderTypes`: Optional, array of `INBOUND` or `OUTBOUND`
  - `includeDetails`: Optional, boolean (default: false)
- `format`: Optional, enum: `JSON` (default), `EXCEL`, `CSV`
- `isScheduled`: Optional, boolean (default: false)
- `frequency`: Optional, enum: `DAILY`, `WEEKLY`, `MONTHLY`, `QUARTERLY`, `YEARLY`

#### Response

**200 OK**

```json
{
  "success": true,
  "message": "Report generated successfully",
  "data": {
    "report": {
      "id": 123,
      "type": "SALES",
      "title": "Monthly Sales Report - January 2024",
      "description": "Comprehensive sales analysis for January 2024",
      "status": "COMPLETED",
      "isScheduled": false,
      "frequency": null,
      "filePath": "/uploads/reports/123.xlsx",
      "fileUrl": "/reports/123.xlsx",
      "createdAt": "2024-01-31T23:59:00.000Z",
      "generatedAt": "2024-01-31T23:59:30.000Z",
      "createdBy": {
        "name": "John Doe",
        "email": "john@example.com"
      }
    },
    "reportData": {
      "summary": {
        "totalOrders": 125,
        "totalRevenue": 50000.0,
        "averageOrderValue": 400.0
      },
      "orders": []
    }
  }
}
```

**400 Bad Request**

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    "type must be one of: SALES, INVENTORY, ORDERS, SUPPLIERS, WAREHOUSE_PERFORMANCE, PRODUCT_PERFORMANCE, CUSTOM",
    "title is required"
  ]
}
```

### List Reports

**GET** `/api/analytics/reports`

Retrieves a paginated list of generated reports with filtering options.

#### Headers

```
Authorization: Bearer <jwt_token>
X-Warehouse-Id: <warehouse_id>
```

#### Query Parameters

- `type` (optional): Filter by report type
- `status` (optional): Filter by report status (`GENERATING`, `COMPLETED`, `FAILED`)
- `page` (optional): Page number (default: 1)
- `limit` (optional): Number of results per page (default: 20)

#### Example Request

```
GET /api/analytics/reports?type=SALES&status=COMPLETED&page=1&limit=10
```

#### Response

**200 OK**

```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "type": "SALES",
      "title": "Monthly Sales Report - January 2024",
      "description": "Comprehensive sales analysis for January 2024",
      "status": "COMPLETED",
      "isScheduled": false,
      "frequency": null,
      "filePath": "/uploads/reports/123.xlsx",
      "fileUrl": "/reports/123.xlsx",
      "createdAt": "2024-01-31T23:59:00.000Z",
      "generatedAt": "2024-01-31T23:59:30.000Z",
      "createdBy": {
        "name": "John Doe",
        "email": "john@example.com"
      }
    }
  ],
  "meta": {
    "currentPage": 1,
    "totalPages": 3,
    "totalCount": 25,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## Report Types

### Sales Reports (`SALES`)

- Revenue analysis by time period
- Top-performing products
- Category performance metrics
- Order trends and patterns
- Customer purchase behavior

### Inventory Reports (`INVENTORY`)

- Stock level analysis
- Low stock and out-of-stock alerts
- Category distribution
- Stock turnover rates
- Inventory valuation

### Orders Reports (`ORDERS`)

- Order processing metrics
- Inbound vs outbound analysis
- Status distribution
- Processing time analysis
- Supplier performance

### Suppliers Reports (`SUPPLIERS`)

- Supplier performance metrics
- Order history and trends
- Product catalog analysis
- Payment and delivery tracking
- Relationship management data

### Warehouse Performance Reports (`WAREHOUSE_PERFORMANCE`)

- Overall warehouse KPIs
- Operational efficiency metrics
- Resource utilization
- Processing capacity analysis
- Performance benchmarking

### Product Performance Reports (`PRODUCT_PERFORMANCE`)

- Individual product analytics
- Sales performance by product
- Stock turnover analysis
- Profitability metrics
- Lifecycle tracking

## Export Formats

### JSON Format

- Real-time data access
- API integration friendly
- Structured data format
- Immediate availability

### Excel Format

- Business-friendly format
- Advanced formatting and charts
- Multi-sheet reports
- Formula support

### CSV Format

- Simple data export
- Database import compatible
- Lightweight format
- Universal compatibility

## Key Metrics Explained

### Sales Analytics

**Total Revenue**: Sum of all completed outbound order amounts
**Average Order Value**: Total revenue divided by number of orders
**Top Products**: Products ranked by total revenue generated
**Category Performance**: Revenue and quantity metrics grouped by product category
**Time Series**: Revenue and order trends over time periods

### Inventory Analytics

**Total Stock Value**: Sum of (current stock × unit cost) for all products
**Average Stock Level**: Mean stock quantity across all products
**Turnover Rate**: Ratio of reserved stock to current stock
**Low Stock Alerts**: Products where current stock ≤ reorder point
**Out of Stock**: Products with zero current stock

### KPI Metrics

**Fulfillment Rate**: Percentage of orders completed successfully
**Average Processing Time**: Mean time from order creation to completion (hours)
**Stock Accuracy**: Percentage of products with accurate stock levels
**Revenue Growth**: Period-over-period revenue change percentage

## Business Logic

### Data Calculation

1. **Real-time Analytics**: All metrics calculated in real-time from current data
2. **Null Safety**: All calculations include null value handling
3. **Decimal Precision**: Financial values converted to numbers for accurate calculations
4. **Date Handling**: Flexible date filtering with proper timezone support

### Warehouse Scoping

1. **Access Control**: All data filtered by user's warehouse access
2. **Role-based Permissions**: Sensitive operations restricted by user role
3. **Data Isolation**: Complete separation between warehouse data

### Report Generation

1. **Async Processing**: Large reports generated asynchronously
2. **File Management**: Reports saved to disk with URL access
3. **Format Support**: Multiple export formats for different use cases
4. **Scheduling**: Automated report generation with configurable frequency

## Error Handling

### Common Error Responses

**401 Unauthorized**

```json
{
  "success": false,
  "message": "Authentication required"
}
```

**403 Forbidden**

```json
{
  "success": false,
  "message": "Insufficient permissions for this operation"
}
```

**404 Not Found**

```json
{
  "success": false,
  "message": "Resource not found"
}
```

**500 Internal Server Error**

```json
{
  "success": false,
  "message": "Failed to process analytics request"
}
```

## Security & Access Control

- All endpoints require valid JWT authentication
- Warehouse-scoped data isolation
- Role-based access control for sensitive operations
- Report generation restricted to MANAGER and OWNER roles
- Audit logging for all analytics operations

## Testing

### Test Event Tracking

```bash
curl -X POST http://localhost:5000/api/analytics/track \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Warehouse-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "user_action",
    "eventName": "test_event",
    "description": "Testing analytics tracking",
    "value": 1
  }'
```

### Test Sales Analytics

```bash
curl -X GET "http://localhost:5000/api/analytics/sales?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Warehouse-Id: 1"
```

### Test Report Generation

```bash
curl -X POST http://localhost:5000/api/analytics/reports/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Warehouse-Id: 1" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SALES",
    "title": "Test Sales Report",
    "format": "JSON",
    "parameters": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31",
      "includeDetails": true
    }
  }'
```
