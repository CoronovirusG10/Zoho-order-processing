/**
 * Redaction Policy Service
 *
 * Handles redaction of sensitive data in logs and audit records:
 * - Never log secrets (tokens, keys, passwords)
 * - PII handling (email, phone, addresses)
 * - Configurable redaction policies
 */

import { createHash } from 'crypto';
import {
  RedactionPolicy,
  REDACTED_FIELDS,
  PII_FIELDS,
} from './types.js';

/**
 * Predefined redaction patterns for common sensitive data
 */
const SENSITIVE_PATTERNS = [
  // OAuth tokens (Bearer, JWT)
  {
    name: 'bearer_token',
    pattern: /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi,
    replacement: 'Bearer [REDACTED_JWT]',
  },
  // API keys (common formats)
  {
    name: 'api_key',
    pattern: /(?:api[_-]?key|apikey)[=:]\s*["']?([A-Za-z0-9\-_]{16,})["']?/gi,
    replacement: 'api_key=[REDACTED_KEY]',
  },
  // Connection strings
  {
    name: 'connection_string',
    pattern:
      /(?:AccountKey|SharedAccessKey|Password)=[^;"\s]+/gi,
    replacement: '[REDACTED_CONNECTION_STRING_COMPONENT]',
  },
  // SAS tokens
  {
    name: 'sas_token',
    pattern: /[?&](?:sig|sv|se|sp|srt|ss)=[^&\s]+/gi,
    replacement: '?[REDACTED_SAS_PARAMS]',
  },
  // Credit card numbers
  {
    name: 'credit_card',
    pattern: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
    replacement: '[REDACTED_CC]',
  },
  // Email addresses (for PII policy)
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]',
  },
  // Phone numbers
  {
    name: 'phone',
    pattern: /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/g,
    replacement: '[REDACTED_PHONE]',
  },
  // IP addresses
  {
    name: 'ip_address',
    pattern:
      /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[REDACTED_IP]',
  },
];

/**
 * Predefined redaction policies
 */
const POLICIES: Record<string, RedactionPolicy> = {
  /** Default policy - redacts secrets, keeps PII */
  default: {
    name: 'default',
    redactFields: [...REDACTED_FIELDS],
    hashFields: [],
    redactPii: false,
    patterns: SENSITIVE_PATTERNS.filter(
      (p) => !['email', 'phone', 'ip_address'].includes(p.name)
    ),
  },

  /** Strict policy - redacts both secrets and PII */
  strict: {
    name: 'strict',
    redactFields: [...REDACTED_FIELDS, ...PII_FIELDS],
    hashFields: ['email', 'phone'],
    redactPii: true,
    patterns: SENSITIVE_PATTERNS,
  },

  /** Audit policy - hashes PII for correlation but doesn't fully redact */
  audit: {
    name: 'audit',
    redactFields: [...REDACTED_FIELDS],
    hashFields: ['email', 'phone', 'ip'],
    redactPii: false,
    patterns: SENSITIVE_PATTERNS.filter(
      (p) => !['email', 'phone', 'ip_address'].includes(p.name)
    ),
  },

  /** Minimal policy - only redacts obvious secrets */
  minimal: {
    name: 'minimal',
    redactFields: [
      'accessToken',
      'refreshToken',
      'password',
      'secret',
      'clientSecret',
    ],
    hashFields: [],
    redactPii: false,
    patterns: SENSITIVE_PATTERNS.filter((p) =>
      ['bearer_token', 'connection_string', 'sas_token'].includes(p.name)
    ),
  },
};

/**
 * Redaction Service
 *
 * Provides redaction capabilities for sensitive data in logs and audit records.
 */
export class RedactionService {
  private policies: Map<string, RedactionPolicy> = new Map();

  constructor() {
    // Load predefined policies
    for (const [name, policy] of Object.entries(POLICIES)) {
      this.policies.set(name, policy);
    }
  }

  /**
   * Register a custom redaction policy
   */
  registerPolicy(policy: RedactionPolicy): void {
    this.policies.set(policy.name, policy);
  }

  /**
   * Get a policy by name
   */
  getPolicy(name: string): RedactionPolicy | undefined {
    return this.policies.get(name);
  }

  /**
   * Hash a value for correlation (one-way)
   */
  private hashValue(value: string): string {
    return createHash('sha256').update(value).digest('hex').slice(0, 16);
  }

  /**
   * Check if a key matches any redaction field
   */
  private isRedactedField(key: string, redactFields: readonly string[]): boolean {
    const lowerKey = key.toLowerCase();
    return redactFields.some((field) =>
      lowerKey.includes(field.toLowerCase())
    );
  }

  /**
   * Check if a key matches any hash field
   */
  private isHashField(key: string, hashFields: readonly string[]): boolean {
    const lowerKey = key.toLowerCase();
    return hashFields.some((field) => lowerKey.includes(field.toLowerCase()));
  }

