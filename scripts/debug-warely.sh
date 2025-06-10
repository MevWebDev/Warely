#!/bin/bash
# debug-docker-desktop.sh

echo "🔍 Docker Desktop Kubernetes Debug..."

# Check context
echo "📡 Current context:"
kubectl config current-context

# Check ingress controller
echo ""
echo "🚦 Ingress Controller:"
kubectl get pods -n ingress-nginx

# Check your apps
echo ""
echo "📦 Warely Pods:"
kubectl get pods -n warely

echo ""
echo "🌐 Services:"
kubectl get svc -n warely

echo ""
echo "📋 Ingress:"
kubectl get ingress -n warely -o wide

# ✅ Add detailed debugging for failed pods
echo ""
echo "🔍 Detailed Pod Status:"
kubectl get pods -n warely -o wide

echo ""
echo "📊 Pod Events (last 10 minutes):"
kubectl get events -n warely --sort-by='.firstTimestamp' | tail -20

echo ""
echo "💾 Storage Status:"
kubectl get pvc -n warely

echo ""
echo "🐛 Failed Pod Logs:"
# Check postgres logs if it exists
if kubectl get pod -l app=postgres -n warely &>/dev/null; then
    echo "--- Postgres Logs ---"
    kubectl logs -l app=postgres -n warely --tail=20 || echo "No postgres logs available"
fi

# Check redis logs if it exists
if kubectl get pod -l app=redis -n warely &>/dev/null; then
    echo "--- Redis Logs ---"
    kubectl logs -l app=redis -n warely --tail=20 || echo "No redis logs available"
fi

# Check for pending pods
echo ""
echo "⏳ Pending/Failed Pods Description:"
kubectl get pods -n warely | grep -E "(Pending|Error|CrashLoopBackOff|ImagePullBackOff)" | while read line; do
    POD_NAME=$(echo $line | awk '{print $1}')
    echo "--- Describing $POD_NAME ---"
    kubectl describe pod $POD_NAME -n warely
done

echo ""
echo "🧪 Testing access:"
curl -I http://warely.local --connect-timeout 5 || echo "❌ Cannot reach warely.local"

echo ""
echo "📋 Hosts file:"
grep warely /etc/hosts || echo "❌ No warely.local entry"