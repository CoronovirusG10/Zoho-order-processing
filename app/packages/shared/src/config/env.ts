/**
 * Environment variable loader with validation
 */

import { ConfigurationError } from '../errors/base-error';

/**
 * Environment variable type
 */
export type EnvVarType = 'string' | 'number' | 'boolean' | 'url' | 'json';

/**
 * Environment variable definition
 */
export interface EnvVarDefinition {
  key: string;
  type: EnvVarType;
  required: boolean;
  defaultValue?: string | number | boolean;
  validator?: (value: unknown) => boolean;
  description?: string;
}

/**
 * Parsed environment value
 */
type ParsedValue<T extends EnvVarType> = T extends 'string'
  ? string
  : T extends 'number'
  ? number
  : T extends 'boolean'
  ? boolean
  : T extends 'url'
  ? string
  : T extends 'json'
  ? unknown
  : never;

/**
 * Parse an environment variable value based on type
 */
function parseEnvValue<T extends EnvVarType>(
  value: string | undefined,
  type: T
): ParsedValue<T> | undefined {
  if (value === undefined) {
    return undefined;
  }

  switch (type) {
    case 'string':
      return value as ParsedValue<T>;

    case 'number': {
      const num = parseFloat(value);
      if (isNaN(num)) {
        throw new ConfigurationError(`Invalid number: ${value}`);
      }
      return num as ParsedValue<T>;
    }

    case 'boolean': {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === '1' || lower === 'yes') {
        return true as ParsedValue<T>;
      }
      if (lower === 'false' || lower === '0' || lower === 'no') {
        return false as ParsedValue<T>;
      }
      throw new ConfigurationError(`Invalid boolean: ${value}`);
    }

    case 'url': {
      try {
        new URL(value);
        return value as ParsedValue<T>;
      } catch {
        throw new ConfigurationError(`Invalid URL: ${value}`);
      }
    }

    case 'json': {
      try {
        return JSON.parse(value) as ParsedValue<T>;
      } catch {
        throw new ConfigurationError(`Invalid JSON: ${value}`);
      }
    }

    default:
      throw new ConfigurationError(`Unknown type: ${type}`);
  }
}

/**
 * Get an environment variable with validation
 */
export function getEnv<T extends EnvVarType>(
  definition: EnvVarDefinition
): ParsedValue<T> | undefined {
  const { key, type, required, defaultValue, validator } = definition;

  const rawValue = process.env[key];

  // Handle missing value
  if (rawValue === undefined) {
    if (required && defaultValue === undefined) {
      throw new ConfigurationError(`Required environment variable missing: ${key}`, {
        key,
      });
    }
    return (defaultValue as ParsedValue<T>) ?? undefined;
  }

  // Parse the value
  const parsed = parseEnvValue(rawValue, type) as ParsedValue<T> | undefined;

  // Validate if validator provided
  if (validator && parsed !== undefined && !validator(parsed)) {
    throw new ConfigurationError(`Environment variable validation failed: ${key}`, {
      key,
      value: parsed,
    });
  }

  return parsed;
}

/**
 * Get a required environment variable
 */
export function getRequiredEnv<T extends EnvVarType>(
  key: string,
  type: T,
  validator?: (value: unknown) => boolean
): ParsedValue<T> {
  const value = getEnv<T>({ key, type, required: true, validator });
  if (value === undefined) {
    throw new ConfigurationError(`Required environment variable missing: ${key}`, { key });
  }
  return value;
}

/**
 * Get an optional environment variable
 */
export function getOptionalEnv<T extends EnvVarType>(
  key: string,
  type: T,
  defaultValue?: ParsedValue<T>,
  validator?: (value: unknown) => boolean
): ParsedValue<T> | undefined {
  return getEnv<T>({ key, type, required: false, defaultValue: defaultValue as string | number | boolean | undefined, validator });
}

/**
 * Load and validate multiple environment variables
 */
export function loadEnvConfig<T extends Record<string, EnvVarDefinition>>(
  definitions: T
): { [K in keyof T]: ParsedValue<T[K]['type']> | undefined } {
  const config: Record<string, unknown> = {};

  for (const [name, definition] of Object.entries(definitions)) {
    config[name] = getEnv(definition);
  }

  return config as { [K in keyof T]: ParsedValue<T[K]['type']> | undefined };
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in test
 */
export function isTest(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get the current environment name
 */
export function getEnvironment(): string {
  return process.env.NODE_ENV || 'development';
}