  /**
   * Apply pattern redactions to a string value
   */
  private applyPatterns(
    value: string,
    patterns: Array<{ pattern: RegExp; replacement: string }>
  ): string {
    let result = value;
    for (const { pattern, replacement } of patterns) {
      result = result.replace(pattern, replacement);
    }
    return result;
  }

  /**
   * Redact a value based on policy
   */
  private redactValue(
    key: string,
    value: unknown,
    policy: RedactionPolicy
  ): unknown {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return value;
    }

    // Check if this field should be fully redacted
    if (this.isRedactedField(key, policy.redactFields)) {
      return '[REDACTED]';
    }

    // Check if this field should be hashed
    if (this.isHashField(key, policy.hashFields) && typeof value === 'string') {
      return `[HASH:${this.hashValue(value)}]`;
    }

    // Handle string values - apply pattern redactions
    if (typeof value === 'string') {
      return this.applyPatterns(value, policy.patterns);
    }

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item, index) =>
        this.redactValue(String(index), item, policy)
      );
    }

    // Handle objects recursively
    if (typeof value === 'object') {
      return this.redactObject(value as Record<string, unknown>, policy);
    }

    // Return primitive values as-is
    return value;
  }

  /**
   * Redact an object recursively
   */
  private redactObject(
    obj: Record<string, unknown>,
    policy: RedactionPolicy
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      result[key] = this.redactValue(key, value, policy);
    }

    return result;
  }

  /**
   * Redact data using a named policy
   */
  redact(
    data: Record<string, unknown>,
    policyName: string = 'default'
  ): Record<string, unknown> {
    const policy = this.policies.get(policyName);
    if (!policy) {
      throw new Error(`Unknown redaction policy: ${policyName}`);
    }

    return this.redactObject(data, policy);
  }

  /**
   * Redact a string value using pattern matching
   */
  redactString(value: string, policyName: string = 'default'): string {
    const policy = this.policies.get(policyName);
    if (!policy) {
      throw new Error(`Unknown redaction policy: ${policyName}`);
    }

    return this.applyPatterns(value, policy.patterns);
  }

  /**
   * Check if data contains PII
   */
  containsPii(data: Record<string, unknown>): boolean {
    const json = JSON.stringify(data);

    // Check for PII patterns
    const piiPatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b(?:\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/, // Phone
      /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/, // SSN
    ];

    return piiPatterns.some((pattern) => pattern.test(json));
  }

  /**
   * Check if data contains secrets (for validation)
   */
  containsSecrets(data: Record<string, unknown>): boolean {
    const checkValue = (value: unknown): boolean => {
      if (typeof value === 'string') {
        // Check for secret patterns
        const secretPatterns = [
          /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/i,
          /(?:api[_-]?key|apikey)[=:]\s*["']?([A-Za-z0-9\-_]{16,})["']?/i,
          /(?:AccountKey|SharedAccessKey|Password)=[^;"\s]+/i,
        ];
        return secretPatterns.some((pattern) => pattern.test(value));
      }

      if (Array.isArray(value)) {
        return value.some(checkValue);
      }

      if (typeof value === 'object' && value !== null) {
        return Object.entries(value as Record<string, unknown>).some(
          ([key, val]) => {
            // Check if key indicates a secret
            if (
              REDACTED_FIELDS.some((field) =>
                key.toLowerCase().includes(field.toLowerCase())
              )
            ) {
              return true;
            }
            return checkValue(val);
          }
        );
      }

      return false;
    };

    return checkValue(data);
  }

  /**
   * Validate that no secrets are present (throws if found)
   */
  validateNoSecrets(data: Record<string, unknown>, context: string): void {
    if (this.containsSecrets(data)) {
      throw new Error(
        `Secrets detected in ${context}. Data must be redacted before logging.`
      );
    }
  }

  /**
   * Create a safe copy of headers for logging
   */
  redactHeaders(headers: Record<string, string>): Record<string, string> {
    const redactedHeaders: Record<string, string> = {};
    const sensitiveHeaders = [
      'authorization',
      'x-api-key',
      'api-key',
      'x-auth-token',
      'cookie',
      'set-cookie',
    ];

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.some((h) => key.toLowerCase() === h)) {
        redactedHeaders[key] = '[REDACTED]';
      } else {
        redactedHeaders[key] = value;
      }
    }

    return redactedHeaders;
  }

  /**
   * Create a safe copy of a URL for logging (removes query params with secrets)
   */
  redactUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const sensitiveParams = ['token', 'key', 'secret', 'sig', 'password'];

      for (const param of parsed.searchParams.keys()) {
        if (
          sensitiveParams.some((s) => param.toLowerCase().includes(s))
        ) {
          parsed.searchParams.set(param, '[REDACTED]');
        }
      }

      return parsed.toString();
    } catch {
      // If URL parsing fails, apply pattern redaction
      return this.applyPatterns(url, SENSITIVE_PATTERNS);
    }
  }
}

/**
 * Singleton redaction service instance
 */
export const redactionService = new RedactionService();
