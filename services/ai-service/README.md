# Warely AI Service

AI/ML predictions and analytics service for warehouse management, built with Express.js and TypeScript.

## Features

- 🤖 **AI Predictions**: Demand forecasting and inventory optimization
- 📊 **Analytics**: Comprehensive warehouse analytics and insights
- 🔄 **Health Monitoring**: Built-in health checks and system monitoring
- 🛡️ **Security**: Helmet.js security middleware and CORS protection
- 🚀 **Performance**: Compression and optimized response handling
- 📝 **TypeScript**: Full type safety and excellent developer experience

## API Endpoints

### Health Checks

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system information

### AI Services

- `POST /ai/predict` - General AI predictions
- `POST /ai/forecast/demand` - Demand forecasting
- `POST /ai/optimize/inventory` - Inventory optimization
- `GET /ai/analytics/summary` - Analytics summary

### Utility

- `GET /hello` - Simple hello endpoint

## Development

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Install dependencies
npm install

# Development with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run tests
npm test

# Lint code
npm run lint
```

### Environment Variables

```bash
PORT=6000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
MONGODB_URI=mongodb://localhost:27017/warely
REDIS_URL=redis://localhost:6379
```

## Docker

### Build and Run

```bash
# Build Docker image
docker build -t warely-ai-service .

# Run container
docker run -p 6000:6000 warely-ai-service
```

### Health Check

The service includes Docker health checks that ping the `/health` endpoint.

## Architecture

### Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Testing**: Jest
- **Linting**: ESLint + TypeScript ESLint

### Project Structure

```
src/
├── server.ts          # Main application entry point
├── routes/
│   ├── health.ts      # Health check endpoints
│   └── ai.ts          # AI/ML service endpoints
└── types/             # TypeScript type definitions
```

## Deployment

### Kubernetes

The service is designed to work with the Warely Kubernetes deployment:

```yaml
# Deployed via k8s/08-ai-service.yaml
# Port: 6000
# Health checks: /health
```

## Security

- **Helmet.js**: Security headers and protections
- **CORS**: Configured for frontend origins
- **Input validation**: Request body size limits
- **Non-root user**: Docker container runs as nodejs user

## TODO

- [ ] Implement actual ML algorithms (TensorFlow.js/Brain.js)
- [ ] Add MongoDB and Redis connection health checks
- [ ] Implement authentication/authorization
- [ ] Add rate limiting
- [ ] Add metrics collection (Prometheus)
