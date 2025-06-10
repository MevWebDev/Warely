# Multi-stage build for smaller production image
FROM node:18-alpine AS builder

RUN apk add --no-cache libc6-compat curl

# Install pnpm
RUN npm install -g pnpm

# Set working directory
WORKDIR /app



# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./
COPY tsconfig.json ./

# Install all dependencies (including dev)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN pnpm run build

# Production stage
FROM node:18-alpine AS production

RUN apk add --no-cache libc6-compat curl

# Install pnpm
RUN npm install -g pnpm



# Set environment variables
ENV NODE_ENV=production
ENV PORT=6000

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml* ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod && pnpm store prune

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 6000

# Start the application
CMD ["node", "dist/server.js"]