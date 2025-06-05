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

# Build the application
RUN pnpm build

# Production stage
FROM nginx:alpine AS production

# Copy built assets from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Create a simple nginx config that listens on port 3000
RUN echo 'server { \
    listen 3000; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Expose port 3000 to match your architecture
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]