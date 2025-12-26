/**
 * Weight calibration script
 *
 * Runs the committee against golden test files to calibrate provider weights
 *
 * Usage:
 *   npm run calibrate -- --golden-dir ./tests/golden
 */

import * as fs from 'fs';
import * as path from 'path';
import { CommitteeEngine, createDefaultConfig } from '../src/engine';
import { ProviderFactory } from '../src/providers/provider-factory';
import { getDefaultProviderConfigs } from '../src/config/provider-config';
import { saveWeights, normalizeWeights } from '../src/config/weights';
import { saveCalibrationResults, formatWeightSummary } from '../src/config/weights-file';
import {
  GoldenTestCase,
  SchemaMappingTask,
  CalibrationResult,
  ProviderConfig,
} from '../src/types';

/**
 * Load golden test cases from directory
 */
function loadGoldenTestCases(goldenDir: string): GoldenTestCase[] {
  const testCases: GoldenTestCase[] = [];

  if (!fs.existsSync(goldenDir)) {
    throw new Error(`Golden directory not found: ${goldenDir}`);
  }

  const files = fs.readdirSync(goldenDir);

  for (const file of files) {
    if (!file.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(goldenDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const testCase: GoldenTestCase = JSON.parse(content);

    testCases.push(testCase);
  }

  console.log(`Loaded ${testCases.length} golden test cases from ${goldenDir}`);

  return testCases;
}

/**
 * Calculate accuracy for a provider
 */
function calculateAccuracy(
  providerId: string,
  testCases: GoldenTestCase[],
  results: Map<string, any>
): CalibrationResult {
  let correctMappings = 0;
  let totalMappings = 0;
  const fieldAccuracies: Record<string, number> = {};
  const fieldCounts: Record<string, { correct: number; total: number }> = {};

  for (const testCase of testCases) {
    const result = results.get(testCase.caseId);
    if (!result) {
      continue;
    }

    const providerOutput = result.providerOutputs.find((o: any) => o.providerId === providerId);
    if (!providerOutput || providerOutput.error) {
      continue;
    }

    for (const mapping of providerOutput.output.mappings) {
      const expectedColumnId = testCase.expectedMappings[mapping.field];
      const isCorrect = mapping.selectedColumnId === expectedColumnId;

      if (isCorrect) {
        correctMappings++;
      }
      totalMappings++;

      // Track per-field accuracy
      if (!fieldCounts[mapping.field]) {
        fieldCounts[mapping.field] = { correct: 0, total: 0 };
      }
      fieldCounts[mapping.field].total++;
      if (isCorrect) {
        fieldCounts[mapping.field].correct++;
      }
    }
  }

  // Calculate per-field accuracies
  for (const [field, counts] of Object.entries(fieldCounts)) {
    fieldAccuracies[field] = counts.total > 0 ? counts.correct / counts.total : 0;
  }

  const overallAccuracy = totalMappings > 0 ? correctMappings / totalMappings : 0;

  // Calculate recommended weight based on accuracy
  // Using logit function: weight = 1 / (1 + e^(-k * (accuracy - 0.5)))
  // Where k controls steepness, higher k = more sensitive to accuracy differences
  const k = 10;
  const recommendedWeight = 1 / (1 + Math.exp(-k * (overallAccuracy - 0.5)));

  return {
    providerId,
    accuracy: overallAccuracy,
    fieldAccuracies,
    recommendedWeight,
    testCasesProcessed: testCases.length,
  };
}

/**
 * Main calibration function
 */
async function calibrate(goldenDir: string): Promise<void> {
  console.log('=== Committee Weight Calibration ===\n');

  // Load golden test cases
  const testCases = loadGoldenTestCases(goldenDir);

  if (testCases.length === 0) {
    console.error('No golden test cases found. Cannot calibrate.');
    return;
  }

  // Initialize provider factory
  const providerConfigs = getDefaultProviderConfigs();
  const enabledConfigs = providerConfigs.filter((c) => c.enabled);

  if (enabledConfigs.length === 0) {
    console.error('No enabled providers found. Check your environment variables.');
    return;
  }

  console.log(`Enabled providers: ${enabledConfigs.map((c) => c.id).join(', ')}\n`);

  const factory = new ProviderFactory({ configs: providerConfigs });

  // Create committee engine with all providers
  const config = createDefaultConfig();
  config.providerPool = enabledConfigs.map((c) => c.id);
  config.providerCount = Math.min(enabledConfigs.length, 5); // Use up to 5 providers

  const engine = new CommitteeEngine(factory, config);

  // Run committee on all test cases
  console.log('Running committee on golden test cases...\n');
  const results = new Map<string, any>();

  for (const testCase of testCases) {
    console.log(`Processing ${testCase.caseId}: ${testCase.description}`);

    const task: SchemaMappingTask = {
      type: 'schema-mapping',
      evidencePack: testCase.evidencePack,
      expectedFields: Object.keys(testCase.expectedMappings),
      candidateColumns: {}, // Not used in this context
    };

    try {
      const result = await engine.runCommittee(task);
      results.set(testCase.caseId, result);
      console.log(`  ✓ Completed (consensus: ${result.aggregatedResult.consensus})`);
    } catch (error) {
      console.error(`  ✗ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  console.log('\n=== Calibration Results ===\n');

  // Calculate accuracy for each provider
  const calibrationResults: CalibrationResult[] = [];

  for (const config of enabledConfigs) {
    const result = calculateAccuracy(config.id, testCases, results);
    calibrationResults.push(result);

    console.log(`Provider: ${config.id}`);
    console.log(`  Overall Accuracy: ${(result.accuracy * 100).toFixed(2)}%`);
    console.log(`  Recommended Weight: ${result.recommendedWeight.toFixed(3)}`);
    console.log(`  Field Accuracies:`);

    for (const [field, accuracy] of Object.entries(result.fieldAccuracies)) {
      console.log(`    ${field}: ${(accuracy * 100).toFixed(2)}%`);
    }

    console.log('');
  }

  // Generate new weights
  const newWeights: Record<string, number> = {};
  for (const result of calibrationResults) {
    newWeights[result.providerId] = result.recommendedWeight;
  }

  // Normalize weights
  const normalizedWeights = normalizeWeights(newWeights);

  console.log('=== Normalized Weights ===\n');
  for (const [providerId, weight] of Object.entries(normalizedWeights)) {
    console.log(`  ${providerId}: ${weight.toFixed(3)}`);
  }

  // Save weights to in-memory config (for production use)
  await saveWeights(normalizedWeights);

  // Save calibration results to JSON config file
  saveCalibrationResults(calibrationResults, goldenDir);
  console.log('\n[OK] Weights saved successfully');

  // Generate recommendations
  console.log('\n=== Recommendations ===\n');

  const sortedResults = [...calibrationResults].sort((a, b) => b.accuracy - a.accuracy);

  console.log('Top performing providers:');
  for (let i = 0; i < Math.min(3, sortedResults.length); i++) {
    const result = sortedResults[i];
    console.log(`  ${i + 1}. ${result.providerId} (${(result.accuracy * 100).toFixed(2)}%)`);
  }

  if (sortedResults.length > 0) {
    const lowestAccuracy = sortedResults[sortedResults.length - 1];
    if (lowestAccuracy.accuracy < 0.7) {
      console.log(`\n⚠ Warning: ${lowestAccuracy.providerId} has low accuracy (${(lowestAccuracy.accuracy * 100).toFixed(2)}%)`);
      console.log('  Consider investigating or disabling this provider.');
    }
  }
}

// CLI entry point
const args = process.argv.slice(2);
const goldenDirIndex = args.indexOf('--golden-dir');
const goldenDir = goldenDirIndex >= 0 ? args[goldenDirIndex + 1] : './tests/golden';

if (!goldenDir) {
  console.error('Usage: npm run calibrate -- --golden-dir <path>');
  process.exit(1);
}

calibrate(goldenDir)
  .then(() => {
    console.log('\nCalibration completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nCalibration failed:', error);
    process.exit(1);
  });
