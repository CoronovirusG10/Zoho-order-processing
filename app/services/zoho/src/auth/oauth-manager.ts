/**
 * Zoho OAuth Manager
 *
 * Manages OAuth 2.0 authentication for Zoho Books API:
 * - Retrieves credentials from Azure Key Vault (never stored in code)
 * - Handles access token refresh with thread-safe locking
 * - Caches access tokens with TTL
 * - Provides automatic retry on token expiration
 */

import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';
import axios, { AxiosError } from 'axios';
import { ZohoOAuthCredentials, ZohoAccessToken, ZohoTokenRefreshResponse } from '../types.js';
import { ZohoTokenStore } from './token-store.js';

export interface OAuthManagerConfig {
  keyVaultUrl?: string;  // Optional - can use env vars for dev
  clientIdSecretName?: string;
  clientSecretSecretName?: string;
  refreshTokenSecretName?: string;
  organizationIdSecretName?: string;
  regionSecretName?: string;
  // Direct credentials for dev mode (NOT for production)
  devMode?: boolean;
  devCredentials?: {
    clientId?: string;
    clientSecret?: string;
    refreshToken?: string;
    organizationId?: string;
    region?: ZohoOAuthCredentials['region'];
  };
}

export class ZohoOAuthManager {
  private readonly secretClient: SecretClient | null;
  private readonly tokenStore: ZohoTokenStore;
  private credentials: ZohoOAuthCredentials | null = null;
  private readonly config: OAuthManagerConfig & {
    clientIdSecretName: string;
    clientSecretSecretName: string;
    refreshTokenSecretName: string;
    organizationIdSecretName: string;
    regionSecretName: string;
  };
  private readonly isDevMode: boolean;

  constructor(config: OAuthManagerConfig) {
    // Determine if running in dev mode
    this.isDevMode = config.devMode ?? !config.keyVaultUrl;

    // Default secret names
    this.config = {
      ...config,
      clientIdSecretName: config.clientIdSecretName || 'zoho-client-id',
      clientSecretSecretName: config.clientSecretSecretName || 'zoho-client-secret',
      refreshTokenSecretName: config.refreshTokenSecretName || 'zoho-refresh-token',
      organizationIdSecretName: config.organizationIdSecretName || 'zoho-organization-id',
      regionSecretName: config.regionSecretName || 'zoho-region',
    };

    // Initialize Key Vault client only if URL is provided
    if (config.keyVaultUrl && !this.isDevMode) {
      const credential = new DefaultAzureCredential();
      this.secretClient = new SecretClient(config.keyVaultUrl, credential);
    } else {
      this.secretClient = null;
      if (!this.isDevMode) {
        console.warn('[ZohoOAuth] No Key Vault URL provided, will attempt to use environment variables');
      }
    }

    this.tokenStore = new ZohoTokenStore();
  }

  /**
   * Load OAuth credentials from Azure Key Vault or environment variables
   * Priority: devCredentials > environment variables > Key Vault
   */
  private async loadCredentials(): Promise<ZohoOAuthCredentials> {
    if (this.credentials) {
      return this.credentials;
    }

    try {
      // Priority 1: Dev credentials (if provided in config)
      if (this.isDevMode && this.config.devCredentials) {
        const dev = this.config.devCredentials;
        const clientId = dev.clientId || process.env.ZOHO_CLIENT_ID;
        const clientSecret = dev.clientSecret || process.env.ZOHO_CLIENT_SECRET;
        const refreshToken = dev.refreshToken || process.env.ZOHO_REFRESH_TOKEN;
        const organizationId = dev.organizationId || process.env.ZOHO_ORGANIZATION_ID;
        const region = dev.region || (process.env.ZOHO_REGION as ZohoOAuthCredentials['region']) || 'eu';

        if (clientId && clientSecret && refreshToken && organizationId) {
          console.log('[ZohoOAuth] Using dev credentials');
          this.credentials = { clientId, clientSecret, refreshToken, organizationId, region };
          return this.credentials;
        }
      }

      // Priority 2: Environment variables (for local dev without Key Vault)
      const envClientId = process.env.ZOHO_CLIENT_ID;
      const envClientSecret = process.env.ZOHO_CLIENT_SECRET;
      const envRefreshToken = process.env.ZOHO_REFRESH_TOKEN;
      const envOrganizationId = process.env.ZOHO_ORGANIZATION_ID;
      const envRegion = process.env.ZOHO_REGION as ZohoOAuthCredentials['region'];

      if (envClientId && envClientSecret && envRefreshToken && envOrganizationId) {
        console.log('[ZohoOAuth] Using environment variable credentials');
        const validRegions = ['eu', 'com', 'in', 'au', 'jp'];
        const region = envRegion && validRegions.includes(envRegion) ? envRegion : 'eu';

        this.credentials = {
          clientId: envClientId,
          clientSecret: envClientSecret,
          refreshToken: envRefreshToken,
          organizationId: envOrganizationId,
          region,
        };
        return this.credentials;
      }

      // Priority 3: Azure Key Vault (production)
      if (!this.secretClient) {
        throw new Error(
          'No credentials available. Provide Key Vault URL, environment variables, or dev credentials.'
        );
      }

      console.log('[ZohoOAuth] Loading credentials from Key Vault');
      const [clientId, clientSecret, refreshToken, organizationId, region] = await Promise.all([
        this.secretClient.getSecret(this.config.clientIdSecretName),
        this.secretClient.getSecret(this.config.clientSecretSecretName),
        this.secretClient.getSecret(this.config.refreshTokenSecretName),
        this.secretClient.getSecret(this.config.organizationIdSecretName),
        this.secretClient.getSecret(this.config.regionSecretName),
      ]);

      if (!clientId.value || !clientSecret.value || !refreshToken.value || !organizationId.value) {
        throw new Error('Missing required Zoho OAuth credentials in Key Vault');
      }

      const validRegions = ['eu', 'com', 'in', 'au', 'jp'];
      const regionValue = (region.value || 'eu') as ZohoOAuthCredentials['region'];

      if (!validRegions.includes(regionValue)) {
        throw new Error(`Invalid Zoho region: ${regionValue}. Must be one of: ${validRegions.join(', ')}`);
      }

      this.credentials = {
        clientId: clientId.value,
        clientSecret: clientSecret.value,
        refreshToken: refreshToken.value,
        organizationId: organizationId.value,
        region: regionValue,
      };

      return this.credentials;
    } catch (error) {
      throw new Error(`Failed to load Zoho credentials: ${(error as Error).message}`);
    }
  }

