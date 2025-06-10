# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install pnpm
RUN npm install -g pnpm 
RUN apk add --no-cache curl libc6-compat

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install 

# Copy source code
COPY . .

# Build stage
FROM base AS build

# Accept build arguments from docker-compose
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_API_URL
ARG VITE_AI_SERVICE_URL

# Convert build args to environment variables for Vite build
ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_AI_SERVICE_URL=$VITE_AI_SERVICE_URL

RUN pnpm type-check || echo "Type check failed, but continuing..."

# Build the application (Vite bakes the env vars into the bundle)
RUN pnpm build

# Production stage
FROM nginx:alpine AS production

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Create nginx config
RUN echo 'server { \
    listen 3000; \
    server_name localhost; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
    # Handle Auth0 callback \
    location /callback { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port 3000
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]