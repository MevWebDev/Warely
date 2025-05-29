FROM node:18-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install 

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build stage
FROM base AS build
RUN pnpm build

# Production stage
FROM node:18-alpine AS production

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install ALL dependencies first (including devDependencies for Prisma)
RUN pnpm install 

# Copy prisma schema before generating client
COPY prisma ./prisma

# Generate Prisma client
RUN pnpm prisma generate

# Now remove devDependencies
RUN pnpm prune --prod

# Copy built application
COPY --from=build /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S authuser -u 1001

# Change ownership of app directory
RUN chown -R authuser:nodejs /app
USER authuser

EXPOSE 4000

CMD ["pnpm", "start"]