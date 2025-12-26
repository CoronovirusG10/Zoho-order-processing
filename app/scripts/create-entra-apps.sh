#!/usr/bin/env bash
#===============================================================================
# create-entra-apps.sh
#
# Creates Microsoft Entra ID (Azure AD) app registrations for the Order Processing
# Teams application in a cross-tenant deployment scenario.
#
# This script creates TWO app registrations in Tenant A:
#   1. Bot App - Multi-tenant app for Bot Framework authentication
#   2. Tab/API App - Multi-tenant app with app roles for SSO and API authorization
#
# Prerequisites:
#   - Azure CLI installed and logged in to Tenant A
#   - Permissions to create app registrations in Tenant A
#
# Usage:
#   ./create-entra-apps.sh [options]
#
# Options:
#   --app-name-prefix    Prefix for app names (default: "OrderProcessing")
#   --tab-domain         Domain for the tab/API (e.g., "orderprocessing.azurewebsites.net")
#   --bot-domain         Domain for the bot endpoint (e.g., "orderprocessing-bot.azurewebsites.net")
#   --output-env         Output environment variables to file (default: .env.entra)
#   --dry-run            Show what would be created without creating
#
#===============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
APP_NAME_PREFIX="OrderProcessing"
TAB_DOMAIN=""
BOT_DOMAIN=""
OUTPUT_ENV=".env.entra"
DRY_RUN=false

#-------------------------------------------------------------------------------
# Helper functions
#-------------------------------------------------------------------------------

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_usage() {
    cat << EOF
Usage: $0 [options]

Creates Entra ID app registrations for cross-tenant Teams deployment.

Options:
    --app-name-prefix <prefix>   Prefix for app names (default: OrderProcessing)
    --tab-domain <domain>        Domain for tab/API (required)
    --bot-domain <domain>        Domain for bot endpoint (required)
    --output-env <file>          Output env file (default: .env.entra)
    --dry-run                    Preview without creating
    -h, --help                   Show this help

Example:
    $0 \\
        --app-name-prefix "OrderProcessing" \\
        --tab-domain "orderprocessing.azurestaticapps.net" \\
        --bot-domain "orderprocessing-api.swedencentral.azurecontainer.io"
EOF
}

#-------------------------------------------------------------------------------
# Parse arguments
#-------------------------------------------------------------------------------

while [[ $# -gt 0 ]]; do
    case $1 in
        --app-name-prefix)
            APP_NAME_PREFIX="$2"
            shift 2
            ;;
        --tab-domain)
            TAB_DOMAIN="$2"
            shift 2
            ;;
        --bot-domain)
            BOT_DOMAIN="$2"
            shift 2
            ;;
        --output-env)
            OUTPUT_ENV="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

#-------------------------------------------------------------------------------
# Validate prerequisites
#-------------------------------------------------------------------------------

log_info "Validating prerequisites..."

# Check Azure CLI is installed
if ! command -v az &> /dev/null; then
    log_error "Azure CLI (az) is not installed. Please install it first."
    exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
    log_error "Not logged in to Azure CLI. Please run 'az login' first."
    exit 1
fi

# Get current tenant info
TENANT_A_ID=$(az account show --query tenantId -o tsv)
TENANT_A_NAME=$(az account show --query tenantDisplayName -o tsv 2>/dev/null || echo "Unknown")
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)

log_info "Current context:"
log_info "  Tenant ID: $TENANT_A_ID"
log_info "  Tenant Name: $TENANT_A_NAME"
log_info "  Subscription: $SUBSCRIPTION_NAME"

# Validate required parameters
if [[ -z "$TAB_DOMAIN" ]]; then
    log_warn "No --tab-domain specified. Using placeholder."
    TAB_DOMAIN="YOUR_TAB_DOMAIN.azurestaticapps.net"
fi

if [[ -z "$BOT_DOMAIN" ]]; then
    log_warn "No --bot-domain specified. Using placeholder."
    BOT_DOMAIN="YOUR_BOT_DOMAIN.azurecontainer.io"
fi

if [[ "$DRY_RUN" == true ]]; then
    log_warn "DRY RUN MODE - No changes will be made"
fi

