#!/bin/bash
# filepath: /home/szymon/repos/Warely/scripts/test-scaling.sh

# Colors
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m'

# Array for background processes
PIDS=()

# Cleanup function
cleanup() {
    echo -e "\n${RED}Stopping load generators...${NC}"
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    echo -e "${GREEN}Done!${NC}"
    exit 0
}

trap cleanup EXIT INT TERM

echo "🚀 Simple Load Test - Watch Replicas Scale!"
echo "==========================================="

# Check services work first
echo "Testing services..."
curl -s http://localhost:5000/health >/dev/null || { echo "❌ Backend not accessible"; exit 1; }
curl -s http://localhost:6001/health >/dev/null || { echo "❌ AI service not accessible"; exit 1; }
echo "✅ Services accessible"

echo ""
echo "📊 Before load test:"
kubectl get pods -n warely | grep -E "backend|ai-service" | wc -l
kubectl get hpa -n warely 2>/dev/null || echo "No HPA found"

echo ""
echo "🔥 Starting HEAVY load (10 generators)..."

# Start 10 simple load generators
for i in {1..3}; do
    {
        while true; do
            # Hit backend 50 times
            for j in {1..5}; do
                curl -s http://localhost:5000/health >/dev/null 2>&1 &
            done
            # Hit AI service 30 times  
            for j in {1..30}; do
                curl -s http://localhost:6001/health >/dev/null 2>&1 &
            done
            sleep 0.01  # Very fast
        done
    } &
    PIDS+=($!)
done

echo "✅ Load generators started!"
echo ""
echo "📈 Watching replica scaling (every 10 seconds)..."
echo "Press Ctrl+C to stop"

# Simple monitoring loop
while true; do
    echo "----------------------------------------"
    echo "⏰ $(date '+%H:%M:%S')"
    
    # Count replicas
    BACKEND_COUNT=$(kubectl get pods -n warely -l app=backend --no-headers 2>/dev/null | wc -l)
    AI_COUNT=$(kubectl get pods -n warely -l app=ai-service --no-headers 2>/dev/null | wc -l)
    
    echo "📦 Current replicas:"
    echo "   Backend: $BACKEND_COUNT"
    echo "   AI Service: $AI_COUNT"
    
    # Show HPA status
    echo "🎯 HPA status:"
    kubectl get hpa -n warely --no-headers 2>/dev/null | awk '{print "   " $1 ": " $3 " (target: " $4 ")"}' || echo "   No HPA configured"
    
    # Show resource usage if available
    if kubectl top pods -n warely --no-headers 2>/dev/null | grep -q backend; then
        echo "💻 Resource usage:"
        kubectl top pods -n warely --no-headers 2>/dev/null | grep -E "backend|ai-service" | awk '{print "   " $1 ": CPU=" $2 " Memory=" $3}'
    fi
    
    echo ""
    sleep 10
done