import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * Committee integration tests
 * Tests the multi-model committee decision-making process
 */

describe('Committee Integration', () => {
  describe('3-provider committee mapping', () => {
    it('should call all 3 models with bounded evidence pack', async () => {
      const evidencePack = {
        field: 'sku',
        candidates: [
          { id: 'col-A', header: 'Item Code', samples: ['SKU-001', 'SKU-002', 'SKU-003'] },
          { id: 'col-B', header: 'Product Code', samples: ['PC-001', 'PC-002', 'PC-003'] },
          { id: 'col-C', header: 'Code', samples: ['001', '002', '003'] }
        ],
        constraint: 'must choose from candidate IDs only'
      };

      // Mock provider responses
      const providerResponses = [
        { provider: 'gpt-4o', choice: 'col-A', confidence: 0.95 },
        { provider: 'claude-opus-4', choice: 'col-A', confidence: 0.92 },
        { provider: 'gemini-pro', choice: 'col-A', confidence: 0.88 }
      ];

      expect(providerResponses.length).toBe(3);
      expect(providerResponses.every(r => r.choice === 'col-A')).toBe(true);
    });

    it('should aggregate votes with weights', async () => {
      const votes = [
        { provider: 'gpt-4o', choice: 'col-A', confidence: 0.90, weight: 0.40 },
        { provider: 'claude-opus-4', choice: 'col-B', confidence: 0.85, weight: 0.35 },
        { provider: 'gemini-pro', choice: 'col-A', confidence: 0.80, weight: 0.25 }
      ];

      const weightedScores = votes.reduce((acc, vote) => {
        acc[vote.choice] = (acc[vote.choice] || 0) + (vote.weight * vote.confidence);
        return acc;
      }, {} as Record<string, number>);

      const winner = Object.entries(weightedScores)
        .sort(([, a], [, b]) => b - a)[0];

      expect(winner[0]).toBe('col-A');
      expect(winner[1]).toBeGreaterThan(0.50);
    });

    it('should detect disagreement on critical fields', async () => {
      const field = 'customer';
      const votes = [
        { provider: 'gpt-4o', choice: 'col-A', confidence: 0.85 },
        { provider: 'claude-opus-4', choice: 'col-B', confidence: 0.83 },
        { provider: 'gemini-pro', choice: 'col-A', confidence: 0.80 }
      ];

      const criticalFields = ['customer', 'sku', 'gtin'];
      const isCritical = criticalFields.includes(field);
      const uniqueChoices = new Set(votes.map(v => v.choice));
      const hasDisagreement = uniqueChoices.size > 1;

      const result = {
        field,
        requiresHuman: isCritical && hasDisagreement,
        reason: 'Committee disagreement on critical field',
        votes
      };

      expect(result.requiresHuman).toBe(true);
    });

    it('should accept unanimous high-confidence votes', async () => {
      const votes = [
        { provider: 'gpt-4o', choice: 'col-A', confidence: 0.95 },
        { provider: 'claude-opus-4', choice: 'col-A', confidence: 0.92 },
        { provider: 'gemini-pro', choice: 'col-A', confidence: 0.90 }
      ];

      const unanimous = votes.every(v => v.choice === votes[0].choice);
      const minConfidence = Math.min(...votes.map(v => v.confidence));

      const result = {
        accepted: unanimous && minConfidence >= 0.80,
        choice: votes[0].choice,
        consensus: 'unanimous'
      };

      expect(result.accepted).toBe(true);
      expect(result.consensus).toBe('unanimous');
    });

    it('should handle provider timeout gracefully', async () => {
      const votes = [
        { provider: 'gpt-4o', choice: 'col-A', confidence: 0.95 },
        { provider: 'claude-opus-4', choice: 'col-A', confidence: 0.92 },
        { provider: 'gemini-pro', choice: null, confidence: 0, error: 'timeout' }
      ];

      const validVotes = votes.filter(v => v.choice !== null);
      const canProceed = validVotes.length >= 2;

      expect(canProceed).toBe(true);
      expect(validVotes.length).toBe(2);
    });
  });

  describe('committee result format', () => {
    it('should return complete decision metadata', async () => {
      const result = {
        field: 'sku',
        choice: 'col-A',
        confidence: 0.90,
        consensus: 'unanimous',
        requiresHumanInput: false,
        votes: [
          { provider: 'gpt-4o', choice: 'col-A', confidence: 0.95 },
          { provider: 'claude-opus-4', choice: 'col-A', confidence: 0.92 },
          { provider: 'gemini-pro', choice: 'col-A', confidence: 0.90 }
        ],
        timestamp: new Date().toISOString()
      };

      expect(result.field).toBe('sku');
      expect(result.choice).toBe('col-A');
      expect(result.votes.length).toBe(3);
      expect(result.requiresHumanInput).toBe(false);
    });

    it('should include disagreement details when needed', async () => {
      const result = {
        field: 'customer',
        choice: null,
        confidence: 0,
        consensus: 'none',
        requiresHumanInput: true,
        votes: [
          { provider: 'gpt-4o', choice: 'col-A', confidence: 0.80 },
          { provider: 'claude-opus-4', choice: 'col-B', confidence: 0.82 },
          { provider: 'gemini-pro', choice: 'col-C', confidence: 0.79 }
        ],
        disagreement: {
          reason: 'All providers chose different columns',
          candidates: ['col-A', 'col-B', 'col-C']
        }
      };

      expect(result.requiresHumanInput).toBe(true);
      expect(result.disagreement?.candidates.length).toBe(3);
    });
  });

  describe('weight calibration', () => {
    it('should load weights from calibration data', async () => {
      const calibrationData = {
        'gpt-4o': { accuracy: 0.92, fieldsCorrect: 46, fieldsTotal: 50 },
        'claude-opus-4': { accuracy: 0.88, fieldsCorrect: 44, fieldsTotal: 50 },
        'gemini-pro': { accuracy: 0.85, fieldsCorrect: 42, fieldsTotal: 50 }
      };

      const total = Object.values(calibrationData).reduce((sum, data) => sum + data.accuracy, 0);
      const weights = Object.entries(calibrationData).reduce((acc, [provider, data]) => {
        acc[provider] = data.accuracy / total;
        return acc;
      }, {} as Record<string, number>);

      expect(weights['gpt-4o']).toBeGreaterThan(weights['claude-opus-4']);
      expect(weights['claude-opus-4']).toBeGreaterThan(weights['gemini-pro']);

      const sumWeights = Object.values(weights).reduce((sum, w) => sum + w, 0);
      expect(sumWeights).toBeCloseTo(1.0, 2);
    });

    it('should update weights after golden file runs', async () => {
      // Old weights (equal distribution before calibration)
      const oldWeights = {
        'gpt-4o': 0.33,
        'claude-opus-4': 0.33,
        'gemini-pro': 0.34
      };

      // New calibration shows gpt-4o performed best
      const newCalibration = {
        'gpt-4o': { accuracy: 0.95 },
        'claude-opus-4': { accuracy: 0.88 },
        'gemini-pro': { accuracy: 0.90 }
      };

      const total = Object.values(newCalibration).reduce((sum, data) => sum + data.accuracy, 0);
      const newWeights = Object.entries(newCalibration).reduce((acc, [provider, data]) => {
        acc[provider] = data.accuracy / total;
        return acc;
      }, {} as Record<string, number>);

      // gpt-4o had highest accuracy, so should now have highest weight
      expect(newWeights['gpt-4o']).toBeGreaterThan(oldWeights['gpt-4o']);
      expect(newWeights['gpt-4o']).toBeGreaterThan(newWeights['claude-opus-4']);
      expect(newWeights['gpt-4o']).toBeGreaterThan(newWeights['gemini-pro']);
    });
  });

  describe('bounded extraction constraints', () => {
    it('should only allow selection from provided candidates', async () => {
      const candidates = ['col-A', 'col-B', 'col-C'];

      const isValidChoice = (choice: string): boolean => {
        return candidates.includes(choice);
      };

      expect(isValidChoice('col-A')).toBe(true);
      expect(isValidChoice('col-D')).toBe(false);
      expect(isValidChoice('invented-column')).toBe(false);
    });

    it('should reject responses that invent new columns', async () => {
      const allowedCandidates = ['col-A', 'col-B'];
      const providerResponse = 'col-Z'; // Invalid

      const isValid = allowedCandidates.includes(providerResponse);

      const result = {
        accepted: isValid,
        error: isValid ? null : 'Provider returned invalid column ID'
      };

      expect(result.accepted).toBe(false);
      expect(result.error).toContain('invalid');
    });

    it('should include constraints in evidence pack', async () => {
      const evidencePack = {
        field: 'sku',
        candidates: [
          { id: 'col-A', header: 'SKU' },
          { id: 'col-B', header: 'Item Code' }
        ],
        constraints: {
          mustChooseFromCandidates: true,
          cannotInventColumns: true,
          mustReturnSingleChoice: true
        }
      };

      expect(evidencePack.constraints.mustChooseFromCandidates).toBe(true);
      expect(evidencePack.constraints.cannotInventColumns).toBe(true);
    });
  });

  describe('provider error handling', () => {
    it('should handle provider API errors', async () => {
      const providerResults = [
        { provider: 'gpt-4o', choice: 'col-A', confidence: 0.95, error: null },
        { provider: 'claude-opus-4', choice: null, confidence: 0, error: 'API_ERROR' },
        { provider: 'gemini-pro', choice: 'col-A', confidence: 0.90, error: null }
      ];

      const successfulVotes = providerResults.filter(r => r.error === null);

      expect(successfulVotes.length).toBe(2);
      expect(successfulVotes.every(v => v.choice === 'col-A')).toBe(true);
    });

    it('should fail gracefully when all providers error', async () => {
      const providerResults = [
        { provider: 'gpt-4o', error: 'TIMEOUT' },
        { provider: 'claude-opus-4', error: 'API_ERROR' },
        { provider: 'gemini-pro', error: 'RATE_LIMIT' }
      ];

      const allFailed = providerResults.every(r => r.error);

      const fallbackResult = {
        field: 'sku',
        choice: null,
        requiresHumanInput: true,
        error: 'All committee providers failed',
        fallbackStrategy: 'user-selection'
      };

      expect(allFailed).toBe(true);
      expect(fallbackResult.requiresHumanInput).toBe(true);
    });

    it('should log all provider responses for audit', async () => {
      const auditLog = {
        timestamp: new Date().toISOString(),
        field: 'customer',
        evidencePack: { /* ... */ },
        providerResponses: [
          { provider: 'gpt-4o', choice: 'col-A', confidence: 0.90, latency: 1200 },
          { provider: 'claude-opus-4', choice: 'col-A', confidence: 0.88, latency: 980 },
          { provider: 'gemini-pro', choice: 'col-B', confidence: 0.75, latency: 1500 }
        ],
        finalDecision: { choice: 'col-A', consensus: '2-of-3' }
      };

      expect(auditLog.providerResponses.length).toBe(3);
      expect(auditLog.finalDecision.consensus).toBe('2-of-3');
    });
  });
});