echo ""
log_info "Configuration:"
log_info "  App Name Prefix: $APP_NAME_PREFIX"
log_info "  Tab Domain: $TAB_DOMAIN"
log_info "  Bot Domain: $BOT_DOMAIN"
log_info "  Output File: $OUTPUT_ENV"
echo ""

#===============================================================================
# STEP 1: Create Bot App Registration
#===============================================================================

log_info "=========================================="
log_info "STEP 1: Creating Bot App Registration"
log_info "=========================================="

BOT_APP_NAME="${APP_NAME_PREFIX}-Bot"
BOT_APP_CLIENT_ID=""
BOT_APP_SECRET=""

if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would create app: $BOT_APP_NAME"
    log_info "[DRY RUN] - Multi-tenant: Yes"
    log_info "[DRY RUN] - Identifier URI: api://$BOT_DOMAIN/$BOT_APP_NAME"
    BOT_APP_CLIENT_ID="<DRY_RUN_BOT_APP_ID>"
    BOT_APP_SECRET="<DRY_RUN_BOT_SECRET>"
else
    # Check if app already exists
    EXISTING_BOT=$(az ad app list --display-name "$BOT_APP_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")

    if [[ -n "$EXISTING_BOT" && "$EXISTING_BOT" != "null" ]]; then
        log_warn "Bot app '$BOT_APP_NAME' already exists with ID: $EXISTING_BOT"
        read -p "Use existing app? (y/N): " USE_EXISTING
        if [[ "$USE_EXISTING" =~ ^[Yy]$ ]]; then
            BOT_APP_CLIENT_ID="$EXISTING_BOT"
        else
            log_error "Aborting. Delete the existing app or use a different prefix."
            exit 1
        fi
    else
        log_info "Creating Bot app registration..."

        # Create the bot app registration (multi-tenant)
        BOT_APP_CLIENT_ID=$(az ad app create \
            --display-name "$BOT_APP_NAME" \
            --sign-in-audience "AzureADMultipleOrgs" \
            --query appId -o tsv)

        log_success "Created Bot app: $BOT_APP_CLIENT_ID"
    fi

    # Create a client secret for the bot
    log_info "Creating client secret for Bot app..."
    BOT_SECRET_RESPONSE=$(az ad app credential reset \
        --id "$BOT_APP_CLIENT_ID" \
        --display-name "Bot Framework Secret" \
        --years 2 \
        --query password -o tsv)

    BOT_APP_SECRET="$BOT_SECRET_RESPONSE"
    log_success "Created Bot app secret (save this - it won't be shown again)"
fi

#===============================================================================
# STEP 2: Create Tab/API App Registration
#===============================================================================

log_info ""
log_info "=========================================="
log_info "STEP 2: Creating Tab/API App Registration"
log_info "=========================================="

TAB_APP_NAME="${APP_NAME_PREFIX}-Tab"
TAB_APP_CLIENT_ID=""
TAB_APP_SECRET=""

# App roles definition for the Tab/API app
APP_ROLES_JSON='[
    {
        "allowedMemberTypes": ["User"],
        "description": "Sales users who can create and view their own orders",
        "displayName": "Sales User",
        "isEnabled": true,
        "value": "SalesUser"
    },
    {
        "allowedMemberTypes": ["User"],
        "description": "Sales managers who can view team orders and reports",
        "displayName": "Sales Manager",
        "isEnabled": true,
        "value": "SalesManager"
    },
    {
        "allowedMemberTypes": ["User"],
        "description": "Operations auditors with read-only access to all audit bundles",
        "displayName": "Ops Auditor",
        "isEnabled": true,
        "value": "OpsAuditor"
    }
]'

if [[ "$DRY_RUN" == true ]]; then
    log_info "[DRY RUN] Would create app: $TAB_APP_NAME"
    log_info "[DRY RUN] - Multi-tenant: Yes"
    log_info "[DRY RUN] - Identifier URI: api://$TAB_DOMAIN/<app-id>"
    log_info "[DRY RUN] - Redirect URIs:"
    log_info "[DRY RUN]   - https://$TAB_DOMAIN/auth-end"
    log_info "[DRY RUN]   - https://$TAB_DOMAIN/auth-start"
    log_info "[DRY RUN] - App Roles: SalesUser, SalesManager, OpsAuditor"
    TAB_APP_CLIENT_ID="<DRY_RUN_TAB_APP_ID>"
    TAB_APP_SECRET="<DRY_RUN_TAB_SECRET>"
