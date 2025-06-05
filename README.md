## Warely – Smart Warehouse Management with Predictive Insights

**Warely** is an advanced Warehouse Management System designed to streamline operations using intelligent automation and predictive analytics. 

It continuously monitors inventory levels, tracks orders, analyzes sales trends, and recommends optimal purchasing decisions based on historical data and machine learning.

With multi-level user access and seamless cloud integration, Warely ensures scalability, security, and full control over warehouse processes.


# 🚀 Deployment Guide

## 🐳 Docker 


Build:
```bash
pnpm docker:build
```

Development mode:
```bash
pnpm dev:local
```

Run the production environment using Docker Compose:


```bash
pnpm docker:prod
```


---

## ☸️ Kubernetes Production

### Prerequisites

Before deploying to Kubernetes, ensure you have the following tools installed:

- **Minikube** - Local Kubernetes cluster
- **kubectl** - Kubernetes command-line tool

### 📚 Documentation

For detailed Kubernetes setup instructions, refer to:
📁 /k8s/how-to-use.md


### ⚡ Quick Deployment

For rapid deployment to your Kubernetes cluster:

```bash
./scripts/deploy-fast.sh
```


This script handles the complete deployment process including:
- Building and pushing images
- Applying Kubernetes manifests
- Setting up ingress and services
- Configuring necessary secrets and configs

---

## 🔧 Additional Resources

- **Configuration**: Check environment variables in .env files
- **Monitoring**: Access health checks at /health endpoint
- **Logs**: Use kubectl logs for pod-level debugging



