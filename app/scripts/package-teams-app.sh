#!/usr/bin/env bash
#===============================================================================
# package-teams-app.sh
#
# Packages the Microsoft Teams app (manifest.json + icons) into a deployable
# zip file that can be uploaded to Teams Admin Center.
#
# The script performs the following:
#   1. Validates manifest.json is valid JSON
#   2. Replaces placeholder values with environment variables or provided values
#   3. Validates required icons exist
#   4. Creates a zip package ready for Teams deployment
#
# Usage:
#   ./package-teams-app.sh [options]
#
# Options:
#   --env-file           Path to .env file with app IDs (default: .env.entra)
#   --output             Output zip file path (default: teams-app.zip)
#   --bot-app-id         Bot App Client ID (overrides env file)
#   --tab-app-id         Tab App Client ID (overrides env file)
#   --tab-domain         Tab domain (overrides env file)
#   --bot-domain         Bot domain (overrides env file)
#   --validate-only      Only validate, don't create package
#
#===============================================================================

set -euo pipefail

# Script directory and project paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEAMS_APP_DIR="$PROJECT_ROOT/teams-app"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default values
ENV_FILE="$PROJECT_ROOT/.env.entra"
OUTPUT_FILE="$PROJECT_ROOT/teams-app.zip"
BOT_APP_CLIENT_ID=""
TAB_APP_CLIENT_ID=""
TAB_DOMAIN=""
BOT_DOMAIN=""
VALIDATE_ONLY=false

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

Packages the Teams app manifest and icons into a deployable zip.

Options:
    --env-file <path>        Path to .env file (default: .env.entra)
    --output <path>          Output zip path (default: teams-app.zip)
    --bot-app-id <id>        Bot App Client ID
    --tab-app-id <id>        Tab App Client ID
    --tab-domain <domain>    Tab domain
    --bot-domain <domain>    Bot domain
    --validate-only          Validate without creating package
    -h, --help               Show this help

Example:
    $0 --env-file .env.entra --output dist/teams-app.zip
EOF
}

#-------------------------------------------------------------------------------
# Parse arguments
#-------------------------------------------------------------------------------

while [[ $# -gt 0 ]]; do
    case $1 in
        --env-file)
            ENV_FILE="$2"
            shift 2
            ;;
        --output)
            OUTPUT_FILE="$2"
            shift 2
            ;;
        --bot-app-id)
            BOT_APP_CLIENT_ID="$2"
            shift 2
            ;;
        --tab-app-id)
            TAB_APP_CLIENT_ID="$2"
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
        --validate-only)
            VALIDATE_ONLY=true
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

#===============================================================================
# STEP 1: Load Environment Variables
#===============================================================================

log_info "=========================================="
log_info "STEP 1: Loading Configuration"
log_info "=========================================="

# Load from env file if it exists
if [[ -f "$ENV_FILE" ]]; then
    log_info "Loading configuration from: $ENV_FILE"
    # Source the env file (handle lines with = correctly)
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ "$key" =~ ^#.*$ || -z "$key" ]] && continue
        # Remove leading/trailing whitespace
        key=$(echo "$key" | xargs)
        value=$(echo "$value" | xargs)
        # Only set if not already set via command line
        case "$key" in
            BOT_APP_CLIENT_ID)
                [[ -z "$BOT_APP_CLIENT_ID" ]] && BOT_APP_CLIENT_ID="$value"
                ;;
            TAB_APP_CLIENT_ID)
                [[ -z "$TAB_APP_CLIENT_ID" ]] && TAB_APP_CLIENT_ID="$value"
                ;;
            TAB_DOMAIN)
                [[ -z "$TAB_DOMAIN" ]] && TAB_DOMAIN="$value"
                ;;
            BOT_DOMAIN)
                [[ -z "$BOT_DOMAIN" ]] && BOT_DOMAIN="$value"
                ;;
        esac
    done < "$ENV_FILE"
    log_success "Loaded configuration from env file"
