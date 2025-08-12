# Backend Dockerfile for Pathfinder

# Development stage
FROM node:22-oracle-instantclient AS development

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose ports
EXPOSE 3000

# Start in development mode
CMD ["npm", "run", "dev"]

# Production stage
FROM node:22-oracle-instantclient AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy source code
COPY . .

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose ports
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node src/utils/health-check.js || exit 1

# Start in production mode
CMD ["npm", "start"]