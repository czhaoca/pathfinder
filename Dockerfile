# Multi-stage Docker build for Career Navigator MCP Server
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    libaio \
    libnsl \
    libc6-compat \
    && ln -s /lib/libnsl.so.2 /usr/lib/libnsl.so.1

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
FROM base AS dependencies
RUN npm ci --only=production && npm cache clean --force

# Development dependencies
FROM base AS dev-dependencies
RUN npm ci

# Build stage
FROM dev-dependencies AS build
COPY . .
RUN npm run build 2>/dev/null || echo "No build step defined, continuing..."

# Production stage
FROM base AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy production dependencies
COPY --from=dependencies /app/node_modules ./node_modules

# Copy application code
COPY --chown=nodejs:nodejs . .

# Create directories for wallets and logs
RUN mkdir -p wallets logs temp && \
    chown -R nodejs:nodejs wallets logs temp

# Make scripts executable
RUN chmod +x scripts/docker-entrypoint.sh scripts/health-check.js

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node scripts/health-check.js || exit 1

# Expose port
EXPOSE 3000

# Set entrypoint
ENTRYPOINT ["scripts/docker-entrypoint.sh"]

# Default command
CMD ["npm", "run", "mcp:start"]