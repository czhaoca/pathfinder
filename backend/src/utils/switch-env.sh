#!/bin/bash

# Environment Switching Script for Career Navigator MCP
# Switches between development and production environments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [development|production]"
    echo ""
    echo "Environment switching script for Career Navigator MCP Server"
    echo ""
    echo "Arguments:"
    echo "  development  - Switch to development environment (default)"
    echo "  production   - Switch to production environment"
    echo ""
    echo "Examples:"
    echo "  $0 development"
    echo "  $0 production"
    echo "  npm run env:dev    # Same as: $0 development"
    echo "  npm run env:prod   # Same as: $0 production"
}

# Get environment argument
ENV=${1:-development}

# Validate environment
if [ "$ENV" != "development" ] && [ "$ENV" != "production" ]; then
    print_error "Invalid environment: $ENV"
    show_usage
    exit 1
fi

print_info "Switching to $ENV environment..."

# Check if environment file exists
ENV_FILE=".env.$ENV"
if [ ! -f "$ENV_FILE" ]; then
    print_error "Environment file not found: $ENV_FILE"
    print_warning "Please create $ENV_FILE with required configuration"
    print_info "See docs/deployment/mcp-server/oci-provisioning-guide.md for setup instructions"
    exit 1
fi

# Backup current .env if it exists
if [ -f ".env" ]; then
    cp .env .env.backup
    print_info "Backed up current .env to .env.backup"
fi

# Copy environment file
cp "$ENV_FILE" .env
print_success "Environment file copied: $ENV_FILE → .env"

# Validate wallet path exists
if [ "$ENV" = "development" ]; then
    WALLET_PATH="./wallets/dev-wallet"
    DB_HOST_VAR="OCI_DB_DEV_HOST"
    SERVICE_NAME_VAR="OCI_DB_DEV_SERVICE_NAME"
else
    WALLET_PATH="./wallets/prod-wallet"
    DB_HOST_VAR="OCI_DB_PROD_HOST"
    SERVICE_NAME_VAR="OCI_DB_PROD_SERVICE_NAME"
fi

# Load environment variables to check configuration
set -a  # Automatically export all variables
source .env
set +a  # Stop auto-export

# Check wallet directory
if [ ! -d "$WALLET_PATH" ]; then
    print_warning "Wallet directory not found: $WALLET_PATH"
    print_info "Please ensure Oracle wallet files are properly installed"
    print_info "Download wallet from OCI Console → Autonomous Database → Database Connection → Download Wallet"
    echo ""
    print_info "Expected wallet structure:"
    echo "  $WALLET_PATH/"
    echo "  ├── cwallet.sso"
    echo "  ├── ewallet.p12"
    echo "  ├── keystore.jks"
    echo "  ├── ojdbc.properties"
    echo "  ├── sqlnet.ora"
    echo "  ├── tnsnames.ora"
    echo "  └── truststore.jks"
else
    print_success "Wallet directory found: $WALLET_PATH"
    
    # Check essential wallet files
    WALLET_FILES=("cwallet.sso" "tnsnames.ora" "sqlnet.ora")
    MISSING_FILES=()
    
    for file in "${WALLET_FILES[@]}"; do
        if [ ! -f "$WALLET_PATH/$file" ]; then
            MISSING_FILES+=("$file")
        fi
    done
    
    if [ ${#MISSING_FILES[@]} -gt 0 ]; then
        print_warning "Missing wallet files: ${MISSING_FILES[*]}"
        print_info "Please ensure all wallet files are extracted to $WALLET_PATH"
    else
        print_success "Essential wallet files verified"
    fi
fi

# Validate required environment variables
REQUIRED_VARS=()
if [ "$ENV" = "development" ]; then
    REQUIRED_VARS=("OCI_DB_DEV_USERNAME" "OCI_DB_DEV_PASSWORD" "OCI_DB_DEV_SERVICE_NAME")
else
    REQUIRED_VARS=("OCI_DB_PROD_USERNAME" "OCI_DB_PROD_PASSWORD" "OCI_DB_PROD_SERVICE_NAME")
fi

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    print_error "Missing required environment variables: ${MISSING_VARS[*]}"
    print_info "Please update $ENV_FILE with required database configuration"
    exit 1
else
    print_success "Required environment variables verified"
fi

# Show environment summary
echo ""
print_info "Environment Configuration Summary:"
echo "  Environment: $ENV"
echo "  Config file: $ENV_FILE"
echo "  Wallet path: $WALLET_PATH"

if [ "$ENV" = "development" ]; then
    echo "  Database host: ${OCI_DB_DEV_HOST:-'Not set'}"
    echo "  Service name: ${OCI_DB_DEV_SERVICE_NAME:-'Not set'}"
    echo "  Username: ${OCI_DB_DEV_USERNAME:-'Not set'}"
    echo "  Log level: ${LOG_LEVEL:-debug}"
    echo "  Query logging: ${ENABLE_QUERY_LOGGING:-true}"
else
    echo "  Database host: ${OCI_DB_PROD_HOST:-'Not set'}"
    echo "  Service name: ${OCI_DB_PROD_SERVICE_NAME:-'Not set'}"
    echo "  Username: ${OCI_DB_PROD_USERNAME:-'Not set'}"
    echo "  Log level: ${LOG_LEVEL:-info}"
    echo "  Query logging: ${ENABLE_QUERY_LOGGING:-false}"
fi

echo ""
print_success "Environment switched to $ENV successfully!"

# Provide next steps
echo ""
print_info "Next Steps:"
echo "  1. Test database connection: npm run db:health"
echo "  2. Deploy schema (if needed): npm run db:migrate:$ENV"
echo "  3. Start MCP server: npm run mcp:$ENV"
echo ""
print_info "Available Commands:"
echo "  npm run db:health           - Check database connectivity"
echo "  npm run db:test-connection  - Test both environments"
echo "  npm run db:migrate:$ENV     - Deploy database schema"
echo "  npm run db:seed:$ENV        - Load sample data"
echo "  npm run mcp:$ENV            - Start MCP server"

# Optional: Run health check automatically
read -p "Would you like to run a database health check now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Running database health check..."
    if command -v node >/dev/null 2>&1; then
        npm run db:health
    else
        print_warning "Node.js not found. Please run 'npm run db:health' manually"
    fi
fi

exit 0