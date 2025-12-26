/**
 * Zoho OAuth Token Store
 *
 * Thread-safe in-memory cache for access tokens with TTL management.
 * Prevents multiple concurrent token refresh operations.
 */

import { ZohoAccessToken } from '../types.js';

export class ZohoTokenStore {
  private token: ZohoAccessToken | null = null;
  private refreshLock: Promise<ZohoAccessToken> | null = null;

  /**
   * Get the current access token if it's still valid
   * @param bufferSeconds - Refresh if token expires within this buffer (default: 300s / 5min)
   */
  getToken(bufferSeconds: number = 300): ZohoAccessToken | null {
    if (!this.token) {
      return null;
    }

    const now = Date.now();
    const expiryWithBuffer = this.token.expiresAt - bufferSeconds * 1000;

    if (now >= expiryWithBuffer) {
      // Token expired or about to expire
      return null;
    }

    return this.token;
  }

  /**
   * Store a new access token with expiration time
   */
  setToken(token: string, expiresInSeconds: number): ZohoAccessToken {
    const now = Date.now();
    const accessToken: ZohoAccessToken = {
      token,
      expiresAt: now + expiresInSeconds * 1000,
    };

    this.token = accessToken;
    return accessToken;
  }

  /**
   * Clear the stored token
   */
  clearToken(): void {
    this.token = null;
  }

  /**
   * Get the current refresh lock promise (if any)
   * This prevents multiple concurrent refresh operations
   */
  getRefreshLock(): Promise<ZohoAccessToken> | null {
    return this.refreshLock;
  }

  /**
   * Set a refresh lock with the promise that will resolve to the new token
   */
  setRefreshLock(promise: Promise<ZohoAccessToken>): void {
    this.refreshLock = promise;
  }

  /**
   * Clear the refresh lock after completion
   */
  clearRefreshLock(): void {
    this.refreshLock = null;
  }

  /**
   * Get token info for debugging
   */
  getTokenInfo(): {
    hasToken: boolean;
    expiresAt: number | null;
    timeUntilExpiry: number | null;
    isValid: boolean;
  } {
    if (!this.token) {
      return {
        hasToken: false,
        expiresAt: null,
        timeUntilExpiry: null,
        isValid: false,
      };
    }

    const now = Date.now();
    const timeUntilExpiry = this.token.expiresAt - now;

    return {
      hasToken: true,
      expiresAt: this.token.expiresAt,
      timeUntilExpiry,
      isValid: timeUntilExpiry > 0,
    };
  }
}
