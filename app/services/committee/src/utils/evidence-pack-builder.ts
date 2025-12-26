/**
 * Evidence Pack Builder
 *
 * Utility for constructing bounded evidence packs from spreadsheet data.
 * Ensures privacy by only including limited sample data.
 */

import { EvidencePack, ColumnStats, SupportedLanguage } from '../types';

/**
 * Options for building evidence packs
 */
export interface EvidencePackBuilderOptions {
  /** Maximum number of sample values per column (default: 5) */
  maxSamples?: number;

  /** Maximum header text length (default: 100) */
  maxHeaderLength?: number;

  /** Maximum sample value length (default: 200) */
  maxSampleLength?: number;
}

const DEFAULT_OPTIONS: Required<EvidencePackBuilderOptions> = {
  maxSamples: 5,
  maxHeaderLength: 100,
  maxSampleLength: 200,
};

/**
 * Column data input for building evidence packs
 */
export interface ColumnData {
  header: string;
  values: string[];
}

/**
 * Evidence Pack Builder
 *
 * Constructs bounded evidence packs with configurable limits.
 */
export class EvidencePackBuilder {
  private options: Required<EvidencePackBuilderOptions>;
  private caseId: string;
  private columns: ColumnData[] = [];
  private language: SupportedLanguage = 'unknown';
  private constraints: string[] = [];
  private metadata?: EvidencePack['metadata'];

  constructor(caseId: string, options?: EvidencePackBuilderOptions) {
    this.caseId = caseId;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Add a column to the evidence pack
   */
  addColumn(header: string, values: string[]): this {
    this.columns.push({ header, values });
    return this;
  }

  /**
   * Add multiple columns at once
   */
  addColumns(columns: ColumnData[]): this {
    this.columns.push(...columns);
    return this;
  }

  /**
   * Set detected language
   */
  setLanguage(language: SupportedLanguage): this {
    this.language = language;
    return this;
  }

  /**
   * Add constraints
   */
  addConstraints(constraints: string[]): this {
    this.constraints.push(...constraints);
    return this;
  }

  /**
   * Set metadata
   */
  setMetadata(metadata: EvidencePack['metadata']): this {
    this.metadata = metadata;
    return this;
  }

  /**
   * Build the evidence pack
   */
  build(): EvidencePack {
    const candidateHeaders = this.columns.map((col) =>
      this.truncate(col.header, this.options.maxHeaderLength)
    );

    const sampleValues: Record<string, string[]> = {};
    const columnStats: ColumnStats[] = [];

    for (let i = 0; i < this.columns.length; i++) {
      const col = this.columns[i];
      const columnId = i.toString();

      // Sample values (first N non-empty, truncated)
      const samples = col.values
        .filter((v) => v && v.trim() !== '')
        .slice(0, this.options.maxSamples)
        .map((v) => this.truncate(v, this.options.maxSampleLength));
      sampleValues[columnId] = samples;

      // Calculate stats
      const stats = this.calculateColumnStats(columnId, col);
      columnStats.push(stats);
    }

    // Add default constraints if none provided
    const constraints = this.constraints.length > 0
      ? this.constraints
      : this.getDefaultConstraints();

    return {
      caseId: this.caseId,
      candidateHeaders,
      sampleValues,
      columnStats,
      detectedLanguage: this.language,
      constraints,
      timestamp: new Date().toISOString(),
      metadata: this.metadata,
    };
  }

  /**
   * Calculate column statistics
   */
  private calculateColumnStats(columnId: string, col: ColumnData): ColumnStats {
    const nonEmptyValues = col.values.filter((v) => v && v.trim() !== '');
    const uniqueValues = new Set(nonEmptyValues);

    // Detect data types
    const dataTypes: Record<string, number> = {};
    for (const value of nonEmptyValues) {
      const type = this.detectDataType(value);
      dataTypes[type] = (dataTypes[type] || 0) + 1;
    }

    // Detect patterns
    const patterns = this.detectPatterns(nonEmptyValues);

    return {
      columnId,
      headerText: this.truncate(col.header, this.options.maxHeaderLength),
      nonEmptyCount: nonEmptyValues.length,
      uniqueCount: uniqueValues.size,
      dataTypes,
      patterns,
    };
  }

  /**
   * Detect data type of a value
   */
  private detectDataType(value: string): string {
    const trimmed = value.trim();

    // Check for number
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return 'number';
    }

    // Check for currency
    if (/^[$€£¥]?\s*-?\d{1,3}(,\d{3})*(\.\d{2})?$/.test(trimmed)) {
      return 'number';
    }

    // Check for date patterns
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed) || /^\d{2}\/\d{2}\/\d{4}/.test(trimmed)) {
      return 'date';
    }

    // Check for boolean
    if (/^(true|false|yes|no|0|1)$/i.test(trimmed)) {
      return 'boolean';
    }

    return 'string';
  }

  /**
   * Detect patterns in column values
   */
  private detectPatterns(values: string[]): string[] {
    const patterns: string[] = [];

    if (values.length === 0) {
      return patterns;
    }

    // Check for GTIN patterns (8, 12, 13, or 14 digit codes)
    const gtinMatch = values.filter((v) => /^\d{8}$|^\d{12}$|^\d{13}$|^\d{14}$/.test(v.trim()));
    if (gtinMatch.length > values.length * 0.5) {
      const len = gtinMatch[0].trim().length;
      patterns.push(`GTIN-${len}`);
    }

    // Check for SKU patterns (alphanumeric with dashes)
    const skuMatch = values.filter((v) => /^[A-Z0-9]+-\d+$/i.test(v.trim()));
    if (skuMatch.length > values.length * 0.5) {
      patterns.push('XXX-999');
    }

    // Check for currency patterns
    const currencyMatch = values.filter((v) =>
      /^[$€£¥]?\s*-?\d{1,3}(,\d{3})*(\.\d{2})?$/.test(v.trim())
    );
    if (currencyMatch.length > values.length * 0.5) {
      patterns.push('Currency');
    }

    // Check for email patterns
    const emailMatch = values.filter((v) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
    );
    if (emailMatch.length > values.length * 0.5) {
      patterns.push('Email');
    }

    // Check for phone patterns
    const phoneMatch = values.filter((v) =>
      /^(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(v.trim())
    );
    if (phoneMatch.length > values.length * 0.5) {
      patterns.push('Phone');
    }

    return patterns;
  }

  /**
   * Truncate string to max length
   */
  private truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
      return value;
    }
    return value.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get default constraints
   */
  private getDefaultConstraints(): string[] {
    const maxColumnId = this.columns.length - 1;
    return [
      `Must choose from candidate column IDs (0-${maxColumnId}) only`,
      'Cannot invent new columns or values',
      'Return null if no suitable match exists',
    ];
  }
}

