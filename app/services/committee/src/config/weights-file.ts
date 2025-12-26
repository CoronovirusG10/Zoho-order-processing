/**
 * Weight file management for calibration output
 *
 * Handles reading and writing calibrated weights to a JSON config file.
 * This allows weights to be persisted and version-controlled.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CalibrationResult } from '../types';

/**
 * Weight file structure
 */
export interface WeightConfigFile {
  version: string;
  lastCalibrated: string;
  calibrationCasesCount: number;
  weights: Record<string, number>;
  providerStats: Record<string, {
    accuracy: number;
    fieldAccuracies: Record<string, number>;
    testCasesProcessed: number;
  }>;
  metadata: {
    calibrationScript: string;
    goldenFilesPath: string;
    environment?: string;
  };
}

const WEIGHT_FILE_VERSION = '1.0.0';
const DEFAULT_WEIGHT_FILE = 'calibrated-weights.json';

/**
 * Load weights from config file
 *
 * @param filePath - Path to weight config file
 * @returns Loaded weights or undefined if file doesn't exist
 */
export function loadWeightsFromFile(filePath?: string): Record<string, number> | undefined {
  const targetPath = filePath || getDefaultWeightFilePath();

  if (!fs.existsSync(targetPath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(targetPath, 'utf-8');
    const config: WeightConfigFile = JSON.parse(content);

    // Validate version
    if (config.version !== WEIGHT_FILE_VERSION) {
      console.warn(`Weight file version mismatch. Expected ${WEIGHT_FILE_VERSION}, got ${config.version}`);
    }

    return config.weights;
  } catch (error) {
    console.error(`Failed to load weights from ${targetPath}:`, error);
    return undefined;
  }
}

/**
 * Save calibration results to config file
 *
 * @param results - Calibration results from all providers
 * @param goldenFilesPath - Path to golden files used
 * @param filePath - Path to save config file
 */
export function saveCalibrationResults(
  results: CalibrationResult[],
  goldenFilesPath: string,
  filePath?: string
): void {
  const targetPath = filePath || getDefaultWeightFilePath();

  const weights: Record<string, number> = {};
  const providerStats: WeightConfigFile['providerStats'] = {};

  for (const result of results) {
    weights[result.providerId] = result.recommendedWeight;
    providerStats[result.providerId] = {
      accuracy: result.accuracy,
      fieldAccuracies: result.fieldAccuracies,
      testCasesProcessed: result.testCasesProcessed,
    };
  }

  const config: WeightConfigFile = {
    version: WEIGHT_FILE_VERSION,
    lastCalibrated: new Date().toISOString(),
    calibrationCasesCount: results[0]?.testCasesProcessed || 0,
    weights,
    providerStats,
    metadata: {
      calibrationScript: 'scripts/calibrate-weights.ts',
      goldenFilesPath,
      environment: process.env.NODE_ENV,
    },
  };

  // Ensure directory exists
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(targetPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`Weights saved to ${targetPath}`);
}

/**
 * Get default weight file path
 */
export function getDefaultWeightFilePath(): string {
  // Look for config directory relative to package root
  const packageRoot = path.resolve(__dirname, '../..');
  return path.join(packageRoot, 'config', DEFAULT_WEIGHT_FILE);
}

/**
 * Generate weight config summary for logging
 */
export function formatWeightSummary(config: WeightConfigFile): string {
  const lines = [
    `Weight Configuration Summary`,
    `============================`,
    `Version: ${config.version}`,
    `Last Calibrated: ${config.lastCalibrated}`,
    `Test Cases: ${config.calibrationCasesCount}`,
    ``,
    `Provider Weights:`,
  ];

  const sortedProviders = Object.entries(config.weights)
    .sort(([, a], [, b]) => b - a);

  for (const [providerId, weight] of sortedProviders) {
    const stats = config.providerStats[providerId];
    const accuracy = stats ? ` (accuracy: ${(stats.accuracy * 100).toFixed(1)}%)` : '';
    lines.push(`  ${providerId}: ${weight.toFixed(3)}${accuracy}`);
  }

  return lines.join('\n');
}

/**
 * Validate weight config file
 */
export function validateWeightConfig(config: unknown): config is WeightConfigFile {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const c = config as Record<string, unknown>;

  return (
    typeof c.version === 'string' &&
    typeof c.lastCalibrated === 'string' &&
    typeof c.calibrationCasesCount === 'number' &&
    typeof c.weights === 'object' &&
    c.weights !== null &&
    typeof c.providerStats === 'object' &&
    typeof c.metadata === 'object'
  );
}
