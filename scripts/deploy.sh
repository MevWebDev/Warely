#!/bin/bash
# deploy-debug.sh

set -e  # Zatrzymaj na błędzie

echo "🚀 Deploying Warely to Kubernetes..."

# Sprawdź czy Minikube działa
if ! minikube status | grep -q "Running"; then
    echo "❌ Minikube nie działa. Uruchamianie..."
    minikube start --memory=4096 --cpus=2
fi

# Włącz addons jeśli nie są włączone
minikube addons enable ingress
minikube addons enable metrics-server

echo "📦 Building Docker images..."
eval $(minikube docker-env)

# Build z verbose output
echo "🔨 Building backend..."
if ! docker build -t warely-backend:latest ../services/backend; then
    echo "❌ Backend build failed!"
    exit 1
fi

echo "🔨 Building frontend..."  
if ! docker build -t warely-frontend:latest ../services/frontend; then
    echo "❌ Frontend build failed!"
    exit 1
fi

echo "🔨 Building AI service..."
if ! docker build -t warely-ai-service:latest ../services/ai-service; then
    echo "❌ AI service build failed!"
    exit 1
fi

echo "✅ All images built successfully"
docker images | grep warely

echo "📋 Applying Kubernetes manifests in order..."

# Apply in specific order
echo "📌 Creating namespace..."
kubectl apply -f ../k8s/00-namespace.yaml

echo "📌 Creating ConfigMap..."
kubectl apply -f ../k8s/01-configmap.yaml

echo "📌 Creating Secrets..."
kubectl apply -f ../k8s/02-secrets.yaml

echo "📌 Creating Storage..."
kubectl apply -f ../k8s/06-storage.yaml

# Wait a bit for storage
sleep 5

echo "📌 Deploying databases..."
kubectl apply -f ../k8s/03-postgres.yaml
kubectl apply -f ../k8s/04-mongodb.yaml
kubectl apply -f ../k8s/05-redis.yaml

echo "⏳ Waiting for databases to be ready..."
for deployment in postgres mongodb redis; do
    echo "Waiting for $deployment..."
    if ! kubectl wait --for=condition=available  deployment/$deployment -n warely; then
        echo "❌ $deployment failed to deploy"
        kubectl describe deployment $deployment -n warely
        kubectl logs deployment/$deployment -n warely --tail=50
        exit 1
    fi
done

echo "📌 Deploying applications..."
kubectl apply -f ../k8s/07-backend.yaml
kubectl apply -f ../k8s/08-ai-service.yaml
kubectl apply -f ../k8s/09-frontend.yaml

echo "⏳ Waiting for applications to be ready..."
for deployment in backend ai-service frontend; do
    echo "Waiting for $deployment..."
    if ! kubectl wait --for=condition=available  deployment/$deployment -n warely; then
        echo "❌ $deployment failed to deploy"
        echo "📊 Pod status:"
        kubectl get pods -l app=$deployment -n warely
        echo "📊 Events:"
        kubectl get events -n warely --field-selector involvedObject.name=$deployment
        echo "📊 Logs:"
        kubectl logs deployment/$deployment -n warely --tail=50 || echo "No logs available"
        exit 1
    fi
done

echo "📌 Applying Ingress and HPA..."
kubectl apply -f ../k8s/10-ingress.yaml
kubectl apply -f ../k8s/11-hpa.yaml

# Configure hosts
MINIKUBE_IP=$(minikube ip)
if ! grep -q "warely.local" /etc/hosts; then
    echo "$MINIKUBE_IP warely.local" | sudo tee -a /etc/hosts
fi

echo "✅ Deployment complete!"
echo "🌍 Application available at: http://warely.local"
echo "📊 Minikube IP: $MINIKUBE_IP"

# Show final status
echo "📊 Final status:"
kubectl get pods -n warely
kubectl get services -n warely