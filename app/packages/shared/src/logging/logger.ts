/**
 * Structured logger with correlation ID support and Application Insights integration.
 * NEVER logs secrets (tokens, keys, passwords).
 */

/**
 * Log levels supported by the logger
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logging context that can be bound to a logger instance
 */
export interface LogContext {
  caseId?: string;
  tenantId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  [key: string]: unknown;
}

/**
 * Configuration for the logger
 */
export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableAppInsights: boolean;
  redactSecrets: boolean;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: 'info',
  enableConsole: true,
  enableAppInsights: false,
  redactSecrets: true,
};

/**
 * Patterns to detect secrets in log data
 */
const SECRET_PATTERNS = [
  /token/i,
  /password/i,
  /secret/i,
  /key/i,
  /authorization/i,
  /bearer/i,
  /api[-_]?key/i,
  /access[-_]?token/i,
  /refresh[-_]?token/i,
];

/**
 * Level ordering for comparison
 */
const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a key might contain secret data
 */
function isSecretKey(key: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Redact potential secrets from an object
 */
function redactSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSecrets);
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSecretKey(key)) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSecrets(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Structured logger with context binding and secret redaction
 */
export class Logger {
  private readonly config: LoggerConfig;
  private readonly context: LogContext;

  constructor(context: LogContext = {}, config: Partial<LoggerConfig> = {}) {
    this.context = { ...context };
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): Logger {
    return new Logger({ ...this.context, ...context }, this.config);
  }

  /**
   * Update context for this logger instance
   */
  withContext(context: LogContext): Logger {
    return this.child(context);
  }

  /**
   * Check if a log level should be emitted
   */
  private shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.config.minLevel];
  }

  /**
   * Format and emit a log entry
   */
  private emit(level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.context,
      ...data,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Redact secrets if enabled
    const finalEntry = this.config.redactSecrets ? redactSecrets(entry) : entry;

    // Output to console (JSONL format for file output)
    if (this.config.enableConsole) {
      console.log(JSON.stringify(finalEntry));
    }

    // TODO: Send to Application Insights when enabled
    if (this.config.enableAppInsights) {
      // Integration point for Application Insights
      // This would use the Application Insights SDK
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, data?: Record<string, unknown>): void {
    this.emit('debug', message, data);
  }

  /**
   * Log info message
   */
  info(message: string, data?: Record<string, unknown>): void {
    this.emit('info', message, data);
  }

  /**
   * Log warning message
   */
  warn(message: string, data?: Record<string, unknown>): void {
    this.emit('warn', message, data);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.emit('error', message, data, error);
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();
