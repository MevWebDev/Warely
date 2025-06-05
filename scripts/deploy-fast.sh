#!/bin/bash
# deploy-fast.sh - Optimized deployment

set -e

echo "🚀 Fast Warely Deployment..."

# Check Minikube (don't restart if running)
if ! minikube status | grep -q "Running"; then
    echo "🔄 Starting Minikube with more resources..."
    minikube start --memory=6144 --cpus=4 --disk-size=20g
else
    echo "✅ Minikube already running"
fi

# Enable addons only if needed
if ! minikube addons list | grep "ingress.*enabled"; then
    minikube addons enable ingress
fi

eval $(minikube docker-env)

# ✅ Build images in parallel (much faster!)
echo "📦 Building images in parallel..."
(
    echo "🔨 Building backend..." && 
    docker build -t warely-backend:latest ../services/backend --quiet
) &
(
    echo "🔨 Building frontend..." && 
    docker build -t warely-frontend:latest ../services/frontend --quiet
) &
(
    echo "🔨 Building AI service..." && 
    docker build -t warely-ai-service:latest ../services/ai-service --quiet
) &

# Wait for all builds to complete
wait
echo "✅ All images built!"

# ✅ Apply resources in batches (faster than sequential)
echo "📋 Applying infrastructure..."
kubectl apply -f ../k8s/00-namespace.yaml
kubectl apply -f ../k8s/01-configmap.yaml 2>/dev/null || true
kubectl apply -f ../k8s/02-secrets.yaml 2>/dev/null || true

# ✅ Apply databases in parallel
echo "📊 Deploying databases in parallel..."
kubectl apply -f ../k8s/03-postgres.yaml &
kubectl apply -f ../k8s/04-mongodb.yaml &
kubectl apply -f ../k8s/05-redis.yaml &
wait

# ✅ Shorter timeout and parallel wait
echo "⏳ Quick database check (30s timeout)..."
kubectl wait --for=condition=available --timeout=30s deployment/postgres -n warely || echo "⚠️ Postgres not ready yet"
kubectl wait --for=condition=available --timeout=30s deployment/mongodb -n warely || echo "⚠️ MongoDB not ready yet"

# ✅ Deploy apps immediately (don't wait for databases)
echo "📌 Deploying applications..."
kubectl apply -f ../k8s/07-backend.yaml
kubectl apply -f ../k8s/08-ai-service.yaml
kubectl apply -f ../k8s/09-frontend.yaml

# ✅ Update ingress with fixes
echo "🌐 Updating ingress configuration..."

# Apply the ingress configuration
kubectl apply -f ../k8s/10-ingress.yaml

# ✅ Quick status check instead of full wait
echo "📊 Quick status check..."
sleep 10
kubectl get pods -n warely

# Configure hosts
MINIKUBE_IP=$(minikube ip)
if ! grep -q "warely.local" /etc/hosts; then
    echo "$MINIKUBE_IP warely.local" | sudo tee -a /etc/hosts >/dev/null
    echo "✅ Added warely.local to /etc/hosts"
else
    # Update existing entry if IP changed
    sudo sed -i "s/.*warely.local.*/$MINIKUBE_IP warely.local/" /etc/hosts
    echo "✅ Updated warely.local in /etc/hosts"
fi

echo "✅ Fast deployment complete!"
echo ""
echo "🌍 Frontend: http://warely.local"
echo "🔧 Backend API: http://warely.local/api/health"
echo "🤖 AI Service: http://warely.local/ai/health"
echo ""
echo "📊 Monitor status: kubectl get pods -n warely -w"
echo "🔍 Check ingress: kubectl describe ingress warely-ingress -n warely"