else
    # Check if app already exists
    EXISTING_TAB=$(az ad app list --display-name "$TAB_APP_NAME" --query "[0].appId" -o tsv 2>/dev/null || echo "")

    if [[ -n "$EXISTING_TAB" && "$EXISTING_TAB" != "null" ]]; then
        log_warn "Tab app '$TAB_APP_NAME' already exists with ID: $EXISTING_TAB"
        read -p "Use existing app? (y/N): " USE_EXISTING
        if [[ "$USE_EXISTING" =~ ^[Yy]$ ]]; then
            TAB_APP_CLIENT_ID="$EXISTING_TAB"
        else
            log_error "Aborting. Delete the existing app or use a different prefix."
            exit 1
        fi
    else
        log_info "Creating Tab/API app registration..."

        # Create the tab app registration (multi-tenant)
        TAB_APP_CLIENT_ID=$(az ad app create \
            --display-name "$TAB_APP_NAME" \
            --sign-in-audience "AzureADMultipleOrgs" \
            --web-redirect-uris \
                "https://$TAB_DOMAIN/auth-end" \
                "https://$TAB_DOMAIN/auth-start" \
                "https://$TAB_DOMAIN/blank-auth-end.html" \
            --enable-id-token-issuance true \
            --enable-access-token-issuance true \
            --query appId -o tsv)

        log_success "Created Tab app: $TAB_APP_CLIENT_ID"

        # Set the identifier URI
        log_info "Setting identifier URI..."
        az ad app update \
            --id "$TAB_APP_CLIENT_ID" \
            --identifier-uris "api://$TAB_DOMAIN/$TAB_APP_CLIENT_ID"

        # Add app roles
        log_info "Adding app roles..."

        # Generate unique GUIDs for app roles
        SALES_USER_ID=$(uuidgen)
        SALES_MANAGER_ID=$(uuidgen)
        OPS_AUDITOR_ID=$(uuidgen)

        APP_ROLES_WITH_IDS=$(cat << EOF
[
    {
        "allowedMemberTypes": ["User"],
        "description": "Sales users who can create and view their own orders",
        "displayName": "Sales User",
        "isEnabled": true,
        "id": "$SALES_USER_ID",
        "value": "SalesUser"
    },
    {
        "allowedMemberTypes": ["User"],
        "description": "Sales managers who can view team orders and reports",
        "displayName": "Sales Manager",
        "isEnabled": true,
        "id": "$SALES_MANAGER_ID",
        "value": "SalesManager"
    },
    {
        "allowedMemberTypes": ["User"],
        "description": "Operations auditors with read-only access to all audit bundles",
        "displayName": "Ops Auditor",
        "isEnabled": true,
        "id": "$OPS_AUDITOR_ID",
        "value": "OpsAuditor"
    }
]
EOF
)

        az ad app update \
            --id "$TAB_APP_CLIENT_ID" \
            --app-roles "$APP_ROLES_WITH_IDS"

        log_success "Added app roles: SalesUser, SalesManager, OpsAuditor"

        # Expose an API scope
        log_info "Exposing API scope..."

        # First, create an OAuth2 permission scope
        SCOPE_ID=$(uuidgen)

        API_SCOPES=$(cat << EOF
{
    "oauth2PermissionScopes": [
        {
            "adminConsentDescription": "Allow the application to access Order Processing API on behalf of the signed-in user.",
            "adminConsentDisplayName": "Access Order Processing API",
            "id": "$SCOPE_ID",
            "isEnabled": true,
            "type": "User",
            "userConsentDescription": "Allow the application to access Order Processing API on your behalf.",
            "userConsentDisplayName": "Access Order Processing API",
            "value": "access_as_user"
        }
    ]
}
EOF
)

        az ad app update \
            --id "$TAB_APP_CLIENT_ID" \
            --set api="$API_SCOPES"

        log_success "Exposed API scope: access_as_user"
    fi

    # Create a client secret for the tab app
    log_info "Creating client secret for Tab app..."
    TAB_SECRET_RESPONSE=$(az ad app credential reset \
        --id "$TAB_APP_CLIENT_ID" \
        --display-name "Tab API Secret" \
        --years 2 \
        --query password -o tsv)

    TAB_APP_SECRET="$TAB_SECRET_RESPONSE"
    log_success "Created Tab app secret (save this - it won't be shown again)"
