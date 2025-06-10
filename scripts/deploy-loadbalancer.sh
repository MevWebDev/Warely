#!/bin/bash
# deploy-loadbalancer.sh - Deploy Warely with LoadBalancer services

set -e

echo "🚀 Deploying Warely to Kubernetes with LoadBalancer services..."

# Check if we're using Docker Desktop or Minikube
if kubectl config current-context | grep -q "docker-desktop"; then
    echo "✅ Using Docker Desktop Kubernetes"
    CLUSTER_TYPE="docker-desktop"
elif kubectl config current-context | grep -q "minikube"; then
    echo "✅ Using Minikube"
    CLUSTER_TYPE="minikube"
    
    # Load images into minikube after building
    LOAD_INTO_MINIKUBE=true
else
    echo "⚠️ Unknown cluster type, proceeding anyway..."
    CLUSTER_TYPE="unknown"
    LOAD_INTO_MINIKUBE=false
fi

echo "📦 Building Docker images..."

# Build images in parallel for speed
echo "🔨 Building backend..."
docker build -t warely-backend:latest ../services/backend &

echo "🔨 Building frontend with Vite args..."
 ./build-frontend.sh   &

echo "🔨 Building AI service..."
docker build -t warely-ai-service:latest ../services/ai-service &

# Wait for all builds to complete
wait
echo "✅ All images built!"

# Load images into minikube if needed
if [ "$LOAD_INTO_MINIKUBE" = true ]; then
    echo "📦 Loading images into minikube..."
    minikube image load warely-frontend:latest &
    minikube image load warely-backend:latest &
    minikube image load warely-ai-service:latest &
    wait
    echo "✅ Images loaded into minikube!"
fi

echo "📋 Deploying Kubernetes resources..."

# Apply infrastructure
kubectl apply -f ../k8s/00-namespace.yaml
kubectl apply -f ../k8s/01-configmap.yaml
kubectl apply -f ../k8s/02-secrets.yaml
kubectl apply -f ../k8s/06-storage.yaml

# Deploy databases
echo "📊 Deploying databases..."
kubectl apply -f ../k8s/03-postgres.yaml
kubectl apply -f ../k8s/04-mongodb.yaml
kubectl apply -f ../k8s/05-redis.yaml

# Wait for databases
echo "⏳ Waiting for databases to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment/postgres -n warely
kubectl wait --for=condition=available --timeout=120s deployment/mongodb -n warely
kubectl wait --for=condition=available --timeout=120s deployment/redis -n warely

# Deploy applications
echo "📌 Deploying applications..."
kubectl apply -f ../k8s/07-backend.yaml
kubectl apply -f ../k8s/08-ai-service.yaml
kubectl apply -f ../k8s/09-frontend.yaml

# Deploy HPA (skip ingress)
kubectl apply -f ../k8s/11-hpa.yaml

echo "⏳ Waiting for applications to be ready..."
kubectl wait --for=condition=available --timeout=120s deployment/backend -n warely
kubectl wait --for=condition=available --timeout=120s deployment/ai-service -n warely
kubectl wait --for=condition=available --timeout=120s deployment/frontend -n warely

echo "✅ LoadBalancer deployment complete!"
echo ""

# # Add this restart section at the end
# echo ""
# echo "🔄 Restarting all deployments to ensure latest images..."
# kubectl rollout restart deployment -n warely

# echo "⏳ Waiting for all services to restart with latest images..."
# kubectl rollout status deployment/backend -n warely --timeout=120s
# kubectl rollout status deployment/frontend -n warely --timeout=120s
# kubectl rollout status deployment/ai-service -n warely --timeout=120s

# echo "✅ All services restarted successfully!"
# echo ""

# Get service information
echo "📊 Service information:"
kubectl get services -n warely

echo ""
echo "🌍 Access your services:"

if [ "$CLUSTER_TYPE" = "docker-desktop" ]; then
    echo "Frontend:    http://localhost:3000"
    echo "Backend API: http://localhost:5000/health"
    echo "AI Service:  http://localhost:6001/health"
elif [ "$CLUSTER_TYPE" = "minikube" ]; then
    echo "Use 'minikube service' commands to access:"
    echo "minikube service frontend -n warely"
    echo "minikube service backend -n warely" 
    echo "minikube service ai-service -n warely"
else
    echo "Check 'kubectl get services -n warely' for external IPs"
fi

echo ""
echo "📊 Monitor with:"
echo "kubectl get pods -n warely -w"
echo "kubectl logs -f deployment/backend -n warely"
echo "kubectl logs -f deployment/frontend -n warely"

echo ""
echo "🔧 Debug frontend Auth0 config:"
echo "kubectl exec -it deployment/frontend -n warely -- grep -r 'dev-h6l82e421qmviw6y' /usr/share/nginx/html/"