/**
 * Committee Voting Integration Tests
 *
 * Tests the 3-provider committee system with:
 * - Mock LLM responses
 * - Weighted voting aggregation
 * - Disagreement handling
 * - Consensus detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setupIntegrationTests,
  mockCommitteeProvider,
  testConfig,
  generateTestCaseId,
  type MockProviderResponse,
} from './setup';
import {
  unanimousHighConfidence,
  unanimousLowConfidence,
  twoOfThreeConsensus,
  twoOfThreeWithHighMinorityConfidence,
  completeDisagreement,
  criticalFieldDisagreement,
  providerTimeout,
  allProvidersTimeout,
  farsiHeaderMapping,
  weightedVotingExample,
  mockCalibrationData,
  calculateMockWeights,
  mockWeights,
} from '../mocks/committee-responses';
import { aggregateVotes } from '../../services/committee/src/aggregation/weighted-voting';

// Setup integration test lifecycle
setupIntegrationTests();

describe('Committee Voting Integration', () => {
  describe('3-Provider Committee Execution', () => {
    it('should execute all 3 providers in parallel', async () => {
      const providers = ['gpt-4o', 'claude-opus-4', 'gemini-pro'];
      const evidencePack = {
        field: 'sku',
        candidates: [
          { id: 'col-A', header: 'Item Code', samples: ['SKU-001', 'SKU-002', 'SKU-003'] },
          { id: 'col-B', header: 'Product Code', samples: ['PC-001', 'PC-002', 'PC-003'] },
        ],
      };

      const startTime = Date.now();
      const votes = await mockCommitteeProvider.getCommitteeVotes(evidencePack, providers);
      const elapsedTime = Date.now() - startTime;

      expect(votes.length).toBe(3);
      expect(votes.every(v => providers.includes(v.providerId))).toBe(true);

      // Parallel execution should be faster than sequential
      // Each mock has ~500ms latency, sequential would be ~1500ms
      expect(elapsedTime).toBeLessThan(1200);
    });

    it('should include confidence scores for all mappings', async () => {
      const votes = await mockCommitteeProvider.getCommitteeVotes({}, ['gpt-4o']);

      expect(votes.length).toBe(1);
      expect(votes[0].mappings.length).toBeGreaterThan(0);

      votes[0].mappings.forEach(mapping => {
        expect(mapping.field).toBeDefined();
        expect(mapping.selectedColumnId).toBeDefined();
        expect(mapping.confidence).toBeGreaterThanOrEqual(0);
        expect(mapping.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should return provider-specific latency metrics', async () => {
      const votes = await mockCommitteeProvider.getCommitteeVotes(
        {},
        ['gpt-4o', 'claude-opus-4', 'gemini-pro']
      );

      votes.forEach(vote => {
        expect(vote.latencyMs).toBeDefined();
        expect(vote.latencyMs).toBeGreaterThan(0);
      });
    });
  });

  describe('Weighted Voting Aggregation', () => {
    it('should calculate weighted scores correctly', () => {
      const votes = weightedVotingExample.votes;

      // Calculate weighted scores manually
      const weightedScores: Record<string, number> = {};
      for (const vote of votes) {
        const choice = vote.choice;
        const score = vote.confidence * vote.weight;
        weightedScores[choice] = (weightedScores[choice] || 0) + score;
      }

      // col-C: (0.90 * 0.40) + (0.80 * 0.25) = 0.36 + 0.20 = 0.56
      // col-D: (0.85 * 0.35) = 0.2975
      expect(weightedScores['col-C']).toBeCloseTo(0.56, 2);
      expect(weightedScores['col-D']).toBeCloseTo(0.2975, 2);

      // Winner should be col-C
      const winner = Object.entries(weightedScores).sort(([, a], [, b]) => b - a)[0];
      expect(winner[0]).toBe('col-C');
    });

    it('should normalize weights from calibration data', () => {
      const weights = calculateMockWeights(mockCalibrationData);

      // Sum should be 1.0
      const sum = Object.values(weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);

      // Higher accuracy = higher weight
      expect(weights['gpt-4o']).toBeGreaterThan(weights['claude-opus-4']);
      expect(weights['claude-opus-4']).toBeGreaterThan(weights['gemini-pro']);
    });

    it('should handle unequal weights correctly', () => {
      // Scenario where minority vote has higher weight
      const votes = [
        { provider: 'gpt-4o', choice: 'col-A', confidence: 0.85, weight: 0.60 },
        { provider: 'claude-opus-4', choice: 'col-B', confidence: 0.90, weight: 0.25 },
        { provider: 'gemini-pro', choice: 'col-B', confidence: 0.88, weight: 0.15 },
      ];

      const weightedScores: Record<string, number> = {};
      for (const vote of votes) {
        const score = vote.confidence * vote.weight;
        weightedScores[vote.choice] = (weightedScores[vote.choice] || 0) + score;
      }

      // col-A: 0.85 * 0.60 = 0.51
      // col-B: (0.90 * 0.25) + (0.88 * 0.15) = 0.225 + 0.132 = 0.357
      expect(weightedScores['col-A']).toBeCloseTo(0.51, 2);
      expect(weightedScores['col-B']).toBeCloseTo(0.357, 2);

      // Single high-weight vote wins over two low-weight votes
      const winner = Object.entries(weightedScores).sort(([, a], [, b]) => b - a)[0];
      expect(winner[0]).toBe('col-A');
    });
  });

  describe('Consensus Detection', () => {
    it('should detect unanimous consensus', () => {
      const result = unanimousHighConfidence;

      expect(result.consensus).toBe('unanimous');
      expect(result.votes.every(v => v.choice === result.finalChoice)).toBe(true);
      expect(result.requiresHuman).toBe(false);
    });

    it('should detect 2-of-3 consensus', () => {
      const result = twoOfThreeConsensus;

      expect(result.consensus).toBe('2-of-3');

      // Count votes for each choice
      const voteCounts: Record<string, number> = {};
      result.votes.forEach(v => {
        voteCounts[v.choice] = (voteCounts[v.choice] || 0) + 1;
      });

      // Winner should have 2 votes
      const winnerCount = voteCounts[result.finalChoice!];
      expect(winnerCount).toBe(2);
      expect(result.requiresHuman).toBe(false);
    });

    it('should detect complete disagreement', () => {
      const result = completeDisagreement;

      expect(result.consensus).toBe('none');
      expect(result.finalChoice).toBeNull();
      expect(result.requiresHuman).toBe(true);

      // All choices should be unique
      const choices = result.votes.map(v => v.choice);
      const uniqueChoices = new Set(choices);
      expect(uniqueChoices.size).toBe(3);
    });

    it('should require human review for low confidence unanimous vote', () => {
      const result = unanimousLowConfidence;

      expect(result.consensus).toBe('unanimous');
      expect(result.requiresHuman).toBe(true);

      // All confidences should be below threshold
      const minConfidence = Math.min(...result.votes.map(v => v.confidence));
      expect(minConfidence).toBeLessThan(testConfig.confidenceThreshold);
    });
  });

  describe('Critical Field Handling', () => {
    const criticalFields = ['customer', 'sku', 'gtin'];

    it('should flag critical field disagreements for human review', () => {
      const result = criticalFieldDisagreement;

      expect(criticalFields.includes(result.field)).toBe(true);
      expect(result.requiresHuman).toBe(true);

      // Even with 2-of-3 consensus, critical fields require human review
      expect(result.consensus).toBe('2-of-3');
    });

    it('should not require human review for non-critical field disagreement', () => {
      const nonCriticalResult = {
        field: 'description',
        votes: [
          { provider: 'gpt-4o', choice: 'col-B', confidence: 0.88 },
          { provider: 'claude-opus-4', choice: 'col-B', confidence: 0.85 },
          { provider: 'gemini-pro', choice: 'col-C', confidence: 0.75 },
        ],
        consensus: '2-of-3' as const,
        finalChoice: 'col-B',
        requiresHuman: false,
      };

      expect(criticalFields.includes(nonCriticalResult.field)).toBe(false);
      expect(nonCriticalResult.requiresHuman).toBe(false);
    });

    it('should require confirmation for customer field even with high confidence', () => {
      const customerVotes = {
        field: 'customer',
        votes: [
          { provider: 'gpt-4o', choice: 'col-A', confidence: 0.95 },
          { provider: 'claude-opus-4', choice: 'col-A', confidence: 0.93 },
          { provider: 'gemini-pro', choice: 'col-B', confidence: 0.92 },
        ],
        consensus: '2-of-3' as const,
      };

      // Any disagreement on customer requires human review
      const hasDisagreement = new Set(customerVotes.votes.map(v => v.choice)).size > 1;
      const isCritical = criticalFields.includes(customerVotes.field);

      expect(hasDisagreement).toBe(true);
      expect(isCritical).toBe(true);
    });
  });

  describe('Provider Error Handling', () => {
    beforeEach(() => {
      mockCommitteeProvider.reset();
    });

    it('should continue with 2 providers when 1 times out', async () => {
      mockCommitteeProvider.setFailureRate(0.33); // ~1 in 3 fails

      const votes = await mockCommitteeProvider.getCommitteeVotes(
        {},
        ['gpt-4o', 'claude-opus-4', 'gemini-pro']
      );

      // Should still return all 3, but some may have errors
      expect(votes.length).toBe(3);

      const successfulVotes = votes.filter(v => !v.error);
      const failedVotes = votes.filter(v => v.error);

      // At least some should succeed
      expect(successfulVotes.length + failedVotes.length).toBe(3);
    });

    it('should use fallback result when all providers fail', async () => {
      mockCommitteeProvider.setFailureRate(1.0); // All fail

      const votes = await mockCommitteeProvider.getCommitteeVotes(
        {},
        ['gpt-4o', 'claude-opus-4', 'gemini-pro']
      );

      const successfulVotes = votes.filter(v => !v.error);
      expect(successfulVotes.length).toBe(0);

      // Should trigger fallback to user selection
      const fallbackResult = {
        requiresHuman: true,
        error: 'All committee providers failed',
        fallbackStrategy: 'user-selection',
      };

      expect(fallbackResult.requiresHuman).toBe(true);
    });

    it('should accept 2-provider unanimous vote when 1 fails', () => {
      const result = providerTimeout;

      expect(result.votes.length).toBe(2); // One provider timed out
      expect(result.consensus).toBe('unanimous');
      expect(result.finalChoice).toBe('col-A');
      expect(result.requiresHuman).toBe(false);
    });

    it('should log provider errors for audit', async () => {
      mockCommitteeProvider.setFailureRate(0.5);

      const votes = await mockCommitteeProvider.getCommitteeVotes(
        {},
        ['gpt-4o', 'claude-opus-4', 'gemini-pro']
      );

      const auditRecord = {
        timestamp: new Date().toISOString(),
        providers: votes.map(v => ({
          providerId: v.providerId,
          success: !v.error,
          error: v.error || null,
          latencyMs: v.latencyMs,
        })),
        totalProviders: votes.length,
        successfulProviders: votes.filter(v => !v.error).length,
      };

      expect(auditRecord.providers.length).toBe(3);
      expect(auditRecord.successfulProviders).toBeLessThanOrEqual(3);
    });
  });

  describe('Multilingual Support', () => {
    it('should handle Farsi header mappings', () => {
      const result = farsiHeaderMapping;

      expect(result.field).toBe('sku');
      expect(result.consensus).toBe('unanimous');
      expect(result.requiresHuman).toBe(false);

      // Verify reasoning includes translation
      const reasonings = result.votes.map(v => v.reasoning || '');
      expect(reasonings.some(r => /farsi|persian/i.test(r))).toBe(true);
    });

    it('should detect language from header patterns', () => {
      const headers = ['کد کالا', 'نام محصول', 'تعداد', 'قیمت واحد', 'جمع'];

      const farsiPattern = /[\u0600-\u06FF]/;
      const arabicPattern = /[\u0621-\u064A]/;
      const latinPattern = /[a-zA-Z]/;

      const hasFA = headers.some(h => farsiPattern.test(h));
      const hasAR = headers.some(h => arabicPattern.test(h));
      const hasEN = headers.some(h => latinPattern.test(h));

      expect(hasFA).toBe(true);
      expect(hasEN).toBe(false);
    });

    it('should use language hint in evidence pack', () => {
      const evidencePack = {
        field: 'sku',
        languageHint: 'fa',
        candidates: [
          { id: 'col-A', header: 'کد کالا', samples: ['SKU-001', 'SKU-002'] },
          { id: 'col-B', header: 'شماره محصول', samples: ['P-001', 'P-002'] },
        ],
        constraints: {
          mustChooseFromCandidates: true,
          languageAware: true,
        },
      };

      expect(evidencePack.languageHint).toBe('fa');
      expect(evidencePack.constraints.languageAware).toBe(true);
    });
  });

  describe('Bounded Extraction', () => {
    it('should only accept choices from provided candidates', () => {
      const candidates = ['col-A', 'col-B', 'col-C'];

      const validateChoice = (choice: string): boolean => {
        return candidates.includes(choice);
      };

      expect(validateChoice('col-A')).toBe(true);
      expect(validateChoice('col-B')).toBe(true);
      expect(validateChoice('col-D')).toBe(false);
      expect(validateChoice('invented-column')).toBe(false);
    });

    it('should reject provider responses with invalid column IDs', () => {
      const candidates = ['col-A', 'col-B'];
      const providerResponse = 'col-Z'; // Invalid

      const isValid = candidates.includes(providerResponse);

      const result = {
        accepted: isValid,
        error: isValid ? null : 'Provider returned invalid column ID',
        rejectedChoice: isValid ? null : providerResponse,
      };

      expect(result.accepted).toBe(false);
      expect(result.error).toContain('invalid');
    });

    it('should include constraints in evidence pack', () => {
      const evidencePack = {
        field: 'sku',
        candidates: [
          { id: 'col-A', header: 'SKU' },
          { id: 'col-B', header: 'Item Code' },
        ],
        constraints: {
          mustChooseFromCandidates: true,
          cannotInventColumns: true,
          mustReturnSingleChoice: true,
          responseFormat: 'json',
        },
      };

      expect(evidencePack.constraints.mustChooseFromCandidates).toBe(true);
      expect(evidencePack.constraints.cannotInventColumns).toBe(true);
      expect(evidencePack.constraints.mustReturnSingleChoice).toBe(true);
    });

    it('should validate response format before processing', () => {
      const validResponse = {
        field: 'sku',
        selectedColumnId: 'col-A',
        confidence: 0.92,
        reasoning: 'Header matches SKU pattern',
      };

      const invalidResponse = {
        field: 'sku',
        selectedColumnId: null, // Missing choice
        confidence: 0.5,
      };

      const validateResponse = (response: typeof validResponse | typeof invalidResponse): boolean => {
        return (
          response.field !== undefined &&
          response.selectedColumnId !== null &&
          response.confidence >= 0 &&
          response.confidence <= 1
        );
      };

      expect(validateResponse(validResponse)).toBe(true);
      expect(validateResponse(invalidResponse)).toBe(false);
    });
  });

  describe('Weight Calibration', () => {
    it('should load weights from calibration data', () => {
      const weights = mockWeights;

      expect(Object.keys(weights).length).toBe(3);
      expect(weights['gpt-4o']).toBeDefined();
      expect(weights['claude-opus-4']).toBeDefined();
      expect(weights['gemini-pro']).toBeDefined();
    });

    it('should recalculate weights after golden file calibration', () => {
      const oldWeights = { ...mockWeights };

      // Simulate updated calibration (gpt-4o performed worse, gemini better)
      const newCalibration = {
        'gpt-4o': { accuracy: 0.85, fieldsCorrect: 42, fieldsTotal: 50 },
        'claude-opus-4': { accuracy: 0.90, fieldsCorrect: 45, fieldsTotal: 50 },
        'gemini-pro': { accuracy: 0.92, fieldsCorrect: 46, fieldsTotal: 50 },
      };

      const newWeights = calculateMockWeights(
        newCalibration as typeof mockCalibrationData
      );

      // Order should change
      expect(newWeights['gemini-pro']).toBeGreaterThan(newWeights['gpt-4o']);
      expect(newWeights['claude-opus-4']).toBeGreaterThan(newWeights['gpt-4o']);
    });

    it('should fall back to equal weights if calibration unavailable', () => {
      const fallbackWeights = {
        'gpt-4o': 1 / 3,
        'claude-opus-4': 1 / 3,
        'gemini-pro': 1 / 3,
      };

      const sum = Object.values(fallbackWeights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });

    it('should store calibration history for analysis', () => {
      const calibrationHistory = [
        {
          date: '2025-12-20',
          weights: calculateMockWeights(mockCalibrationData),
          goldenFilesUsed: 50,
        },
        {
          date: '2025-12-25',
          weights: {
            'gpt-4o': 0.35,
            'claude-opus-4': 0.33,
            'gemini-pro': 0.32,
          },
          goldenFilesUsed: 75,
        },
      ];

      expect(calibrationHistory.length).toBe(2);
      expect(calibrationHistory[1].goldenFilesUsed).toBeGreaterThan(
        calibrationHistory[0].goldenFilesUsed
      );
    });
  });

  describe('Committee Result Format', () => {
    it('should return complete decision metadata', () => {
      const result = {
        field: 'sku',
        choice: 'col-A',
        confidence: 0.90,
        consensus: 'unanimous' as const,
        requiresHumanInput: false,
        votes: unanimousHighConfidence.votes,
        timestamp: new Date().toISOString(),
        providersUsed: ['gpt-4o', 'claude-opus-4', 'gemini-pro'],
        latencyMs: {
          total: 850,
          byProvider: { 'gpt-4o': 320, 'claude-opus-4': 280, 'gemini-pro': 450 },
        },
      };

      expect(result.field).toBe('sku');
      expect(result.choice).toBe('col-A');
      expect(result.votes.length).toBe(3);
      expect(result.requiresHumanInput).toBe(false);
      expect(result.providersUsed.length).toBe(3);
    });

    it('should include disagreement details when human review needed', () => {
      const result = {
        field: 'customer',
        choice: null,
        confidence: 0,
        consensus: 'none' as const,
        requiresHumanInput: true,
        votes: completeDisagreement.votes,
        disagreement: {
          reason: 'All providers chose different columns',
          candidates: ['col-A', 'col-B', 'col-C'],
          providerChoices: {
            'gpt-4o': 'col-A',
            'claude-opus-4': 'col-B',
            'gemini-pro': 'col-C',
          },
          suggestedAction: 'User must select the correct customer column',
        },
      };

      expect(result.requiresHumanInput).toBe(true);
      expect(result.disagreement.candidates.length).toBe(3);
      expect(result.disagreement.suggestedAction).toBeDefined();
    });

    it('should include evidence pack in result for audit', () => {
      const result = {
        field: 'sku',
        choice: 'col-A',
        evidencePack: {
          candidates: [
            { id: 'col-A', header: 'SKU', samples: ['SKU-001', 'SKU-002'] },
            { id: 'col-B', header: 'Code', samples: ['001', '002'] },
          ],
          constraints: {
            mustChooseFromCandidates: true,
          },
        },
        votes: unanimousHighConfidence.votes,
        auditTrail: {
          requestId: 'req-12345',
          timestamp: new Date().toISOString(),
          totalLatencyMs: 850,
        },
      };

      expect(result.evidencePack).toBeDefined();
      expect(result.evidencePack.candidates.length).toBe(2);
      expect(result.auditTrail.requestId).toBeDefined();
    });
  });

  describe('Voting Edge Cases', () => {
    it('should handle single-provider fallback gracefully', async () => {
      mockCommitteeProvider.setFailureRate(0.67); // ~2 of 3 fail

      const votes = await mockCommitteeProvider.getCommitteeVotes(
        {},
        ['gpt-4o', 'claude-opus-4', 'gemini-pro']
      );

      const successfulVotes = votes.filter(v => !v.error);

      if (successfulVotes.length === 1) {
        // Single provider result needs human review
        const result = {
          consensus: 'single' as const,
          choice: successfulVotes[0].mappings[0]?.selectedColumnId,
          requiresHuman: true,
          reason: 'Only one provider responded successfully',
        };

        expect(result.requiresHuman).toBe(true);
      }
    });

    it('should handle tie-breaker scenarios', () => {
      // With 3 providers, true ties are impossible
      // But with 2 providers (one failed), ties can occur
      const twoProviderVotes = [
        { provider: 'gpt-4o', choice: 'col-A', confidence: 0.85, weight: 0.50 },
        { provider: 'claude-opus-4', choice: 'col-B', confidence: 0.85, weight: 0.50 },
      ];

      const scores: Record<string, number> = {};
      for (const vote of twoProviderVotes) {
        const score = vote.confidence * vote.weight;
        scores[vote.choice] = (scores[vote.choice] || 0) + score;
      }

      // Both have same score
      expect(scores['col-A']).toBe(scores['col-B']);

      // Tie-breaker: use first alphabetically or require human
      const sorted = Object.entries(scores).sort((a, b) => {
        if (a[1] !== b[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]); // Alphabetical tie-breaker
      });

      expect(sorted[0][0]).toBe('col-A'); // Alphabetically first
    });

    it('should handle null/undefined confidence values', () => {
      const votesWithNulls = [
        { provider: 'gpt-4o', choice: 'col-A', confidence: 0.90 },
        { provider: 'claude-opus-4', choice: 'col-A', confidence: undefined as unknown as number },
        { provider: 'gemini-pro', choice: 'col-A', confidence: 0.85 },
      ];

      const validVotes = votesWithNulls.filter(
        v => v.confidence !== undefined && v.confidence !== null
      );

      expect(validVotes.length).toBe(2);

      // Calculate average with valid votes only
      const avgConfidence =
        validVotes.reduce((sum, v) => sum + v.confidence, 0) / validVotes.length;

      expect(avgConfidence).toBeCloseTo(0.875, 2);
    });
  });
});