fi

#===============================================================================
# STEP 3: Output Configuration
#===============================================================================

log_info ""
log_info "=========================================="
log_info "STEP 3: Writing Configuration"
log_info "=========================================="

# Create output directory if needed
OUTPUT_DIR=$(dirname "$OUTPUT_ENV")
if [[ "$OUTPUT_DIR" != "." && ! -d "$OUTPUT_DIR" ]]; then
    mkdir -p "$OUTPUT_DIR"
fi

# Write environment file
cat > "$OUTPUT_ENV" << EOF
#===============================================================================
# Entra ID App Registrations for Order Processing
# Generated: $(date -Iseconds)
# Tenant A ID: $TENANT_A_ID
#===============================================================================

# Bot App Registration (Multi-tenant)
BOT_APP_CLIENT_ID=$BOT_APP_CLIENT_ID
BOT_APP_SECRET=$BOT_APP_SECRET
BOT_APP_TENANT_ID=$TENANT_A_ID

# Tab/API App Registration (Multi-tenant with App Roles)
TAB_APP_CLIENT_ID=$TAB_APP_CLIENT_ID
TAB_APP_SECRET=$TAB_APP_SECRET
TAB_APP_TENANT_ID=$TENANT_A_ID

# Domains (update these for your deployment)
TAB_DOMAIN=$TAB_DOMAIN
BOT_DOMAIN=$BOT_DOMAIN

# Bot Framework Configuration
MICROSOFT_APP_ID=$BOT_APP_CLIENT_ID
MICROSOFT_APP_PASSWORD=$BOT_APP_SECRET
MICROSOFT_APP_TYPE=MultiTenant
MICROSOFT_APP_TENANT_ID=$TENANT_A_ID

# Teams Tab SSO Configuration
# Identifier URI: api://$TAB_DOMAIN/$TAB_APP_CLIENT_ID
# Scope: api://$TAB_DOMAIN/$TAB_APP_CLIENT_ID/access_as_user

#===============================================================================
# Next Steps:
# 1. Store secrets in Azure Key Vault (do not commit this file!)
# 2. Update manifest.json placeholders with these values
# 3. Package the Teams app using scripts/package-teams-app.sh
# 4. Provide TENANT_B_ADMIN_GUIDE.md to Tenant B administrator
#===============================================================================
EOF

log_success "Configuration written to: $OUTPUT_ENV"

#===============================================================================
# Summary
#===============================================================================

echo ""
log_info "=========================================="
log_info "SUMMARY"
log_info "=========================================="
echo ""
echo "Bot App Registration:"
echo "  Name:       $BOT_APP_NAME"
echo "  Client ID:  $BOT_APP_CLIENT_ID"
echo "  Tenant ID:  $TENANT_A_ID"
echo "  Type:       Multi-tenant"
echo ""
echo "Tab/API App Registration:"
echo "  Name:       $TAB_APP_NAME"
echo "  Client ID:  $TAB_APP_CLIENT_ID"
echo "  Tenant ID:  $TENANT_A_ID"
echo "  Type:       Multi-tenant"
echo "  App Roles:  SalesUser, SalesManager, OpsAuditor"
echo "  API Scope:  api://$TAB_DOMAIN/$TAB_APP_CLIENT_ID/access_as_user"
echo ""
echo "Redirect URIs configured:"
echo "  - https://$TAB_DOMAIN/auth-end"
echo "  - https://$TAB_DOMAIN/auth-start"
echo "  - https://$TAB_DOMAIN/blank-auth-end.html"
echo ""

log_warn "IMPORTANT: Store the secrets in Azure Key Vault immediately!"
log_warn "The .env.entra file contains secrets and should NOT be committed."
echo ""

log_info "Next steps:"
echo "  1. Review and update $OUTPUT_ENV with correct domain values"
echo "  2. Store secrets in Azure Key Vault"
echo "  3. Run: ./scripts/package-teams-app.sh"
echo "  4. Follow docs/TENANT_B_ADMIN_GUIDE.md for Tenant B onboarding"
echo ""

log_success "Entra app registrations complete!"
