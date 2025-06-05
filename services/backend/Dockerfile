FROM node:18-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache curl libc6-compat

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Copy prisma schema BEFORE installing dependencies
COPY prisma ./prisma

# Install dependencies
RUN pnpm install 

# Copy source code
COPY . .

ENV DATABASE_URL="postgresql://postgres:password@postgres:5432/warely"

# Generate Prisma client
RUN pnpm prisma generate

# Build stage
FROM base AS build
RUN pnpm build

# Production stage
FROM node:18-alpine AS production

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat curl

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Copy prisma schema BEFORE installing dependencies
COPY prisma ./prisma

# Install ALL dependencies first (including devDependencies for Prisma)
RUN pnpm install 

# Generate Prisma client
RUN pnpm prisma generate

# Now remove devDependencies
RUN pnpm prune --prod

# Copy built application
COPY --from=build /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backenduser -u 1001
RUN chown -R backenduser:nodejs /app

USER backenduser

EXPOSE 5000

# Use explicit environment variable loading
CMD ["sh", "-c", "pnpm start"]