else
    log_warn "Env file not found: $ENV_FILE"
    log_info "Using command-line arguments or placeholders"
fi

# Set defaults for missing values (for validation)
BOT_APP_CLIENT_ID="${BOT_APP_CLIENT_ID:-{{BOT_APP_CLIENT_ID}}}"
TAB_APP_CLIENT_ID="${TAB_APP_CLIENT_ID:-{{TAB_APP_CLIENT_ID}}}"
TAB_DOMAIN="${TAB_DOMAIN:-{{TAB_DOMAIN}}}"
BOT_DOMAIN="${BOT_DOMAIN:-{{BOT_DOMAIN}}}"

log_info "Configuration:"
log_info "  Bot App ID:  $BOT_APP_CLIENT_ID"
log_info "  Tab App ID:  $TAB_APP_CLIENT_ID"
log_info "  Tab Domain:  $TAB_DOMAIN"
log_info "  Bot Domain:  $BOT_DOMAIN"
echo ""

#===============================================================================
# STEP 2: Validate Source Files
#===============================================================================

log_info "=========================================="
log_info "STEP 2: Validating Source Files"
log_info "=========================================="

VALIDATION_ERRORS=0

# Check manifest.json exists
MANIFEST_FILE="$TEAMS_APP_DIR/manifest.json"
if [[ ! -f "$MANIFEST_FILE" ]]; then
    log_error "manifest.json not found at: $MANIFEST_FILE"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
else
    log_success "Found manifest.json"

    # Validate JSON syntax
    if command -v jq &> /dev/null; then
        if jq empty "$MANIFEST_FILE" 2>/dev/null; then
            log_success "manifest.json is valid JSON"
        else
            log_error "manifest.json is not valid JSON"
            VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        fi
    elif command -v python3 &> /dev/null; then
        if python3 -c "import json; json.load(open('$MANIFEST_FILE'))" 2>/dev/null; then
            log_success "manifest.json is valid JSON"
        else
            log_error "manifest.json is not valid JSON"
            VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
        fi
    else
        log_warn "Neither jq nor python3 available - skipping JSON validation"
    fi
fi

# Check color.png exists (192x192 required by Teams)
COLOR_ICON="$TEAMS_APP_DIR/color.png"
if [[ ! -f "$COLOR_ICON" ]]; then
    log_error "color.png not found at: $COLOR_ICON"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
else
    log_success "Found color.png"
    # Check file size (should be > 0)
    if [[ ! -s "$COLOR_ICON" ]]; then
        log_error "color.png is empty"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
fi

# Check outline.png exists (32x32 required by Teams)
OUTLINE_ICON="$TEAMS_APP_DIR/outline.png"
if [[ ! -f "$OUTLINE_ICON" ]]; then
    log_error "outline.png not found at: $OUTLINE_ICON"
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
else
    log_success "Found outline.png"
    # Check file size (should be > 0)
    if [[ ! -s "$OUTLINE_ICON" ]]; then
        log_error "outline.png is empty"
        VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    fi
fi

# Check for placeholder values
if [[ "$BOT_APP_CLIENT_ID" == *"{{"* ]]; then
    log_warn "BOT_APP_CLIENT_ID contains placeholder - package will need manual editing"
fi
if [[ "$TAB_APP_CLIENT_ID" == *"{{"* ]]; then
    log_warn "TAB_APP_CLIENT_ID contains placeholder - package will need manual editing"
fi
if [[ "$TAB_DOMAIN" == *"{{"* ]]; then
    log_warn "TAB_DOMAIN contains placeholder - package will need manual editing"
fi

if [[ $VALIDATION_ERRORS -gt 0 ]]; then
    log_error "Validation failed with $VALIDATION_ERRORS error(s)"
    exit 1
fi

log_success "All source files validated"
echo ""

if [[ "$VALIDATE_ONLY" == true ]]; then
    log_success "Validation complete (--validate-only mode)"
    exit 0
fi

