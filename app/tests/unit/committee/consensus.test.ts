import { describe, it, expect } from 'vitest';

/**
 * Consensus logic unit tests
 * Tests for determining when committee reaches consensus
 */

describe('Consensus Logic', () => {
  describe('unanimousConsensus', () => {
    it('should detect unanimous agreement', () => {
      const votes = ['A', 'A', 'A'];
      const unanimous = votes.every(v => v === votes[0]);

      expect(unanimous).toBe(true);
    });

    it('should reject non-unanimous votes', () => {
      const votes = ['A', 'A', 'B'];
      const unanimous = votes.every(v => v === votes[0]);

      expect(unanimous).toBe(false);
    });
  });

  describe('majorityConsensus', () => {
    it('should detect 2/3 majority', () => {
      const votes = ['A', 'A', 'B'];

      const voteCounts = votes.reduce((acc, vote) => {
        acc[vote] = (acc[vote] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const maxVotes = Math.max(...Object.values(voteCounts));
      const hasMajority = maxVotes >= 2;

      expect(hasMajority).toBe(true);
    });

    it('should reject when no majority', () => {
      const votes = ['A', 'B', 'C'];

      const voteCounts = votes.reduce((acc, vote) => {
        acc[vote] = (acc[vote] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const maxVotes = Math.max(...Object.values(voteCounts));
      const hasMajority = maxVotes >= 2;

      expect(hasMajority).toBe(false);
    });

    it('should identify majority choice', () => {
      const votes = ['B', 'A', 'A'];

      const voteCounts = votes.reduce((acc, vote) => {
        acc[vote] = (acc[vote] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const majorityChoice = Object.entries(voteCounts)
        .sort(([, a], [, b]) => b - a)[0][0];

      expect(majorityChoice).toBe('A');
    });
  });

  describe('confidenceThreshold', () => {
    it('should accept high confidence unanimous votes', () => {
      const votes = [
        { choice: 'A', confidence: 0.95 },
        { choice: 'A', confidence: 0.92 },
        { choice: 'A', confidence: 0.90 }
      ];

      const unanimous = votes.every(v => v.choice === votes[0].choice);
      const minConfidence = Math.min(...votes.map(v => v.confidence));
      const threshold = 0.80;

      const shouldAccept = unanimous && minConfidence >= threshold;

      expect(shouldAccept).toBe(true);
    });

    it('should reject low confidence unanimous votes', () => {
      const votes = [
        { choice: 'A', confidence: 0.70 },
        { choice: 'A', confidence: 0.65 },
        { choice: 'A', confidence: 0.60 }
      ];

      const unanimous = votes.every(v => v.choice === votes[0].choice);
      const minConfidence = Math.min(...votes.map(v => v.confidence));
      const threshold = 0.80;

      const shouldAccept = unanimous && minConfidence >= threshold;

      expect(shouldAccept).toBe(false);
    });

    it('should check minority confidence in 2/3 scenarios', () => {
      const votes = [
        { choice: 'A', confidence: 0.95 },
        { choice: 'A', confidence: 0.90 },
        { choice: 'B', confidence: 0.85 }
      ];

      const majorityVotes = votes.filter(v => v.choice === 'A');
      const minorityVotes = votes.filter(v => v.choice !== 'A');

      const majorityConfidence = Math.min(...majorityVotes.map(v => v.confidence));
      const minorityConfidence = Math.max(...minorityVotes.map(v => v.confidence));

      // Accept if majority is high and minority is significantly lower
      const shouldAccept = majorityConfidence >= 0.85 && minorityConfidence < 0.70;

      expect(shouldAccept).toBe(false); // In this case, minority is too confident
    });
  });

  describe('disagreementDetection', () => {
    it('should detect when all models disagree', () => {
      const votes = ['A', 'B', 'C'];
      const uniqueVotes = new Set(votes);

      const allDisagree = uniqueVotes.size === votes.length;

      expect(allDisagree).toBe(true);
    });

    it('should detect partial agreement', () => {
      const votes = ['A', 'A', 'B'];
      const uniqueVotes = new Set(votes);

      const hasDisagreement = uniqueVotes.size > 1;
      const hasAgreement = uniqueVotes.size < votes.length;

      expect(hasDisagreement).toBe(true);
      expect(hasAgreement).toBe(true);
    });

    it('should list disagreeing fields', () => {
      const fieldVotes = {
        customer: ['col-A', 'col-A', 'col-B'],
        sku: ['col-C', 'col-C', 'col-C'],
        quantity: ['col-D', 'col-E', 'col-D']
      };

      const disagreements = Object.entries(fieldVotes)
        .filter(([, votes]) => new Set(votes).size > 1)
        .map(([field]) => field);

      expect(disagreements).toContain('customer');
      expect(disagreements).toContain('quantity');
      expect(disagreements).not.toContain('sku');
    });
  });

  describe('criticalFieldPolicy', () => {
    it('should flag disagreement on customer field', () => {
      const field = 'customer';
      const criticalFields = ['customer', 'sku', 'gtin'];
      const votes = ['A', 'A', 'B'];

      const isCritical = criticalFields.includes(field);
      const hasDisagreement = new Set(votes).size > 1;

      const requiresHuman = isCritical && hasDisagreement;

      expect(requiresHuman).toBe(true);
    });

    it('should flag disagreement on item mapping', () => {
      const field = 'sku';
      const criticalFields = ['customer', 'sku', 'gtin'];
      const votes = ['A', 'B', 'C'];

      const isCritical = criticalFields.includes(field);
      const hasDisagreement = new Set(votes).size > 1;

      const requiresHuman = isCritical && hasDisagreement;

      expect(requiresHuman).toBe(true);
    });

    it('should allow disagreement on non-critical fields', () => {
      const field = 'description';
      const criticalFields = ['customer', 'sku', 'gtin'];
      const votes = ['A', 'A', 'B'];

      const isCritical = criticalFields.includes(field);

      expect(isCritical).toBe(false);
    });
  });

  describe('consensusMetrics', () => {
    it('should calculate agreement percentage', () => {
      const votes = ['A', 'A', 'B'];

      const voteCounts = votes.reduce((acc, vote) => {
        acc[vote] = (acc[vote] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const maxVotes = Math.max(...Object.values(voteCounts));
      const agreementPercentage = (maxVotes / votes.length) * 100;

      expect(agreementPercentage).toBeCloseTo(66.67, 1);
    });

    it('should calculate average confidence for majority', () => {
      const votes = [
        { choice: 'A', confidence: 0.90 },
        { choice: 'A', confidence: 0.85 },
        { choice: 'B', confidence: 0.70 }
      ];

      const majorityVotes = votes.filter(v => v.choice === 'A');
      const avgConfidence = majorityVotes.reduce((sum, v) => sum + v.confidence, 0) / majorityVotes.length;

      expect(avgConfidence).toBeCloseTo(0.875, 3);
    });

    it('should identify confidence gap between majority and minority', () => {
      const votes = [
        { choice: 'A', confidence: 0.90 },
        { choice: 'A', confidence: 0.88 },
        { choice: 'B', confidence: 0.65 }
      ];

      const majorityVotes = votes.filter(v => v.choice === 'A');
      const minorityVotes = votes.filter(v => v.choice !== 'A');

      const majorityAvg = majorityVotes.reduce((sum, v) => sum + v.confidence, 0) / majorityVotes.length;
      const minorityAvg = minorityVotes.reduce((sum, v) => sum + v.confidence, 0) / minorityVotes.length;

      const confidenceGap = majorityAvg - minorityAvg;

      expect(confidenceGap).toBeGreaterThan(0.20);
    });
  });

  describe('consensusDecisionRules', () => {
    it('should auto-accept unanimous high-confidence decisions', () => {
      const votes = [
        { choice: 'A', confidence: 0.95 },
        { choice: 'A', confidence: 0.92 },
        { choice: 'A', confidence: 0.90 }
      ];

      const unanimous = votes.every(v => v.choice === votes[0].choice);
      const minConfidence = Math.min(...votes.map(v => v.confidence));

      const decision = {
        autoAccept: unanimous && minConfidence >= 0.80,
        choice: votes[0].choice,
        requiresHuman: false
      };

      expect(decision.autoAccept).toBe(true);
      expect(decision.requiresHuman).toBe(false);
    });

    it('should require review for 2/3 with close minority confidence', () => {
      const votes = [
        { choice: 'A', confidence: 0.85 },
        { choice: 'A', confidence: 0.83 },
        { choice: 'B', confidence: 0.82 }
      ];

      const majorityVotes = votes.filter(v => v.choice === 'A');
      const minorityVotes = votes.filter(v => v.choice !== 'A');

      const majorityConf = Math.min(...majorityVotes.map(v => v.confidence));
      const minorityConf = Math.max(...minorityVotes.map(v => v.confidence));

      const decision = {
        autoAccept: false,
        choice: 'A',
        requiresHuman: Math.abs(majorityConf - minorityConf) < 0.10
      };

      expect(decision.requiresHuman).toBe(true);
    });

    it('should require human for all-disagree scenarios', () => {
      const votes = [
        { choice: 'A', confidence: 0.80 },
        { choice: 'B', confidence: 0.82 },
        { choice: 'C', confidence: 0.79 }
      ];

      const uniqueChoices = new Set(votes.map(v => v.choice));

      const decision = {
        autoAccept: false,
        choice: null,
        requiresHuman: uniqueChoices.size === votes.length,
        candidates: Array.from(uniqueChoices)
      };

      expect(decision.requiresHuman).toBe(true);
      expect(decision.candidates?.length).toBe(3);
    });
  });
});
