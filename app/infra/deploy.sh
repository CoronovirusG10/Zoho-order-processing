#!/bin/bash
# =============================================================================
# Order Processing Infrastructure Deployment Script
# Deploy Order Processing to Azure Sweden Central
# =============================================================================

set -e

# Configuration
RESOURCE_GROUP="${1:-rg-orderprocessing-prod}"
LOCATION="swedencentral"
ENVIRONMENT="${2:-prod}"
TEMPLATE_FILE="main.bicep"
PARAMETERS_FILE="parameters.${ENVIRONMENT}.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate prerequisites
validate_prerequisites() {
    log_info "Validating prerequisites..."

    # Check Azure CLI
    if ! command -v az &> /dev/null; then
        log_error "Azure CLI is not installed. Please install it first."
        exit 1
    fi

    # Check if logged in
    if ! az account show &> /dev/null; then
        log_error "Not logged in to Azure. Please run 'az login' first."
        exit 1
    fi

    # Check Bicep
    if ! az bicep version &> /dev/null; then
        log_warning "Bicep CLI not found. Installing..."
        az bicep install
    fi

    log_success "Prerequisites validated."
}

# Show current subscription
show_subscription() {
    log_info "Current Azure subscription:"
    az account show --query "{Name:name, SubscriptionId:id, TenantId:tenantId}" -o table
    echo ""
    read -p "Continue with this subscription? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Deployment cancelled by user."
        exit 1
    fi
}

# Validate Bicep template
validate_template() {
    log_info "Validating Bicep template..."

    if az bicep build --file "$TEMPLATE_FILE" --stdout > /dev/null 2>&1; then
        log_success "Bicep template is valid."
    else
        log_error "Bicep template validation failed."
        az bicep build --file "$TEMPLATE_FILE"
        exit 1
    fi
}

# Create resource group (handled by subscription-scoped deployment)
# Note: main.bicep is subscription-scoped and creates its own RG

# Run what-if deployment
run_whatif() {
    log_info "Running what-if deployment (dry run)..."

    az deployment sub what-if \
        --location "$LOCATION" \
        --template-file "$TEMPLATE_FILE" \
        --parameters "@$PARAMETERS_FILE" \
        --parameters environment="$ENVIRONMENT"
}

# Deploy infrastructure
deploy() {
    log_info "Starting deployment to Azure Sweden Central..."
    log_info "Resource Group: $RESOURCE_GROUP"
    log_info "Environment: $ENVIRONMENT"
    log_info "Location: $LOCATION"
    echo ""

    # Run what-if first
    run_whatif

    echo ""
    read -p "Proceed with deployment? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_error "Deployment cancelled by user."
        exit 1
    fi

    log_info "Deploying infrastructure..."

    # Subscription-scoped deployment (main.bicep creates its own resource group)
    DEPLOYMENT_NAME="order-processing-${ENVIRONMENT}-$(date +%Y%m%d%H%M%S)"

    az deployment sub create \
        --name "$DEPLOYMENT_NAME" \
        --location "$LOCATION" \
        --template-file "$TEMPLATE_FILE" \
        --parameters "@$PARAMETERS_FILE" \
        --parameters environment="$ENVIRONMENT" \
        --output table

    log_success "Deployment completed successfully!"
}

# Get deployment outputs
get_outputs() {
    log_info "Retrieving deployment outputs..."

    DEPLOYMENT_NAME=$(az deployment sub list --query "[?contains(name, 'order-processing-${ENVIRONMENT}')].name | [0]" -o tsv)

    if [ -n "$DEPLOYMENT_NAME" ]; then
        log_info "Deployment: $DEPLOYMENT_NAME"
        az deployment sub show \
            --name "$DEPLOYMENT_NAME" \
            --query "properties.outputs" \
            -o json
    else
        log_warning "No deployment found for environment: $ENVIRONMENT"
    fi
}

# Main script
main() {
    echo "=============================================="
    echo "  Order Processing - Azure Deployment Script"
    echo "=============================================="
    echo ""

    # Change to script directory
    cd "$(dirname "$0")"

    # Validate prerequisites
    validate_prerequisites

    # Show current subscription
    show_subscription

    # Check if parameters file exists
    if [ ! -f "$PARAMETERS_FILE" ]; then
        log_error "Parameters file not found: $PARAMETERS_FILE"
        log_info "Available parameter files:"
        ls -la parameters.*.json 2>/dev/null || echo "  No parameter files found"
        exit 1
    fi

    # Validate template
    validate_template

    # Deploy
    deploy

    # Show outputs
    get_outputs

    echo ""
    log_success "Deployment complete!"
    echo ""
    log_info "Next steps:"
    echo "  1. Configure Teams App registration in Azure AD"
    echo "  2. Update Key Vault secrets with actual API keys"
    echo "  3. Configure CI/CD for Static Web App"
    echo "  4. Deploy function app code packages"
    echo ""
}

# Command line options
case "${1:-deploy}" in
    validate)
        cd "$(dirname "$0")"
        validate_prerequisites
        validate_template
        ;;
    whatif)
        cd "$(dirname "$0")"
        validate_prerequisites
        show_subscription
        validate_template
        run_whatif
        ;;
    outputs)
        get_outputs
        ;;
    deploy|*)
        main
        ;;
esac
