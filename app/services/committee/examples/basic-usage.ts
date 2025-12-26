/**
 * Basic usage example for Committee Engine
 */

import {
  CommitteeEngine,
  ProviderFactory,
  createDefaultConfig,
  getDefaultProviderConfigs,
  SchemaMappingTask,
  EvidencePack,
} from '../src';

async function example() {
  // 1. Initialize provider factory with default configurations
  const providerConfigs = getDefaultProviderConfigs();
  const factory = new ProviderFactory({ configs: providerConfigs });

  console.log(`Initialized ${factory.getProviderCount()} providers`);

  // 2. Create committee configuration
  const config = createDefaultConfig();
  console.log('Committee config:', {
    providerCount: config.providerCount,
    consensusThreshold: config.consensusThreshold,
    timeoutMs: config.timeoutMs,
  });

  // 3. Create committee engine
  const engine = new CommitteeEngine(
    factory,
    config,
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );

  // 4. Prepare evidence pack
  const evidencePack: EvidencePack = {
    caseId: 'example-case-001',
    candidateHeaders: [
      'Customer Name',    // Column 0
      'SKU',              // Column 1
      'کد کالا',          // Column 2 (Farsi: Product Code)
      'تعداد',            // Column 3 (Farsi: Quantity)
      'Quantity',         // Column 4
      'Unit Price',       // Column 5
      'Total',            // Column 6
    ],
    sampleValues: {
      '0': ['Acme Corporation', 'Beta Industries', 'Gamma Trading', 'Delta Corp', 'Epsilon Ltd'],
      '1': ['SKU-001', 'SKU-002', 'SKU-003', 'SKU-004', 'SKU-005'],
      '2': ['ABC-100', 'DEF-200', 'GHI-300', 'JKL-400', 'MNO-500'],
      '3': ['10', '5', '25', '15', '8'],
      '4': ['100', '50', '250', '150', '80'],
      '5': ['19.99', '45.50', '12.75', '99.00', '8.25'],
      '6': ['199.90', '227.50', '318.75', '1485.00', '66.00'],
    },
    columnStats: [
      {
        columnId: '0',
        headerText: 'Customer Name',
        nonEmptyCount: 15,
        uniqueCount: 12,
        dataTypes: { string: 15 },
        patterns: [],
      },
      {
        columnId: '1',
        headerText: 'SKU',
        nonEmptyCount: 15,
        uniqueCount: 15,
        dataTypes: { string: 15 },
        patterns: ['SKU-XXX'],
      },
      {
        columnId: '2',
        headerText: 'کد کالا',
        nonEmptyCount: 15,
        uniqueCount: 15,
        dataTypes: { string: 15 },
        patterns: ['ABC-XXX'],
      },
      {
        columnId: '3',
        headerText: 'تعداد',
        nonEmptyCount: 15,
        uniqueCount: 12,
        dataTypes: { number: 15 },
        patterns: [],
      },
      {
        columnId: '4',
        headerText: 'Quantity',
        nonEmptyCount: 15,
        uniqueCount: 12,
        dataTypes: { number: 15 },
        patterns: [],
      },
      {
        columnId: '5',
        headerText: 'Unit Price',
        nonEmptyCount: 15,
        uniqueCount: 15,
        dataTypes: { number: 15 },
        patterns: ['Currency'],
      },
      {
        columnId: '6',
        headerText: 'Total',
        nonEmptyCount: 15,
        uniqueCount: 15,
        dataTypes: { number: 15 },
        patterns: ['Currency'],
      },
    ],
    detectedLanguage: 'mixed',
    constraints: [
      'Must choose from candidate column IDs (0-6) only',
      'Cannot invent new columns or values',
      'Return null if no suitable match exists',
    ],
    timestamp: new Date().toISOString(),
  };

  // 5. Create schema mapping task
  const task: SchemaMappingTask = {
    type: 'schema-mapping',
    evidencePack,
    expectedFields: [
      'customer_name',
      'sku',
      'quantity',
      'unit_price',
      'line_total',
    ],
    candidateColumns: {},
  };

  // 6. Run committee
  console.log('\nRunning committee with 3 providers...');
  const startTime = Date.now();

  try {
    const result = await engine.runCommittee(task);

    console.log(`\n✓ Committee completed in ${result.executionTimeMs}ms`);
    console.log(`\n=== Results ===`);
    console.log(`Task ID: ${result.taskId}`);
    console.log(`Case ID: ${result.caseId}`);
    console.log(`Selected Providers: ${result.selectedProviders.join(', ')}`);
    console.log(`\nConsensus: ${result.aggregatedResult.consensus}`);
    console.log(`Overall Confidence: ${(result.aggregatedResult.overallConfidence * 100).toFixed(1)}%`);
    console.log(`Requires Human Review: ${result.requiresHumanReview}`);

    console.log(`\n=== Final Mappings ===`);
    for (const [field, columnId] of Object.entries(result.finalMappings)) {
      const header = columnId !== null
        ? evidencePack.candidateHeaders[parseInt(columnId)]
        : 'NOT MAPPED';
      console.log(`  ${field}: Column ${columnId} (${header})`);
    }

    if (result.aggregatedResult.disagreements.length > 0) {
      console.log(`\n=== Disagreements (${result.aggregatedResult.disagreements.length}) ===`);
      for (const disagreement of result.aggregatedResult.disagreements) {
        console.log(`\n  Field: ${disagreement.field}`);
        console.log(`  Reason: ${disagreement.reason}`);
        console.log(`  Provider Outputs:`);
        for (const [providerId, columnId] of Object.entries(disagreement.providerOutputs)) {
          console.log(`    ${providerId}: Column ${columnId}`);
        }
      }
    }

    console.log(`\n=== Field Votes ===`);
    for (const fieldVote of result.aggregatedResult.fieldVotes) {
      console.log(`\n  ${fieldVote.field}:`);
      console.log(`    Winner: Column ${fieldVote.winner} (margin: ${fieldVote.winnerMargin.toFixed(2)})`);
      console.log(`    Requires Human: ${fieldVote.requiresHuman}`);
      console.log(`    Votes:`);
      for (const vote of fieldVote.votes) {
        console.log(`      Column ${vote.columnId}: weight=${vote.weight.toFixed(2)}, confidence=${vote.confidence.toFixed(2)}, providers=${vote.providers.join(',')}`);
      }
    }

    if (result.auditTrail.rawOutputsBlobUri) {
      console.log(`\n=== Audit Trail ===`);
      console.log(`Evidence Pack: ${result.auditTrail.evidencePackBlobUri}`);
      console.log(`Raw Outputs: ${result.auditTrail.rawOutputsBlobUri}`);
    }

  } catch (error) {
    console.error('\n✗ Committee failed:', error instanceof Error ? error.message : error);
    throw error;
  }
}

// Run example
if (require.main === module) {
  example()
    .then(() => {
      console.log('\n✓ Example completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n✗ Example failed:', error);
      process.exit(1);
    });
}

export { example };
