#!/usr/bin/env tsx
/**
 * Golden File Test Runner
 * Runs parser against golden files and compares output to expected results
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { deepEqual, computeDiff } from '../utils/test-helpers';

interface GoldenFileResult {
  file: string;
  passed: boolean;
  diff?: any;
  error?: string;
  parseTime?: number;
}

interface GoldenFileSummary {
  totalFiles: number;
  passed: number;
  failed: number;
  results: GoldenFileResult[];
  timestamp: string;
}

class GoldenFileRunner {
  private fixturesDir: string;
  private expectedDir: string;
  private calibrateMode: boolean;

  constructor(calibrateMode = false) {
    this.fixturesDir = join(__dirname, 'fixtures');
    this.expectedDir = join(__dirname, 'expected');
    this.calibrateMode = calibrateMode;
  }

  async run(): Promise<GoldenFileSummary> {
    console.log('🧪 Running golden file tests...\n');

    const files = await readdir(this.fixturesDir);
    const excelFiles = files.filter(f => f.endsWith('.xlsx'));

    if (excelFiles.length === 0) {
      console.log('⚠️  No golden files found in fixtures directory');
      return {
        totalFiles: 0,
        passed: 0,
        failed: 0,
        results: [],
        timestamp: new Date().toISOString()
      };
    }

    console.log(`Found ${excelFiles.length} golden files:\n`);

    const results: GoldenFileResult[] = [];

    for (const file of excelFiles) {
      console.log(`Testing: ${file}`);
      const result = await this.testFile(file);
      results.push(result);

      if (result.passed) {
        console.log(`  ✅ PASSED (${result.parseTime}ms)`);
      } else {
        console.log(`  ❌ FAILED`);
        if (result.error) {
          console.log(`     Error: ${result.error}`);
        }
      }
      console.log();
    }

    const summary: GoldenFileSummary = {
      totalFiles: excelFiles.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results,
      timestamp: new Date().toISOString()
    };

    this.printSummary(summary);

    // Save results
    await this.saveResults(summary);

    return summary;
  }

  private async testFile(fileName: string): Promise<GoldenFileResult> {
    const xlsxPath = join(this.fixturesDir, fileName);
    const expectedPath = join(this.expectedDir, fileName.replace('.xlsx', '.json'));

    try {
      const startTime = Date.now();

      // TODO: Replace with actual parser import when available
      // For now, return mock result
      const actual = await this.mockParseExcel(xlsxPath);

      const parseTime = Date.now() - startTime;

      if (this.calibrateMode) {
        // In calibrate mode, save current output as expected
        await writeFile(expectedPath, JSON.stringify(actual, null, 2));
        console.log(`  📝 Saved expected output for ${fileName}`);
        return { file: fileName, passed: true, parseTime };
      }

      // Load expected output
      let expected: any;
      try {
        const expectedContent = await readFile(expectedPath, 'utf-8');
        expected = JSON.parse(expectedContent);
      } catch (error) {
        return {
          file: fileName,
          passed: false,
          error: `No expected output file found. Run with --calibrate to create it.`
        };
      }

      // Compare with tolerance for dynamic fields
      const passed = deepEqual(actual, expected, {
        ignore: ['meta.received_at', 'meta.correlation', 'timestamp', 'createdAt']
      });

      if (!passed) {
        const diff = computeDiff(actual, expected);
        return {
          file: fileName,
          passed: false,
          diff,
          parseTime
        };
      }

      return {
        file: fileName,
        passed: true,
        parseTime
      };
    } catch (error: any) {
      return {
        file: fileName,
        passed: false,
        error: error.message
      };
    }
  }

  private async mockParseExcel(filePath: string): Promise<any> {
    // Mock parser output - replace with actual parser when available
    // const { parseExcel } = await import('@order-processing/parser');
    // return await parseExcel(filePath);

    return {
      meta: {
        detected_language: 'en',
        sheet_name: 'Orders',
        header_row: 0,
        data_rows: 2,
        received_at: new Date().toISOString(),
        correlation: 'test-correlation'
      },
      customer: {
        raw: { value: 'ACME Corporation', evidence: [] },
        resolved: { zohoCustomerId: null, confidence: 0.0 }
      },
      lines: [
        {
          lineNo: 1,
          sku: { value: 'SKU-001', evidence: [] },
          quantity: { value: 10, evidence: [] },
          resolved: { zohoItemId: null }
        }
      ],
      issues: [],
      status: 'needs-input'
    };
  }

  private printSummary(summary: GoldenFileSummary): void {
    console.log('═══════════════════════════════════════');
    console.log('GOLDEN FILE TEST SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`Total files:    ${summary.totalFiles}`);
    console.log(`Passed:         ${summary.passed} ✅`);
    console.log(`Failed:         ${summary.failed} ❌`);
    console.log(`Success rate:   ${((summary.passed / summary.totalFiles) * 100).toFixed(1)}%`);
    console.log('═══════════════════════════════════════\n');

    if (summary.failed > 0) {
      console.log('Failed files:');
      summary.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.file}`);
          if (r.error) {
            console.log(`    ${r.error}`);
          }
        });
      console.log();
    }
  }

  private async saveResults(summary: GoldenFileSummary): Promise<void> {
    const resultsPath = join(__dirname, 'results.json');
    await writeFile(resultsPath, JSON.stringify(summary, null, 2));
    console.log(`Results saved to: ${resultsPath}\n`);
  }
}

// CLI execution
if (require.main === module) {
  const calibrateMode = process.argv.includes('--calibrate');

  if (calibrateMode) {
    console.log('🔧 Running in CALIBRATION mode - will update expected outputs\n');
  }

  const runner = new GoldenFileRunner(calibrateMode);

  runner.run()
    .then(summary => {
      process.exit(summary.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('❌ Golden file runner failed:', error);
      process.exit(1);
    });
}

export { GoldenFileRunner };
export type { GoldenFileResult, GoldenFileSummary };
