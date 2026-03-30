# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copy package files
COPY app/package.json app/package-lock.json ./

# Install dependencies
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY app/ .

# Build the application
RUN npm run build

# Stage 3: Production runtime
FROM node:20-alpine

WORKDIR /app

# Copy production dependencies from deps stage (already installed)
COPY --from=deps /app/node_modules ./node_modules

# Copy built artifacts and package files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

# Copy start script
COPY scripts/start-prod.sh /usr/local/bin/start-prod.sh
RUN chmod +x /usr/local/bin/start-prod.sh

EXPOSE 8080

# Run migrations and start production server
CMD ["/usr/local/bin/start-prod.sh"]