#===============================================================================
# STEP 3: Create Temporary Directory and Process Files
#===============================================================================

log_info "=========================================="
log_info "STEP 3: Processing Manifest"
log_info "=========================================="

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

log_info "Using temp directory: $TEMP_DIR"

# Copy icons to temp directory
cp "$COLOR_ICON" "$TEMP_DIR/color.png"
cp "$OUTLINE_ICON" "$TEMP_DIR/outline.png"
log_success "Copied icon files"

# Process manifest.json - replace placeholders
log_info "Replacing placeholders in manifest.json..."

# Read manifest and replace placeholders
sed -e "s|{{BOT_APP_CLIENT_ID}}|$BOT_APP_CLIENT_ID|g" \
    -e "s|{{TAB_APP_CLIENT_ID}}|$TAB_APP_CLIENT_ID|g" \
    -e "s|{{TAB_DOMAIN}}|$TAB_DOMAIN|g" \
    -e "s|{{BOT_DOMAIN}}|$BOT_DOMAIN|g" \
    "$MANIFEST_FILE" > "$TEMP_DIR/manifest.json"

log_success "Processed manifest.json"

# Validate the processed manifest
if command -v jq &> /dev/null; then
    # Pretty print and verify
    if jq . "$TEMP_DIR/manifest.json" > /dev/null 2>&1; then
        log_success "Processed manifest is valid JSON"
    else
        log_error "Processed manifest is not valid JSON"
        exit 1
    fi

    # Show summary of manifest
    echo ""
    log_info "Manifest summary:"
    jq -r '"  App ID: \(.id)\n  Name: \(.name.short)\n  Version: \(.version)\n  Bot ID: \(.bots[0].botId // "none")\n  Tabs: \(.staticTabs | length)"' "$TEMP_DIR/manifest.json" 2>/dev/null || true
    echo ""
fi

#===============================================================================
# STEP 4: Create Zip Package
#===============================================================================

log_info "=========================================="
log_info "STEP 4: Creating Package"
log_info "=========================================="

# Ensure output directory exists
OUTPUT_DIR=$(dirname "$OUTPUT_FILE")
if [[ "$OUTPUT_DIR" != "." && ! -d "$OUTPUT_DIR" ]]; then
    mkdir -p "$OUTPUT_DIR"
    log_info "Created output directory: $OUTPUT_DIR"
fi

# Remove existing package if present
if [[ -f "$OUTPUT_FILE" ]]; then
    rm "$OUTPUT_FILE"
    log_info "Removed existing package"
fi

# Create zip file (must be at root level, not in a subdirectory)
cd "$TEMP_DIR"
zip -q "$OUTPUT_FILE" manifest.json color.png outline.png

log_success "Created package: $OUTPUT_FILE"

# Show package info
PACKAGE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
log_info "Package size: $PACKAGE_SIZE"

# List package contents
echo ""
log_info "Package contents:"
unzip -l "$OUTPUT_FILE"

#===============================================================================
# Summary
#===============================================================================

echo ""
log_info "=========================================="
log_info "SUMMARY"
log_info "=========================================="
echo ""
log_success "Teams app package created successfully!"
echo ""
echo "Package location: $OUTPUT_FILE"
echo ""
log_info "Next steps:"
echo "  1. Upload to Teams Admin Center:"
echo "     - Go to https://admin.teams.microsoft.com"
echo "     - Navigate to Teams apps > Manage apps"
echo "     - Click 'Upload new app'"
echo "     - Select: $OUTPUT_FILE"
echo ""
echo "  2. Configure app policies to allow users to install"
echo ""
echo "  3. Follow docs/TENANT_B_ADMIN_GUIDE.md for cross-tenant setup"
echo ""

# Check for remaining placeholders
if grep -q "{{" "$TEMP_DIR/manifest.json"; then
    log_warn "Package contains unresolved placeholders!"
    log_warn "Edit the manifest.json in the zip or provide values via --bot-app-id, etc."
fi
