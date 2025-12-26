#!/bin/bash
set -e

# ============================================
# Infrastructure Validation Script
# ============================================
# Usage: ./validate.sh <environment>
# Example: ./validate.sh dev

# ============================================
# Parameters
# ============================================

ENVIRONMENT=${1:-dev}

if [[ ! "$ENVIRONMENT" =~ ^(dev|test|prod)$ ]]; then
  echo "Error: Environment must be one of: dev, test, prod"
  exit 1
fi

echo "============================================"
echo "Infrastructure Validation"
echo "============================================"
echo "Environment: $ENVIRONMENT"
echo "============================================"
echo ""

# ============================================
# Get Resource Names
# ============================================

RESOURCE_GROUP="order-processing-${ENVIRONMENT}-rg"

echo "Resource Group: $RESOURCE_GROUP"
echo ""

# Check if resource group exists
if ! az group show --name "$RESOURCE_GROUP" &> /dev/null; then
  echo "Error: Resource group '$RESOURCE_GROUP' not found"
  echo "Please run deployment first."
  exit 1
fi

echo "✓ Resource group exists"
echo ""

# ============================================
# Validate Storage Account
# ============================================

echo "Validating Storage Account..."
STORAGE_ACCOUNTS=$(az storage account list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv)

if [[ -z "$STORAGE_ACCOUNTS" ]]; then
  echo "✗ No storage account found"
else
  for STORAGE in $STORAGE_ACCOUNTS; do
    echo "  Storage Account: $STORAGE"

    # Check containers
    CONTAINERS=$(az storage container list --account-name "$STORAGE" --query "[].name" -o tsv --auth-mode login 2>/dev/null || echo "")
    if [[ -n "$CONTAINERS" ]]; then
      echo "    Containers:"
      echo "$CONTAINERS" | while read CONTAINER; do
        echo "      - $CONTAINER"
      done
    fi

    # Check queues
    QUEUES=$(az storage queue list --account-name "$STORAGE" --query "[].name" -o tsv --auth-mode login 2>/dev/null || echo "")
    if [[ -n "$QUEUES" ]]; then
      echo "    Queues:"
      echo "$QUEUES" | while read QUEUE; do
        echo "      - $QUEUE"
      done
    fi
  done
  echo "✓ Storage account validated"
fi
echo ""

# ============================================
# Validate Cosmos DB
# ============================================

echo "Validating Cosmos DB..."
COSMOS_ACCOUNTS=$(az cosmosdb list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv)

if [[ -z "$COSMOS_ACCOUNTS" ]]; then
  echo "✗ No Cosmos DB account found"
else
  for COSMOS in $COSMOS_ACCOUNTS; do
    echo "  Cosmos Account: $COSMOS"

    # Check databases
    DATABASES=$(az cosmosdb sql database list --account-name "$COSMOS" --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv)
    if [[ -n "$DATABASES" ]]; then
      echo "    Databases:"
      echo "$DATABASES" | while read DB; do
        echo "      - $DB"

        # Check containers
        CONTAINERS=$(az cosmosdb sql container list --account-name "$COSMOS" --resource-group "$RESOURCE_GROUP" --database-name "$DB" --query "[].name" -o tsv)
        if [[ -n "$CONTAINERS" ]]; then
          echo "        Containers:"
          echo "$CONTAINERS" | while read CONTAINER; do
            echo "          - $CONTAINER"
          done
        fi
      done
    fi
  done
  echo "✓ Cosmos DB validated"
fi
echo ""

# ============================================
# Validate Key Vault
# ============================================

echo "Validating Key Vault..."
KEY_VAULTS=$(az keyvault list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv)

if [[ -z "$KEY_VAULTS" ]]; then
  echo "✗ No Key Vault found"
else
  for KV in $KEY_VAULTS; do
    echo "  Key Vault: $KV"

    # Check secrets
    SECRETS=$(az keyvault secret list --vault-name "$KV" --query "[].name" -o tsv 2>/dev/null || echo "")
    if [[ -n "$SECRETS" ]]; then
      echo "    Secrets:"
      echo "$SECRETS" | while read SECRET; do
        echo "      - $SECRET"
      done
    else
      echo "    ⚠ No secrets found or insufficient permissions"
    fi
  done
  echo "✓ Key Vault validated"
fi
echo ""

# ============================================
# Validate Function Apps
# ============================================

echo "Validating Function Apps..."
FUNCTION_APPS=$(az functionapp list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv)

if [[ -z "$FUNCTION_APPS" ]]; then
  echo "✗ No Function Apps found"
else
  for FUNC in $FUNCTION_APPS; do
    echo "  Function App: $FUNC"

    # Check if app is running
    STATE=$(az functionapp show --name "$FUNC" --resource-group "$RESOURCE_GROUP" --query "state" -o tsv)
    echo "    State: $STATE"

    # Check managed identity
    IDENTITY=$(az functionapp identity show --name "$FUNC" --resource-group "$RESOURCE_GROUP" --query "principalId" -o tsv 2>/dev/null || echo "")
    if [[ -n "$IDENTITY" ]]; then
      echo "    Managed Identity: Enabled ($IDENTITY)"
    else
      echo "    ⚠ Managed Identity: Not enabled"
    fi
  done
  echo "✓ Function Apps validated"
fi
echo ""

