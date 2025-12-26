#!/bin/bash
set -e

# ============================================
# Azure Bicep Deployment Script
# ============================================
# Usage: ./deploy.sh <environment> [location] [--what-if]
# Example: ./deploy.sh dev swedencentral
# Example: ./deploy.sh prod swedencentral --what-if

# ============================================
# Parameters
# ============================================

ENVIRONMENT=${1:-dev}
LOCATION=${2:-swedencentral}
WHAT_IF=${3:-}

if [[ ! "$ENVIRONMENT" =~ ^(dev|test|prod)$ ]]; then
  echo "Error: Environment must be one of: dev, test, prod"
  exit 1
fi

# ============================================
# Variables
# ============================================

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATE_FILE="$INFRA_DIR/main.bicep"
PARAMETERS_FILE="$INFRA_DIR/main.parameters.${ENVIRONMENT}.json"
DEPLOYMENT_NAME="order-processing-${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"

echo "============================================"
echo "Order Processing Infrastructure Deployment"
echo "============================================"
echo "Environment: $ENVIRONMENT"
echo "Location: $LOCATION"
echo "Template: $TEMPLATE_FILE"
echo "Parameters: $PARAMETERS_FILE"
echo "Deployment Name: $DEPLOYMENT_NAME"
echo "============================================"
echo ""

# ============================================
# Validate Prerequisites
# ============================================

echo "Checking prerequisites..."

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
  echo "Error: Azure CLI is not installed. Please install it from https://aka.ms/azure-cli"
  exit 1
fi

# Check if logged in
if ! az account show &> /dev/null; then
  echo "Error: Not logged in to Azure. Please run 'az login'"
  exit 1
fi

# Check if bicep is installed
if ! az bicep version &> /dev/null; then
  echo "Installing Bicep CLI..."
  az bicep install
fi

echo "Prerequisites check completed."
echo ""

# ============================================
# Display Current Context
# ============================================

SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

echo "Current Azure Context:"
echo "  Subscription: $SUBSCRIPTION_NAME"
echo "  Subscription ID: $SUBSCRIPTION_ID"
echo ""

read -p "Is this the correct subscription? (yes/no): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "Deployment cancelled. Please run 'az account set --subscription <subscription-id>' to select the correct subscription."
  exit 1
fi

# ============================================
# What-If Analysis (Optional)
# ============================================

if [[ "$WHAT_IF" == "--what-if" ]]; then
  echo ""
  echo "Running what-if analysis..."
  echo ""

  az deployment sub what-if \
    --name "$DEPLOYMENT_NAME" \
    --location "$LOCATION" \
    --template-file "$TEMPLATE_FILE" \
    --parameters "@$PARAMETERS_FILE" \
    --parameters environment="$ENVIRONMENT" location="$LOCATION"

  echo ""
  read -p "Do you want to proceed with the deployment? (yes/no): " PROCEED
  if [[ ! "$PROCEED" =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Deployment cancelled."
    exit 0
  fi
fi

# ============================================
# Validate Template
# ============================================

echo ""
echo "Validating Bicep template..."
echo ""

az deployment sub validate \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file "$TEMPLATE_FILE" \
  --parameters "@$PARAMETERS_FILE" \
  --parameters environment="$ENVIRONMENT" location="$LOCATION"

if [ $? -ne 0 ]; then
  echo "Error: Template validation failed."
  exit 1
fi

echo "Template validation succeeded."
echo ""

# ============================================
# Deploy Infrastructure
# ============================================

echo "Starting deployment..."
echo ""

az deployment sub create \
  --name "$DEPLOYMENT_NAME" \
  --location "$LOCATION" \
  --template-file "$TEMPLATE_FILE" \
  --parameters "@$PARAMETERS_FILE" \
  --parameters environment="$ENVIRONMENT" location="$LOCATION" \
  --output table

if [ $? -ne 0 ]; then
  echo ""
  echo "Error: Deployment failed."
  exit 1
fi

# ============================================
# Display Deployment Outputs
# ============================================

echo ""
echo "============================================"
echo "Deployment completed successfully!"
echo "============================================"
echo ""

echo "Retrieving deployment outputs..."
echo ""

RESOURCE_GROUP=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs.resourceGroupName.value -o tsv)
STORAGE_ACCOUNT=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs.storageAccountName.value -o tsv)
COSMOS_ACCOUNT=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs.cosmosAccountName.value -o tsv)
KEY_VAULT=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs.keyVaultName.value -o tsv)
STATIC_WEB_APP_URL=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs.staticWebAppUrl.value -o tsv)
BOT_NAME=$(az deployment sub show --name "$DEPLOYMENT_NAME" --query properties.outputs.botName.value -o tsv)

echo "Deployment Outputs:"
echo "  Resource Group: $RESOURCE_GROUP"
echo "  Storage Account: $STORAGE_ACCOUNT"
echo "  Cosmos DB Account: $COSMOS_ACCOUNT"
echo "  Key Vault: $KEY_VAULT"
echo "  Bot Name: $BOT_NAME"
echo "  Static Web App URL: https://$STATIC_WEB_APP_URL"
echo ""

# ============================================
# Next Steps
# ============================================

echo "============================================"
echo "Next Steps:"
echo "============================================"
echo "1. Update Zoho OAuth credentials in Key Vault:"
echo "   az keyvault secret set --vault-name $KEY_VAULT --name ZohoClientId --value '<your-client-id>'"
echo "   az keyvault secret set --vault-name $KEY_VAULT --name ZohoClientSecret --value '<your-client-secret>'"
echo "   az keyvault secret set --vault-name $KEY_VAULT --name ZohoRefreshToken --value '<your-refresh-token>'"
echo ""
echo "2. Register Teams App and update bot credentials:"
echo "   - Register app in Azure AD (Tenant B)"
echo "   - Update TeamsAppPassword in Key Vault"
echo ""
echo "3. Deploy Function App code:"
echo "   - Build and deploy parser, workflow, and zoho functions"
echo ""
echo "4. Deploy Static Web App:"
echo "   - Configure GitHub Actions or Azure DevOps"
echo "   - Deploy Teams tab application"
echo ""
echo "5. Configure Foundry Agent:"
echo "   - Link to existing Foundry Hub/Project"
echo "   - Deploy agent with tools"
echo ""
echo "============================================"
