# Uruchomienie Minikube z dodatkami

minikube start --memory=4096 --cpus=2
minikube addons enable ingress
minikube addons enable metrics-server

# Wdrożenie aplikacji

chmod +x deploy.sh
./deploy.sh

# Testowanie

curl http://warely.local
curl http://warely.local/api/health

# Monitorowanie

kubectl get pods -n warely -w
kubectl logs -f deployment/backend -n warely

# Testowanie autoskalowania

kubectl run -i --tty load-generator --rm --image=busybox --restart=Never -- /bin/sh