# ============================================
# Validate Bot Service
# ============================================

echo "Validating Bot Service..."
BOTS=$(az bot show --resource-group "$RESOURCE_GROUP" --name "order-processing-${ENVIRONMENT}-bot" --query "name" -o tsv 2>/dev/null || echo "")

if [[ -z "$BOTS" ]]; then
  echo "✗ Bot Service not found"
else
  echo "  Bot: $BOTS"
  ENDPOINT=$(az bot show --resource-group "$RESOURCE_GROUP" --name "$BOTS" --query "properties.endpoint" -o tsv)
  echo "    Endpoint: $ENDPOINT"
  echo "✓ Bot Service validated"
fi
echo ""

# ============================================
# Validate Static Web App
# ============================================

echo "Validating Static Web App..."
STATIC_APPS=$(az staticwebapp list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv)

if [[ -z "$STATIC_APPS" ]]; then
  echo "✗ No Static Web App found"
else
  for APP in $STATIC_APPS; do
    echo "  Static Web App: $APP"
    HOSTNAME=$(az staticwebapp show --name "$APP" --resource-group "$RESOURCE_GROUP" --query "defaultHostname" -o tsv)
    echo "    URL: https://$HOSTNAME"
  done
  echo "✓ Static Web App validated"
fi
echo ""

# ============================================
# Validate Application Insights
# ============================================

echo "Validating Application Insights..."
APP_INSIGHTS=$(az monitor app-insights component show --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv 2>/dev/null || echo "")

if [[ -z "$APP_INSIGHTS" ]]; then
  echo "✗ Application Insights not found"
else
  echo "  Application Insights: $APP_INSIGHTS"
  echo "✓ Application Insights validated"
fi
echo ""

# ============================================
# Validate Log Analytics
# ============================================

echo "Validating Log Analytics..."
LOG_ANALYTICS=$(az monitor log-analytics workspace list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv)

if [[ -z "$LOG_ANALYTICS" ]]; then
  echo "✗ Log Analytics workspace not found"
else
  echo "  Log Analytics: $LOG_ANALYTICS"
  echo "✓ Log Analytics validated"
fi
echo ""

# ============================================
# Check RBAC Assignments
# ============================================

echo "Checking RBAC assignments..."

if [[ -n "$FUNCTION_APPS" ]]; then
  for FUNC in $FUNCTION_APPS; do
    PRINCIPAL_ID=$(az functionapp identity show --name "$FUNC" --resource-group "$RESOURCE_GROUP" --query "principalId" -o tsv 2>/dev/null || echo "")

    if [[ -n "$PRINCIPAL_ID" ]]; then
      echo "  $FUNC RBAC:"
      ROLES=$(az role assignment list --assignee "$PRINCIPAL_ID" --query "[].{Role:roleDefinitionName, Scope:scope}" -o table)
      if [[ -n "$ROLES" ]]; then
        echo "$ROLES" | tail -n +3 | while read -r line; do
          echo "    $line"
        done
      else
        echo "    ⚠ No role assignments found"
      fi
    fi
  done
  echo "✓ RBAC assignments checked"
fi
echo ""

# ============================================
# Validate AI Foundry
# ============================================

echo "Validating AI Foundry..."
AI_HUBS=$(az ml workspace list --resource-group "$RESOURCE_GROUP" --query "[?kind=='Hub'].name" -o tsv 2>/dev/null || echo "")

if [[ -z "$AI_HUBS" ]]; then
  echo "⚠ AI Foundry Hub not found (may not be deployed)"
else
  for HUB in $AI_HUBS; do
    echo "  AI Hub: $HUB"

    # Check projects
    PROJECTS=$(az ml workspace list --resource-group "$RESOURCE_GROUP" --query "[?kind=='Project'].name" -o tsv 2>/dev/null || echo "")
    if [[ -n "$PROJECTS" ]]; then
      echo "    Projects:"
      echo "$PROJECTS" | while read PROJECT; do
        echo "      - $PROJECT"
      done
    fi
  done
  echo "OK AI Foundry validated"
fi
echo ""

# ============================================
# Validate AI Services
# ============================================

echo "Validating AI Services..."
AI_SERVICES=$(az cognitiveservices account list --resource-group "$RESOURCE_GROUP" --query "[].name" -o tsv 2>/dev/null || echo "")

if [[ -z "$AI_SERVICES" ]]; then
  echo "⚠ AI Services not found (may not be deployed)"
else
  for SERVICE in $AI_SERVICES; do
    echo "  AI Service: $SERVICE"
    ENDPOINT=$(az cognitiveservices account show --name "$SERVICE" --resource-group "$RESOURCE_GROUP" --query "properties.endpoint" -o tsv)
    echo "    Endpoint: $ENDPOINT"
  done
  echo "OK AI Services validated"
fi
echo ""

# ============================================
# Summary
# ============================================

echo "============================================"
echo "Validation Complete"
echo "============================================"
echo ""
echo "Resource Group: $RESOURCE_GROUP"
echo ""
echo "Next steps:"
echo "1. Verify all resources are in 'Running' state"
echo "2. Set up secrets in Key Vault (use setup-secrets.sh)"
echo "3. Deploy application code to Function Apps"
echo "4. Configure Teams app manifest"
echo "5. Test end-to-end workflow"
echo ""
echo "============================================"
