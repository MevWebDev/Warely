## Warely – Smart Warehouse Management with Predictive Insights

**Warely** is an advanced Warehouse Management System designed to streamline operations using intelligent automation and predictive analytics.

It continuously monitors inventory levels, tracks orders, analyzes sales trends, and recommends optimal purchasing decisions based on historical data and machine learning.

With multi-level user access and seamless cloud integration, Warely ensures scalability, security, and full control over warehouse processes.

# 🚀 Quick Start Guide

## 📋 Prerequisites

Before running Warely, ensure you have the following installed:

| Tool                  | Purpose                   | Installation                                                              |
| --------------------- | ------------------------- | ------------------------------------------------------------------------- |
| 🟢 **pnpm**           | Package manager & scripts | [Install pnpm](https://pnpm.io/installation)                              |
| 🐳 **Docker Desktop** | Container runtime         | [Install Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| ☸️ **Kubernetes**     | Container orchestration   | Enable in Docker Desktop settings                                         |
| 🎛️ **kubectl**        | Kubernetes CLI            | [Install kubectl](https://kubernetes.io/docs/tasks/tools/)                |

## 🐳 Docker Compose Deployment

**Recommended for development and testing**

```bash
# Clone the repository
git clone git@github.com:MevWebDev/Warely.git
cd Warely

# Start all services with Docker Compose
pnpm docker:prod

# Check service status
pnpm db:status

# View logs
pnpm db:logs
```

### 🌐 Access Points (Docker)

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **AI Service**: http://localhost:6001
- **Health Check**: http://localhost:5000/health

### 🛠️ Available Commands

```bash
pnpm docker:prod    # Start all services
pnpm db:down        # Stop databases
pnpm db:restart     # Restart databases
pnpm db:logs        # View database logs
pnpm db:clean       # Remove all data (⚠️ destructive)
```

## ☸️ Kubernetes Deployment

**Recommended for production-like environment**

```bash
# Clone the repository
git clone git@github.com:MevWebDev/Warely.git
cd Warely

# Deploy to Kubernetes
pnpm k8s:deploy

# Check deployment status
kubectl get pods -n warely

# Check services
kubectl get services -n warely
```

### 🌐 Access Points (Kubernetes)

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **AI Service**: http://localhost:6001
- **Health Check**: http://localhost:5000/health

### ☸️ Kubernetes Commands

```bash
pnpm k8s:deploy     # Deploy to Kubernetes
pnpm k8s:down       # Delete all deployments
kubectl get pods -n warely    # Check pod status
kubectl logs -f <pod-name> -n warely  # View pod logs
```

## 🔧 Development Setup

For local development with hot reload:

```bash
# Start databases and run services locally
pnpm db:local
```
