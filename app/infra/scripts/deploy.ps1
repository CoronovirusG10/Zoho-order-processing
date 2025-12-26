# ============================================
# Azure Bicep Deployment Script (PowerShell)
# ============================================
# Usage: .\deploy.ps1 -Environment <env> [-Location <location>] [-WhatIf]
# Example: .\deploy.ps1 -Environment dev -Location swedencentral
# Example: .\deploy.ps1 -Environment prod -Location swedencentral -WhatIf

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('dev', 'test', 'prod')]
    [string]$Environment,

    [Parameter(Mandatory = $false)]
    [string]$Location = 'swedencentral',

    [Parameter(Mandatory = $false)]
    [switch]$WhatIf
)

# ============================================
# Variables
# ============================================

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$InfraDir = Split-Path -Parent $ScriptDir
$TemplateFile = Join-Path $InfraDir "main.bicep"
$ParametersFile = Join-Path $InfraDir "main.parameters.$Environment.json"
$DeploymentName = "order-processing-$Environment-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Order Processing Infrastructure Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor White
Write-Host "Location: $Location" -ForegroundColor White
Write-Host "Template: $TemplateFile" -ForegroundColor White
Write-Host "Parameters: $ParametersFile" -ForegroundColor White
Write-Host "Deployment Name: $DeploymentName" -ForegroundColor White
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================
# Validate Prerequisites
# ============================================

Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check if Azure CLI is installed
if (!(Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Azure CLI is not installed. Please install it from https://aka.ms/azure-cli"
    exit 1
}

# Check if logged in
try {
    $null = az account show 2>&1
} catch {
    Write-Error "Not logged in to Azure. Please run 'az login'"
    exit 1
}

# Check if bicep is installed
try {
    $null = az bicep version 2>&1
} catch {
    Write-Host "Installing Bicep CLI..." -ForegroundColor Yellow
    az bicep install
}

Write-Host "Prerequisites check completed." -ForegroundColor Green
Write-Host ""

# ============================================
# Display Current Context
# ============================================

$SubscriptionName = az account show --query name -o tsv
$SubscriptionId = az account show --query id -o tsv

Write-Host "Current Azure Context:" -ForegroundColor Cyan
Write-Host "  Subscription: $SubscriptionName" -ForegroundColor White
Write-Host "  Subscription ID: $SubscriptionId" -ForegroundColor White
Write-Host ""

$Confirm = Read-Host "Is this the correct subscription? (yes/no)"
if ($Confirm -notmatch "^[Yy][Ee][Ss]$") {
    Write-Host "Deployment cancelled. Please run 'az account set --subscription <subscription-id>' to select the correct subscription." -ForegroundColor Red
    exit 1
}

# ============================================
# What-If Analysis (Optional)
# ============================================

if ($WhatIf) {
    Write-Host ""
    Write-Host "Running what-if analysis..." -ForegroundColor Yellow
    Write-Host ""

    az deployment sub what-if `
        --name $DeploymentName `
        --location $Location `
        --template-file $TemplateFile `
        --parameters "@$ParametersFile" `
        --parameters environment=$Environment location=$Location

    Write-Host ""
    $Proceed = Read-Host "Do you want to proceed with the deployment? (yes/no)"
    if ($Proceed -notmatch "^[Yy][Ee][Ss]$") {
        Write-Host "Deployment cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# ============================================
# Validate Template
# ============================================

Write-Host ""
Write-Host "Validating Bicep template..." -ForegroundColor Yellow
Write-Host ""

az deployment sub validate `
    --name $DeploymentName `
    --location $Location `
    --template-file $TemplateFile `
    --parameters "@$ParametersFile" `
    --parameters environment=$Environment location=$Location

if ($LASTEXITCODE -ne 0) {
    Write-Error "Template validation failed."
    exit 1
}

Write-Host "Template validation succeeded." -ForegroundColor Green
Write-Host ""

# ============================================
# Deploy Infrastructure
# ============================================

Write-Host "Starting deployment..." -ForegroundColor Yellow
Write-Host ""

az deployment sub create `
    --name $DeploymentName `
    --location $Location `
    --template-file $TemplateFile `
    --parameters "@$ParametersFile" `
    --parameters environment=$Environment location=$Location `
    --output table

if ($LASTEXITCODE -ne 0) {
    Write-Error "Deployment failed."
    exit 1
}

# ============================================
# Display Deployment Outputs
# ============================================

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Retrieving deployment outputs..." -ForegroundColor Yellow
Write-Host ""

$ResourceGroup = az deployment sub show --name $DeploymentName --query properties.outputs.resourceGroupName.value -o tsv
$StorageAccount = az deployment sub show --name $DeploymentName --query properties.outputs.storageAccountName.value -o tsv
$CosmosAccount = az deployment sub show --name $DeploymentName --query properties.outputs.cosmosAccountName.value -o tsv
$KeyVault = az deployment sub show --name $DeploymentName --query properties.outputs.keyVaultName.value -o tsv
$StaticWebAppUrl = az deployment sub show --name $DeploymentName --query properties.outputs.staticWebAppUrl.value -o tsv
$BotName = az deployment sub show --name $DeploymentName --query properties.outputs.botName.value -o tsv

Write-Host "Deployment Outputs:" -ForegroundColor Cyan
Write-Host "  Resource Group: $ResourceGroup" -ForegroundColor White
Write-Host "  Storage Account: $StorageAccount" -ForegroundColor White
Write-Host "  Cosmos DB Account: $CosmosAccount" -ForegroundColor White
Write-Host "  Key Vault: $KeyVault" -ForegroundColor White
Write-Host "  Bot Name: $BotName" -ForegroundColor White
Write-Host "  Static Web App URL: https://$StaticWebAppUrl" -ForegroundColor White
Write-Host ""

# ============================================
# Next Steps
# ============================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "1. Update Zoho OAuth credentials in Key Vault:" -ForegroundColor Yellow
Write-Host "   az keyvault secret set --vault-name $KeyVault --name ZohoClientId --value '<your-client-id>'" -ForegroundColor White
Write-Host "   az keyvault secret set --vault-name $KeyVault --name ZohoClientSecret --value '<your-client-secret>'" -ForegroundColor White
Write-Host "   az keyvault secret set --vault-name $KeyVault --name ZohoRefreshToken --value '<your-refresh-token>'" -ForegroundColor White
Write-Host ""
Write-Host "2. Register Teams App and update bot credentials:" -ForegroundColor Yellow
Write-Host "   - Register app in Azure AD (Tenant B)" -ForegroundColor White
Write-Host "   - Update TeamsAppPassword in Key Vault" -ForegroundColor White
Write-Host ""
Write-Host "3. Deploy Function App code:" -ForegroundColor Yellow
Write-Host "   - Build and deploy parser, workflow, and zoho functions" -ForegroundColor White
Write-Host ""
Write-Host "4. Deploy Static Web App:" -ForegroundColor Yellow
Write-Host "   - Configure GitHub Actions or Azure DevOps" -ForegroundColor White
Write-Host "   - Deploy Teams tab application" -ForegroundColor White
Write-Host ""
Write-Host "5. Configure Foundry Agent:" -ForegroundColor Yellow
Write-Host "   - Link to existing Foundry Hub/Project" -ForegroundColor White
Write-Host "   - Deploy agent with tools" -ForegroundColor White
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
