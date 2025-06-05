#!/bin/bash
# test-scaling.sh

echo "🧪 Testing autoscaling..."

# Generowanie obciążenia
kubectl run -i --tty load-generator --rm --image=busybox --restart=Never -- /bin/sh -c "while sleep 0.01; do wget -q -O- http://backend.warely.svc.cluster.local:5000/health; done"

# Obserwowanie skalowania
watch kubectl get hpa -n warely