  /**
   * Get the base URL for Zoho API based on region
   */
  private getBaseUrl(region: ZohoOAuthCredentials['region']): string {
    const baseUrls: Record<ZohoOAuthCredentials['region'], string> = {
      eu: 'https://www.zohoapis.eu',
      com: 'https://www.zohoapis.com',
      in: 'https://www.zohoapis.in',
      au: 'https://www.zohoapis.com.au',
      jp: 'https://www.zohoapis.jp',
    };
    return baseUrls[region];
  }

  /**
   * Get the accounts URL for OAuth based on region
   */
  private getAccountsUrl(region: ZohoOAuthCredentials['region']): string {
    const accountsUrls: Record<ZohoOAuthCredentials['region'], string> = {
      eu: 'https://accounts.zoho.eu',
      com: 'https://accounts.zoho.com',
      in: 'https://accounts.zoho.in',
      au: 'https://accounts.zoho.com.au',
      jp: 'https://accounts.zoho.jp',
    };
    return accountsUrls[region];
  }

  /**
   * Refresh the access token using the refresh token
   * Thread-safe: if a refresh is already in progress, returns the same promise
   */
  async refreshToken(): Promise<ZohoAccessToken> {
    // Check if a refresh is already in progress
    const existingLock = this.tokenStore.getRefreshLock();
    if (existingLock) {
      return existingLock;
    }

    // Create a new refresh promise
    const refreshPromise = this.performTokenRefresh();

    // Set the lock
    this.tokenStore.setRefreshLock(refreshPromise);

    try {
      const token = await refreshPromise;
      return token;
    } finally {
      // Always clear the lock when done
      this.tokenStore.clearRefreshLock();
    }
  }

  /**
   * Internal method that performs the actual token refresh
   */
  private async performTokenRefresh(): Promise<ZohoAccessToken> {
    const credentials = await this.loadCredentials();
    const accountsUrl = this.getAccountsUrl(credentials.region);

    const params = new URLSearchParams({
      refresh_token: credentials.refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: 'refresh_token',
    });

    try {
      const response = await axios.post<ZohoTokenRefreshResponse>(
        `${accountsUrl}/oauth/v2/token`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );

      if (!response.data.access_token) {
        throw new Error('No access token in refresh response');
      }

      // Store the new token with expiration (default 1 hour if not specified)
      const expiresIn = response.data.expires_in || 3600;
      const accessToken = this.tokenStore.setToken(response.data.access_token, expiresIn);

      return accessToken;
    } catch (error) {
      this.tokenStore.clearToken();

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        const status = axiosError.response?.status;
        const data = axiosError.response?.data;

        throw new Error(
          `Zoho token refresh failed (HTTP ${status}): ${JSON.stringify(data)}`
        );
      }

      throw new Error(`Zoho token refresh failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get a valid access token, refreshing if necessary
   * This is the main method to use when making API calls
   */
  async getAccessToken(): Promise<string> {
    // Try to get cached token
    const cachedToken = this.tokenStore.getToken();
    if (cachedToken) {
      return cachedToken.token;
    }

    // Need to refresh
    const newToken = await this.refreshToken();
    return newToken.token;
  }

  /**
   * Get the organization ID for API calls
   */
  async getOrganizationId(): Promise<string> {
    const credentials = await this.loadCredentials();
    return credentials.organizationId;
  }

  /**
   * Get the base API URL for this Zoho account
   */
  async getApiBaseUrl(): Promise<string> {
    const credentials = await this.loadCredentials();
    return this.getBaseUrl(credentials.region);
  }

  /**
   * Clear all cached tokens and credentials
   * Use this if credentials have changed in Key Vault
   */
  clearCache(): void {
    this.tokenStore.clearToken();
    this.credentials = null;
  }

  /**
   * Get token information for debugging/monitoring
   */
  getTokenInfo() {
    return this.tokenStore.getTokenInfo();
  }
}
