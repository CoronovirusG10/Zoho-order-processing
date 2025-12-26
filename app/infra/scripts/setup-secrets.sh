#!/bin/bash
set -e

# ============================================
# Setup Key Vault Secrets Script
# ============================================
# Usage: ./setup-secrets.sh <environment> <key-vault-name>
# Example: ./setup-secrets.sh dev orderkvabc123

# ============================================
# Parameters
# ============================================

ENVIRONMENT=${1:-dev}
KEY_VAULT_NAME=${2}

if [[ -z "$KEY_VAULT_NAME" ]]; then
  echo "Error: Key Vault name is required"
  echo "Usage: ./setup-secrets.sh <environment> <key-vault-name>"
  exit 1
fi

echo "============================================"
echo "Key Vault Secrets Setup"
echo "============================================"
echo "Environment: $ENVIRONMENT"
echo "Key Vault: $KEY_VAULT_NAME"
echo "============================================"
echo ""

# ============================================
# Validate Key Vault exists
# ============================================

echo "Validating Key Vault access..."
if ! az keyvault show --name "$KEY_VAULT_NAME" &> /dev/null; then
  echo "Error: Key Vault '$KEY_VAULT_NAME' not found or not accessible"
  exit 1
fi
echo "Key Vault found."
echo ""

# ============================================
# Zoho OAuth Credentials
# ============================================

echo "============================================"
echo "Zoho OAuth Credentials"
echo "============================================"
echo ""
echo "Please obtain these values from Zoho Developer Console:"
echo "https://api-console.zoho.eu/"
echo ""

read -p "Enter Zoho Client ID: " ZOHO_CLIENT_ID
read -s -p "Enter Zoho Client Secret: " ZOHO_CLIENT_SECRET
echo ""
read -s -p "Enter Zoho Refresh Token: " ZOHO_REFRESH_TOKEN
echo ""
echo ""

if [[ -n "$ZOHO_CLIENT_ID" ]]; then
  echo "Setting ZohoClientId..."
  az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "ZohoClientId" \
    --value "$ZOHO_CLIENT_ID" \
    --output none
  echo "✓ ZohoClientId set"
fi

if [[ -n "$ZOHO_CLIENT_SECRET" ]]; then
  echo "Setting ZohoClientSecret..."
  az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "ZohoClientSecret" \
    --value "$ZOHO_CLIENT_SECRET" \
    --output none
  echo "✓ ZohoClientSecret set"
fi

if [[ -n "$ZOHO_REFRESH_TOKEN" ]]; then
  echo "Setting ZohoRefreshToken..."
  az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "ZohoRefreshToken" \
    --value "$ZOHO_REFRESH_TOKEN" \
    --output none
  echo "✓ ZohoRefreshToken set"
fi

echo ""

# ============================================
# Teams App Credentials
# ============================================

echo "============================================"
echo "Teams App Credentials"
echo "============================================"
echo ""
echo "Please register your app in Azure AD (Tenant B):"
echo "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
echo ""

read -p "Enter Teams App ID (Microsoft App ID): " TEAMS_APP_ID
read -s -p "Enter Teams App Password (Client Secret): " TEAMS_APP_PASSWORD
echo ""
echo ""

if [[ -n "$TEAMS_APP_ID" ]]; then
  echo "Setting TeamsAppId..."
  az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "TeamsAppId" \
    --value "$TEAMS_APP_ID" \
    --output none
  echo "✓ TeamsAppId set"
fi

if [[ -n "$TEAMS_APP_PASSWORD" ]]; then
  echo "Setting TeamsAppPassword..."
  az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "TeamsAppPassword" \
    --value "$TEAMS_APP_PASSWORD" \
    --output none
  echo "✓ TeamsAppPassword set"
fi

echo ""

# ============================================
# Optional: External AI Provider Keys
# ============================================

echo "============================================"
echo "External AI Provider Keys (Optional)"
echo "============================================"
echo ""
read -p "Do you want to add external AI provider keys? (yes/no): " ADD_AI_KEYS

if [[ "$ADD_AI_KEYS" =~ ^[Yy][Ee][Ss]$ ]]; then
  echo ""
  read -p "Enter Google Gemini API Key (or leave empty): " GEMINI_API_KEY
  read -p "Enter xAI API Key (or leave empty): " XAI_API_KEY

  if [[ -n "$GEMINI_API_KEY" ]]; then
    echo "Setting GeminiApiKey..."
    az keyvault secret set \
      --vault-name "$KEY_VAULT_NAME" \
      --name "GeminiApiKey" \
      --value "$GEMINI_API_KEY" \
      --output none
    echo "✓ GeminiApiKey set"
  fi

  if [[ -n "$XAI_API_KEY" ]]; then
    echo "Setting XAIApiKey..."
    az keyvault secret set \
      --vault-name "$KEY_VAULT_NAME" \
      --name "XAIApiKey" \
      --value "$XAI_API_KEY" \
      --output none
    echo "✓ XAIApiKey set"
  fi
fi

echo ""

# ============================================
# Summary
# ============================================

echo "============================================"
echo "Secrets Setup Complete"
echo "============================================"
echo ""
echo "Listing all secrets in Key Vault:"
az keyvault secret list --vault-name "$KEY_VAULT_NAME" --query "[].name" -o table
echo ""
echo "============================================"
echo "Next Steps:"
echo "============================================"
echo "1. Verify secrets are correctly set"
echo "2. Configure Function App to use Key Vault references"
echo "3. Test Zoho API connectivity"
echo "4. Deploy Teams app manifest"
echo "============================================"
