#!/bin/bash
set -e

# Docker entrypoint script for Career Navigator MCP Server
# Handles initialization, environment setup, and graceful startup

echo "🚀 Starting Career Navigator MCP Server..."
echo "   Environment: ${NODE_ENV:-production}"
echo "   Port: ${MCP_PORT:-3000}"

# Function to wait for service to be ready
wait_for_service() {
  local host=$1
  local port=$2
  local service=$3
  local timeout=${4:-30}
  
  echo "⏳ Waiting for $service to be ready at $host:$port..."
  
  for i in $(seq 1 $timeout); do
    if nc -z "$host" "$port" >/dev/null 2>&1; then
      echo "✅ $service is ready!"
      return 0
    fi
    echo "   Attempt $i/$timeout: $service not ready, waiting..."
    sleep 2
  done
  
  echo "❌ $service failed to start within $timeout seconds"
  return 1
}

# Function to validate environment variables
validate_env() {
  echo "🔍 Validating environment configuration..."
  
  local required_vars=(
    "NODE_ENV"
    "JWT_SECRET"
    "MCP_ENCRYPTION_KEY"
  )
  
  local missing_vars=()
  
  for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
      missing_vars+=("$var")
    fi
  done
  
  if [[ ${#missing_vars[@]} -gt 0 ]]; then
    echo "❌ Missing required environment variables:"
    printf '   - %s\n' "${missing_vars[@]}"
    echo "   Please check your .env file and docker-compose.yml"
    exit 1
  fi
  
  echo "✅ Environment validation passed"
}

# Function to check Oracle wallet files
check_wallets() {
  echo "🗂️  Checking Oracle wallet files..."
  
  local wallet_path="/app/wallets"
  
  if [[ ! -d "$wallet_path" ]]; then
    echo "❌ Wallet directory not found: $wallet_path"
    echo "   Please ensure Oracle wallet files are mounted correctly"
    exit 1
  fi
  
  # Check for required wallet files
  local wallet_files=("tnsnames.ora" "sqlnet.ora" "cwallet.sso")
  local missing_files=()
  
  for env_dir in "$wallet_path"/*; do
    if [[ -d "$env_dir" ]]; then
      local env_name=$(basename "$env_dir")
      echo "   Checking wallet: $env_name"
      
      for file in "${wallet_files[@]}"; do
        if [[ ! -f "$env_dir/$file" ]]; then
          missing_files+=("$env_name/$file")
        fi
      done
    fi
  done
  
  if [[ ${#missing_files[@]} -gt 0 ]]; then
    echo "⚠️  Missing wallet files:"
    printf '   - %s\n' "${missing_files[@]}"
    echo "   MCP server may not be able to connect to Oracle database"
  else
    echo "✅ Wallet files validation passed"
  fi
}

# Function to setup directories
setup_directories() {
  echo "📁 Setting up directories..."
  
  # Create required directories
  mkdir -p /app/logs
  mkdir -p /app/temp
  
  # Set permissions
  chmod 755 /app/logs
  chmod 755 /app/temp
  
  echo "✅ Directory setup completed"
}

# Function to wait for dependencies
wait_for_dependencies() {
  echo "🔗 Waiting for service dependencies..."
  
  # Wait for Redis if configured
  if [[ -n "${REDIS_HOST}" && "${REDIS_HOST}" != "localhost" && "${REDIS_HOST}" != "127.0.0.1" ]]; then
    wait_for_service "${REDIS_HOST}" "${REDIS_PORT:-6379}" "Redis" 30
  fi
  
  echo "✅ Dependencies check completed"
}

# Function to run database health check
check_database() {
  echo "🗄️  Checking database connectivity..."
  
  # Run database health check script
  if node scripts/db-health-check.js; then
    echo "✅ Database connectivity verified"
  else
    echo "⚠️  Database connectivity check failed"
    echo "   MCP server will start but may have limited functionality"
  fi
}

# Function to handle graceful shutdown
cleanup() {
  echo ""
  echo "🛑 Received shutdown signal, cleaning up..."
  
  # Kill background processes
  jobs -p | xargs -r kill
  
  echo "✅ Cleanup completed"
  exit 0
}

# Set up signal handlers for graceful shutdown
trap cleanup SIGTERM SIGINT

# Main initialization sequence
main() {
  echo "🔧 Initializing Career Navigator MCP Server..."
  
  # Run initialization steps
  validate_env
  setup_directories
  check_wallets
  wait_for_dependencies
  
  # Optional database check (non-blocking)
  if [[ "${SKIP_DB_CHECK:-false}" != "true" ]]; then
    check_database || true
  fi
  
  echo "✅ Initialization completed successfully!"
  echo ""
  
  # Execute the main command
  echo "🎯 Starting MCP Server: $*"
  exec "$@"
}

# Run main function with all arguments
main "$@"