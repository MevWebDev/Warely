Project Overview
Warehouse Management System with microservices architecture, AI analytics, and predictive capabilities. Uses OAuth2.0 authentication, PostgreSQL + MongoDB databases, and designed for Railway/Kubernetes deployment.
Architecture & Stack
Microservices Architecture

Frontend Service (React + TypeScript, Port 3000)
Auth Service (OAuth2.0 Server, Node.js + Express, Port 4000)
Backend Service (Business Logic API, Node.js + Express, Port 5000)
API Gateway (Nginx Reverse Proxy, Port 8080)
Database Service (PostgreSQL + MongoDB)

Technology Stack
Frontend:

- React + TypeScript + Vite
- Material-UI v5 for components
- Redux Toolkit
- Recharts for data visualization
- OAuth2.0 PKCE flow for auth

Auth Service:

- Node.js + Express + TypeScript
- OAuth2.0 with node-oauth2-server
- PostgreSQL for users/tokens/clients
- JWT + refresh token rotation
- bcrypt for password hashing
- Rate limiting + helmet security
- RBAC for Authorization

Backend Service:

- Node.js + Express + TypeScript
- PostgreSQL (Prisma ORM) for transactional data
- MongoDB (Mongoose ODM) for analytics/logs
- TensorFlow.js for ML predictions

Databases:

- PostgreSQL 15: Users, inventory, orders, suppliers
- MongoDB 7: Analytics, logs, ML models, reports

Deployment:

- Docker + Docker Compose for local development
- Railway for cloud deployment (each service separate)
- Kubernetes manifests for production scaling
- GitHub Actions for CI/CD
