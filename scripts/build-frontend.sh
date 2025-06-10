#!/bin/bash

# Get the script directory first
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
ROOT_DIR="$SCRIPT_DIR/.."

echo "📁 Script directory: $SCRIPT_DIR"
echo "📁 Root directory: $ROOT_DIR"

# Optional: Load .env values from current directory
if [ -f .env ]; then
  echo "📁 Loading .env from current directory..."
  export $(grep -v '^#' .env | xargs)
fi

# Check for .env in project root
if [ -f "$ROOT_DIR/.env" ]; then
  echo "📁 Loading .env from project root..."
  export $(grep -v '^#' "$ROOT_DIR/.env" | xargs)
fi

# Set FRONTEND_DIR
FRONTEND_DIR="$SCRIPT_DIR/../services/frontend"

echo "📂 Frontend directory: $FRONTEND_DIR"

# Check if environment files exist in current directory
echo "🔍 Checking for .env files in current directory:"
ls -la .env* 2>/dev/null || echo "No .env files found in current directory"

# Check if environment files exist in root directory
echo "🔍 Checking for .env files in root directory:"
ls -la "$ROOT_DIR"/.env* 2>/dev/null || echo "No .env files found in root directory"

# Check if variables are set
echo "📋 Environment variables:"
echo "VITE_AUTH0_DOMAIN: $VITE_AUTH0_DOMAIN"
echo "VITE_AUTH0_CLIENT_ID: $VITE_AUTH0_CLIENT_ID"
echo "VITE_AUTH0_AUDIENCE: $VITE_AUTH0_AUDIENCE"

# Set defaults if variables are empty
VITE_API_URL=${VITE_API_URL:-"http://backend:5000"}
VITE_AI_SERVICE_URL=${VITE_AI_SERVICE_URL:-"http://ai-service:6001"}
VITE_AUTH0_DOMAIN=${VITE_AUTH0_DOMAIN:-"dev-h6l82e421qmviw6y.us.auth0.com"}
VITE_AUTH0_CLIENT_ID=${VITE_AUTH0_CLIENT_ID:-"C4zQpl5hIpQg0yuuJ6pQ23hqstBW5I2O"}
VITE_AUTH0_AUDIENCE=${VITE_AUTH0_AUDIENCE:-"https://warely-api.com"}

# Image name/tag
IMAGE_NAME="warely-frontend"
TAG="latest"

echo "🔧 Building $IMAGE_NAME:$TAG with values:"
echo "   VITE_AUTH0_DOMAIN: $VITE_AUTH0_DOMAIN"
echo "   VITE_AUTH0_CLIENT_ID: ${VITE_AUTH0_CLIENT_ID:0:10}..."
echo "   VITE_AUTH0_AUDIENCE: $VITE_AUTH0_AUDIENCE"
echo "   VITE_API_URL: $VITE_API_URL"

# Check if frontend directory exists
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ Frontend directory not found: $FRONTEND_DIR"
    exit 1
fi

# Run the docker build with build args
docker build -t $IMAGE_NAME:$TAG \
  --build-arg VITE_API_URL="$VITE_API_URL" \
  --build-arg VITE_AI_SERVICE_URL="$VITE_AI_SERVICE_URL" \
  --build-arg VITE_AUTH0_DOMAIN="$VITE_AUTH0_DOMAIN" \
  --build-arg VITE_AUTH0_CLIENT_ID="$VITE_AUTH0_CLIENT_ID" \
  --build-arg VITE_AUTH0_AUDIENCE="$VITE_AUTH0_AUDIENCE" \
  "$FRONTEND_DIR"

if [ $? -eq 0 ]; then
    echo "✅ Build complete. Image: $IMAGE_NAME:$TAG"
    
    # Verify Auth0 config is in the built image
    echo "🔍 Verifying Auth0 config in built image..."
    docker run --rm $IMAGE_NAME:$TAG sh -c "grep -r 'dev-h6l82e421qmviw6y' /usr/share/nginx/html/ | head -1" && echo "✅ Auth0 domain found in bundle" || echo "⚠️ Auth0 domain not found in bundle"
else
    echo "❌ Build failed!"
    exit 1
fi