/**
 * Authentication service for Teams SSO
 */

import * as microsoftTeams from '@microsoft/teams-js';
import type { AuthToken, UserProfile } from '@/types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const TAB_APP_CLIENT_ID = import.meta.env.VITE_TAB_APP_CLIENT_ID;

class AuthService {
  private cachedToken: AuthToken | null = null;
  private userProfile: UserProfile | null = null;

  /**
   * Get Teams auth token via SSO
   */
  async getTeamsToken(): Promise<string> {
    try {
      // Check if we have a valid cached token
      if (this.cachedToken && this.cachedToken.expiresAt > Date.now() + 60000) {
        return this.cachedToken.accessToken;
      }

      // Get token from Teams
      const token = await microsoftTeams.authentication.getAuthToken({
        resources: [TAB_APP_CLIENT_ID!],
        silent: true,
      });

      // Decode to get expiry (simple decode, not validation)
      const payload = this.decodeJwt(token);
      const expiresAt = Number(payload.exp || 0) * 1000;

      this.cachedToken = {
        accessToken: token,
        expiresAt,
      };

      return token;
    } catch (error) {
      console.error('Failed to get Teams token:', error);
      throw new Error('Authentication failed. Please try again.');
    }
  }

  /**
   * Exchange Teams token for API access token
   */
  async getApiToken(): Promise<string> {
    const teamsToken = await this.getTeamsToken();

    try {
      const response = await fetch(`${API_BASE_URL}/auth/exchange-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${teamsToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.accessToken;
    } catch (error) {
      console.error('Failed to exchange token:', error);
      throw new Error('Failed to authenticate with API');
    }
  }

  /**
   * Get user profile with roles
   */
  async getUserProfile(): Promise<UserProfile> {
    if (this.userProfile) {
      return this.userProfile;
    }

    const token = await this.getApiToken();

    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get user profile: ${response.statusText}`);
      }

      this.userProfile = await response.json();
      return this.userProfile!;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      throw new Error('Failed to load user profile');
    }
  }

  /**
   * Sign out
   */
  signOut(): void {
    this.cachedToken = null;
    this.userProfile = null;
  }

  /**
   * Simple JWT decode (not validation)
   */
  private decodeJwt(token: string): Record<string, unknown> {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Failed to decode JWT:', error);
      return {};
    }
  }
}

export const authService = new AuthService();