/**
 * Detect language from text samples
 *
 * Simple heuristic based on character ranges
 */
export function detectLanguage(samples: string[]): SupportedLanguage {
  let englishScore = 0;
  let farsiScore = 0;
  let arabicScore = 0;

  for (const sample of samples) {
    for (const char of sample) {
      const code = char.charCodeAt(0);

      // ASCII letters
      if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
        englishScore++;
      }
      // Farsi/Persian range (includes Arabic letters used in Farsi)
      else if (code >= 0x0600 && code <= 0x06FF) {
        // Distinguish Farsi-specific characters
        if ([0x067E, 0x0686, 0x0698, 0x06AF, 0x06CC].includes(code)) {
          farsiScore += 2; // Farsi-specific characters
        } else {
          farsiScore++;
          arabicScore++;
        }
      }
      // Extended Arabic range
      else if (code >= 0x0750 && code <= 0x077F) {
        arabicScore++;
      }
    }
  }

  const total = englishScore + farsiScore + arabicScore;
  if (total === 0) {
    return 'unknown';
  }

  const englishRatio = englishScore / total;
  const farsiRatio = farsiScore / total;
  const arabicRatio = arabicScore / total;

  // Determine primary language
  if (englishRatio > 0.8) {
    return 'en';
  }
  if (farsiRatio > 0.5) {
    return 'fa';
  }
  if (arabicRatio > 0.5) {
    return 'ar';
  }
  if (englishRatio > 0.3 && (farsiRatio > 0.3 || arabicRatio > 0.3)) {
    return 'mixed';
  }

  return 'unknown';
}

/**
 * Quick helper to build an evidence pack
 */
export function buildEvidencePack(
  caseId: string,
  columns: ColumnData[],
  options?: EvidencePackBuilderOptions
): EvidencePack {
  const builder = new EvidencePackBuilder(caseId, options);

  // Add columns
  builder.addColumns(columns);

  // Detect language from headers and first column values
  const allText = columns.flatMap((c) => [c.header, ...c.values.slice(0, 5)]);
  const language = detectLanguage(allText);
  builder.setLanguage(language);

  return builder.build();
}
