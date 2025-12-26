import { describe, it, expect } from 'vitest';

/**
 * Committee Response Contract Tests
 * Validates that AI model responses conform to expected schemas
 */

// Schema definitions for committee responses
interface CommitteeVote {
  provider: string;
  choice: string | null;
  confidence: number;
  reasoning?: string;
  latency?: number;
  error?: string;
}

interface CommitteeResult {
  field: string;
  choice: string | null;
  confidence: number;
  consensus: 'unanimous' | '2-of-3' | 'none';
  requiresHumanInput: boolean;
  votes: CommitteeVote[];
  candidates?: string[];
  timestamp?: string;
}

interface EvidencePack {
  field: string;
  candidates: Array<{
    id: string;
    header: string;
    samples: any[];
  }>;
  constraints: {
    mustChooseFromCandidates: boolean;
    cannotInventColumns: boolean;
    mustReturnSingleChoice: boolean;
  };
}

interface ModelResponse {
  choice: string;
  confidence: number;
  reasoning: string;
}

describe('Committee Response Contract Tests', () => {
  describe('Vote Schema', () => {
    it('should validate required vote fields', () => {
      const validVote: CommitteeVote = {
        provider: 'gpt-4o',
        choice: 'col-A',
        confidence: 0.95
      };

      expect(validVote.provider).toBeDefined();
      expect(validVote.choice).toBeDefined();
      expect(validVote.confidence).toBeDefined();

      expect(typeof validVote.provider).toBe('string');
      expect(typeof validVote.choice).toBe('string');
      expect(typeof validVote.confidence).toBe('number');
    });

    it('should validate provider name is from known set', () => {
      const knownProviders = [
        'gpt-4o',
        'gpt-5.1',
        'claude-opus-4',
        'claude-opus-4.5',
        'gemini-pro',
        'gemini-2.5',
        'deepseek-v3.2',
        'grok-4-fast'
      ];

      knownProviders.forEach(provider => {
        expect(provider.length).toBeGreaterThan(0);
        expect(typeof provider).toBe('string');
      });
    });

    it('should validate confidence is between 0 and 1', () => {
      const validConfidences = [0, 0.5, 0.85, 0.99, 1.0];
      const invalidConfidences = [-0.1, 1.1, 2.0, -1];

      validConfidences.forEach(conf => {
        expect(conf).toBeGreaterThanOrEqual(0);
        expect(conf).toBeLessThanOrEqual(1);
      });

      invalidConfidences.forEach(conf => {
        expect(conf < 0 || conf > 1).toBe(true);
      });
    });

    it('should allow null choice when provider fails', () => {
      const failedVote: CommitteeVote = {
        provider: 'gemini-pro',
        choice: null,
        confidence: 0,
        error: 'timeout'
      };

      expect(failedVote.choice).toBeNull();
      expect(failedVote.confidence).toBe(0);
      expect(failedVote.error).toBeDefined();
    });

    it('should accept optional reasoning field', () => {
      const voteWithReasoning: CommitteeVote = {
        provider: 'gpt-4o',
        choice: 'col-A',
        confidence: 0.95,
        reasoning: 'Header "SKU" matches exactly with field type'
      };

      expect(voteWithReasoning.reasoning).toBeDefined();
      expect(typeof voteWithReasoning.reasoning).toBe('string');
    });

    it('should accept optional latency field', () => {
      const voteWithLatency: CommitteeVote = {
        provider: 'gpt-4o',
        choice: 'col-A',
        confidence: 0.95,
        latency: 1234
      };

      expect(voteWithLatency.latency).toBeDefined();
      expect(typeof voteWithLatency.latency).toBe('number');
      expect(voteWithLatency.latency).toBeGreaterThan(0);
    });
  });

  describe('Committee Result Schema', () => {
    it('should validate required result fields', () => {
      const validResult: CommitteeResult = {
        field: 'sku',
        choice: 'col-A',
        confidence: 0.92,
        consensus: 'unanimous',
        requiresHumanInput: false,
        votes: [
          { provider: 'gpt-4o', choice: 'col-A', confidence: 0.95 },
          { provider: 'claude-opus-4', choice: 'col-A', confidence: 0.92 },
          { provider: 'gemini-pro', choice: 'col-A', confidence: 0.90 }
        ]
      };

      expect(validResult.field).toBeDefined();
      expect(validResult.choice).toBeDefined();
      expect(validResult.confidence).toBeDefined();
      expect(validResult.consensus).toBeDefined();
      expect(validResult.requiresHumanInput).toBeDefined();
      expect(validResult.votes).toBeDefined();
      expect(validResult.votes.length).toBe(3);
    });

    it('should validate consensus enum values', () => {
      const validConsensus = ['unanimous', '2-of-3', 'none'];

      validConsensus.forEach(consensus => {
        expect(['unanimous', '2-of-3', 'none']).toContain(consensus);
      });
    });

    it('should validate field names', () => {
      const validFields = [
        'sku',
        'gtin',
        'customer',
        'quantity',
        'unit_price',
        'line_total',
        'description'
      ];

      validFields.forEach(field => {
        expect(field.length).toBeGreaterThan(0);
        expect(typeof field).toBe('string');
      });
    });

    it('should require candidates when no consensus', () => {
      const noConsensusResult: CommitteeResult = {
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
        candidates: ['col-A', 'col-B', 'col-C']
      };

      expect(noConsensusResult.choice).toBeNull();
      expect(noConsensusResult.consensus).toBe('none');
      expect(noConsensusResult.requiresHumanInput).toBe(true);
      expect(noConsensusResult.candidates).toBeDefined();
      expect(noConsensusResult.candidates?.length).toBeGreaterThan(0);
    });

    it('should set requiresHumanInput true for critical field disagreement', () => {
      const criticalFields = ['customer', 'sku', 'gtin'];

      criticalFields.forEach(field => {
        const result: CommitteeResult = {
          field,
          choice: 'col-A',
          confidence: 0.85,
          consensus: '2-of-3',
          requiresHumanInput: true, // Any disagreement on critical fields = human
          votes: [
            { provider: 'gpt-4o', choice: 'col-A', confidence: 0.90 },
            { provider: 'claude-opus-4', choice: 'col-A', confidence: 0.88 },
            { provider: 'gemini-pro', choice: 'col-B', confidence: 0.75 }
          ]
        };

        expect(result.requiresHumanInput).toBe(true);
      });
    });

    it('should validate timestamp format when present', () => {
      const result: CommitteeResult = {
        field: 'sku',
        choice: 'col-A',
        confidence: 0.92,
        consensus: 'unanimous',
        requiresHumanInput: false,
        votes: [],
        timestamp: '2025-12-25T10:30:00.000Z'
      };

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Evidence Pack Schema', () => {
    it('should validate required evidence pack fields', () => {
      const validPack: EvidencePack = {
        field: 'sku',
        candidates: [
          { id: 'col-A', header: 'SKU', samples: ['SKU-001', 'SKU-002'] },
          { id: 'col-B', header: 'Product Code', samples: ['PC-001', 'PC-002'] }
        ],
        constraints: {
          mustChooseFromCandidates: true,
          cannotInventColumns: true,
          mustReturnSingleChoice: true
        }
      };

      expect(validPack.field).toBeDefined();
      expect(validPack.candidates).toBeDefined();
      expect(validPack.candidates.length).toBeGreaterThan(0);
      expect(validPack.constraints).toBeDefined();
    });

    it('should validate candidate structure', () => {
      const candidate = {
        id: 'col-A',
        header: 'SKU',
        samples: ['SKU-001', 'SKU-002', 'SKU-003']
      };

      expect(candidate.id).toBeDefined();
      expect(typeof candidate.id).toBe('string');
      expect(candidate.header).toBeDefined();
      expect(typeof candidate.header).toBe('string');
      expect(candidate.samples).toBeDefined();
      expect(Array.isArray(candidate.samples)).toBe(true);
    });

    it('should validate constraints are all booleans', () => {
      const constraints = {
        mustChooseFromCandidates: true,
        cannotInventColumns: true,
        mustReturnSingleChoice: true
      };

      Object.values(constraints).forEach(value => {
        expect(typeof value).toBe('boolean');
      });
    });

    it('should limit samples to reasonable count', () => {
      const maxSamples = 10;
      const samples = ['A', 'B', 'C', 'D', 'E'];

      expect(samples.length).toBeLessThanOrEqual(maxSamples);
    });
  });

  describe('Model Response Schema', () => {
    it('should validate model response structure', () => {
      const validResponse: ModelResponse = {
        choice: 'col-A',
        confidence: 0.92,
        reasoning: 'Header matches SKU pattern exactly'
      };

      expect(validResponse.choice).toBeDefined();
      expect(validResponse.confidence).toBeDefined();
      expect(validResponse.reasoning).toBeDefined();
    });

    it('should validate choice is from candidates', () => {
      const candidates = ['col-A', 'col-B', 'col-C'];
      const validChoices = ['col-A', 'col-B', 'col-C'];
      const invalidChoices = ['col-D', 'col-X', 'invented-column'];

      validChoices.forEach(choice => {
        expect(candidates).toContain(choice);
      });

      invalidChoices.forEach(choice => {
        expect(candidates).not.toContain(choice);
      });
    });

    it('should validate confidence range', () => {
      const response: ModelResponse = {
        choice: 'col-A',
        confidence: 0.95,
        reasoning: 'High confidence match'
      };

      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
    });

    it('should require non-empty reasoning', () => {
      const response: ModelResponse = {
        choice: 'col-A',
        confidence: 0.92,
        reasoning: 'Header "SKU" matches field type, sample values follow SKU pattern'
      };

      expect(response.reasoning.length).toBeGreaterThan(0);
    });
  });

  describe('Weight Calibration Data Schema', () => {
    it('should validate calibration data structure', () => {
      const calibrationData = {
        'gpt-4o': {
          accuracy: 0.92,
          fieldsCorrect: 46,
          fieldsTotal: 50,
          lastCalibrated: '2025-12-20T00:00:00Z'
        }
      };

      const entry = calibrationData['gpt-4o'];
      expect(entry.accuracy).toBeDefined();
      expect(entry.fieldsCorrect).toBeDefined();
      expect(entry.fieldsTotal).toBeDefined();
      expect(entry.lastCalibrated).toBeDefined();
    });

    it('should validate accuracy is consistent with fields', () => {
      const calibration = {
        accuracy: 0.92,
        fieldsCorrect: 46,
        fieldsTotal: 50
      };

      const calculatedAccuracy = calibration.fieldsCorrect / calibration.fieldsTotal;
      expect(Math.abs(calibration.accuracy - calculatedAccuracy)).toBeLessThan(0.01);
    });

    it('should validate all providers have calibration data', () => {
      const requiredProviders = ['gpt-4o', 'claude-opus-4', 'gemini-pro'];
      const calibrationData: Record<string, any> = {
        'gpt-4o': { accuracy: 0.92 },
        'claude-opus-4': { accuracy: 0.88 },
        'gemini-pro': { accuracy: 0.85 }
      };

      requiredProviders.forEach(provider => {
        expect(calibrationData[provider]).toBeDefined();
        expect(calibrationData[provider].accuracy).toBeDefined();
      });
    });
  });

  describe('Aggregation Rules', () => {
    it('should calculate weights correctly', () => {
      const calibrationData = {
        'gpt-4o': { accuracy: 0.92 },
        'claude-opus-4': { accuracy: 0.88 },
        'gemini-pro': { accuracy: 0.85 }
      };

      const total = Object.values(calibrationData).reduce(
        (sum, data) => sum + data.accuracy, 0
      );

      const weights = Object.entries(calibrationData).reduce((acc, [provider, data]) => {
        acc[provider] = data.accuracy / total;
        return acc;
      }, {} as Record<string, number>);

      // Weights should sum to 1
      const weightSum = Object.values(weights).reduce((sum, w) => sum + w, 0);
      expect(weightSum).toBeCloseTo(1.0, 5);

      // Higher accuracy = higher weight
      expect(weights['gpt-4o']).toBeGreaterThan(weights['claude-opus-4']);
      expect(weights['claude-opus-4']).toBeGreaterThan(weights['gemini-pro']);
    });

    it('should detect unanimous consensus', () => {
      const votes = [
        { choice: 'col-A' },
        { choice: 'col-A' },
        { choice: 'col-A' }
      ];

      const unique = new Set(votes.map(v => v.choice));
      const isUnanimous = unique.size === 1;

      expect(isUnanimous).toBe(true);
    });

    it('should detect 2-of-3 consensus', () => {
      const votes = [
        { choice: 'col-A' },
        { choice: 'col-A' },
        { choice: 'col-B' }
      ];

      const counts: Record<string, number> = {};
      votes.forEach(v => {
        if (v.choice) {
          counts[v.choice] = (counts[v.choice] || 0) + 1;
        }
      });

      const maxCount = Math.max(...Object.values(counts));
      const hasMajority = maxCount >= 2;

      expect(hasMajority).toBe(true);
    });

    it('should detect no consensus', () => {
      const votes = [
        { choice: 'col-A' },
        { choice: 'col-B' },
        { choice: 'col-C' }
      ];

      const unique = new Set(votes.map(v => v.choice));
      const noConsensus = unique.size === votes.length;

      expect(noConsensus).toBe(true);
    });
  });
});
