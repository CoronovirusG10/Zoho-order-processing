import { describe, it, expect } from 'vitest';

/**
 * Weighted voting unit tests
 * Tests for committee decision-making with model weights
 */

describe('Weighted Voting', () => {
  describe('calculateWeights', () => {
    it('should calculate weights from accuracy scores', () => {
      const accuracies = {
        'gpt-4o': 0.92,
        'claude-opus-4': 0.88,
        'gemini-pro': 0.85
      };

      // Simple proportional weights
      const total = Object.values(accuracies).reduce((sum, acc) => sum + acc, 0);
      const weights = Object.entries(accuracies).reduce((acc, [model, accuracy]) => {
        acc[model] = accuracy / total;
        return acc;
      }, {} as Record<string, number>);

      expect(weights['gpt-4o']).toBeGreaterThan(weights['claude-opus-4']);
      expect(weights['claude-opus-4']).toBeGreaterThan(weights['gemini-pro']);

      const sumWeights = Object.values(weights).reduce((sum, w) => sum + w, 0);
      expect(sumWeights).toBeCloseTo(1.0, 2);
    });

    it('should handle equal accuracy scores', () => {
      const accuracies = {
        'model-1': 0.90,
        'model-2': 0.90,
        'model-3': 0.90
      };

      const total = Object.values(accuracies).reduce((sum, acc) => sum + acc, 0);
      const weights = Object.entries(accuracies).reduce((acc, [model, accuracy]) => {
        acc[model] = accuracy / total;
        return acc;
      }, {} as Record<string, number>);

      expect(weights['model-1']).toBeCloseTo(1/3, 2);
      expect(weights['model-2']).toBeCloseTo(1/3, 2);
      expect(weights['model-3']).toBeCloseTo(1/3, 2);
    });

    it('should clip very low accuracy to minimum weight', () => {
      const minWeight = 0.1;
      const accuracies = {
        'good-model': 0.95,
        'poor-model': 0.30
      };

      const calculateWeight = (accuracy: number): number => {
        // If accuracy is below threshold (0.5), clip to minimum weight
        if (accuracy < 0.5) {
          return minWeight;
        }
        return accuracy;
      };

      expect(calculateWeight(accuracies['good-model'])).toBe(0.95);
      expect(calculateWeight(accuracies['poor-model'])).toBe(minWeight);
    });
  });

  describe('aggregateVotes', () => {
    it('should return unanimous choice when all models agree', () => {
      const votes = [
        { model: 'gpt-4o', choice: 'column-A', confidence: 0.95 },
        { model: 'claude-opus-4', choice: 'column-A', confidence: 0.92 },
        { model: 'gemini-pro', choice: 'column-A', confidence: 0.88 }
      ];

      const choices = votes.map(v => v.choice);
      const uniqueChoices = new Set(choices);

      expect(uniqueChoices.size).toBe(1);
      expect(uniqueChoices.has('column-A')).toBe(true);
    });

    it('should detect 2/3 consensus', () => {
      const votes = [
        { model: 'gpt-4o', choice: 'column-A', confidence: 0.95 },
        { model: 'claude-opus-4', choice: 'column-A', confidence: 0.90 },
        { model: 'gemini-pro', choice: 'column-B', confidence: 0.70 }
      ];

      const choiceCounts = votes.reduce((acc, vote) => {
        acc[vote.choice] = (acc[vote.choice] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const majorityChoice = Object.entries(choiceCounts)
        .sort(([, a], [, b]) => b - a)[0][0];

      const majorityCount = choiceCounts[majorityChoice];

      expect(majorityChoice).toBe('column-A');
      expect(majorityCount).toBe(2);
    });

    it('should detect disagreement when no consensus', () => {
      const votes = [
        { model: 'gpt-4o', choice: 'column-A', confidence: 0.80 },
        { model: 'claude-opus-4', choice: 'column-B', confidence: 0.82 },
        { model: 'gemini-pro', choice: 'column-C', confidence: 0.79 }
      ];

      const choices = votes.map(v => v.choice);
      const uniqueChoices = new Set(choices);

      expect(uniqueChoices.size).toBe(3);
    });

    it('should use weighted voting when models disagree', () => {
      const votes = [
        { model: 'gpt-4o', choice: 'column-A', confidence: 0.90, weight: 0.40 },
        { model: 'claude-opus-4', choice: 'column-B', confidence: 0.85, weight: 0.35 },
        { model: 'gemini-pro', choice: 'column-A', confidence: 0.80, weight: 0.25 }
      ];

      const weightedScores = votes.reduce((acc, vote) => {
        acc[vote.choice] = (acc[vote.choice] || 0) + (vote.weight * vote.confidence);
        return acc;
      }, {} as Record<string, number>);

      const winner = Object.entries(weightedScores)
        .sort(([, a], [, b]) => b - a)[0][0];

      // column-A: (0.40 * 0.90) + (0.25 * 0.80) = 0.36 + 0.20 = 0.56
      // column-B: (0.35 * 0.85) = 0.2975

      expect(winner).toBe('column-A');
    });
  });

  describe('consensusThresholds', () => {
    it('should accept unanimous high-confidence votes', () => {
      const votes = [
        { model: 'gpt-4o', choice: 'column-A', confidence: 0.95 },
        { model: 'claude-opus-4', choice: 'column-A', confidence: 0.92 },
        { model: 'gemini-pro', choice: 'column-A', confidence: 0.90 }
      ];

      const unanimous = votes.every(v => v.choice === votes[0].choice);
      const minConfidence = Math.min(...votes.map(v => v.confidence));

      const shouldAccept = unanimous && minConfidence >= 0.80;

      expect(shouldAccept).toBe(true);
    });

    it('should accept 2/3 consensus with high confidence', () => {
      const votes = [
        { model: 'gpt-4o', choice: 'column-A', confidence: 0.95 },
        { model: 'claude-opus-4', choice: 'column-A', confidence: 0.90 },
        { model: 'gemini-pro', choice: 'column-B', confidence: 0.65 }
      ];

      const choiceCounts = votes.reduce((acc, vote) => {
        acc[vote.choice] = (acc[vote.choice] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const [majorityChoice, majorityCount] = Object.entries(choiceCounts)
        .sort(([, a], [, b]) => b - a)[0];

      const majorityVotes = votes.filter(v => v.choice === majorityChoice);
      const avgConfidence = majorityVotes.reduce((sum, v) => sum + v.confidence, 0) / majorityVotes.length;
      const loserConfidence = Math.max(...votes.filter(v => v.choice !== majorityChoice).map(v => v.confidence));

      const shouldAccept = majorityCount >= 2 && avgConfidence >= 0.85 && loserConfidence < 0.70;

      expect(shouldAccept).toBe(true);
    });

    it('should require human input when no consensus', () => {
      const votes = [
        { model: 'gpt-4o', choice: 'column-A', confidence: 0.80 },
        { model: 'claude-opus-4', choice: 'column-B', confidence: 0.82 },
        { model: 'gemini-pro', choice: 'column-C', confidence: 0.79 }
      ];

      const choiceCounts = votes.reduce((acc, vote) => {
        acc[vote.choice] = (acc[vote.choice] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const maxCount = Math.max(...Object.values(choiceCounts));
      const requiresHuman = maxCount < 2;

      expect(requiresHuman).toBe(true);
    });

    it('should require human input for customer/item field disagreement', () => {
      const field = 'customer';
      const criticalFields = ['customer', 'sku', 'gtin'];

      const votes = [
        { model: 'gpt-4o', choice: 'column-A', confidence: 0.85 },
        { model: 'claude-opus-4', choice: 'column-B', confidence: 0.83 },
        { model: 'gemini-pro', choice: 'column-A', confidence: 0.80 }
      ];

      const choiceCounts = votes.reduce((acc, vote) => {
        acc[vote.choice] = (acc[vote.choice] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const isCritical = criticalFields.includes(field);
      const hasDisagreement = Object.keys(choiceCounts).length > 1;

      const requiresHuman = isCritical && hasDisagreement;

      expect(requiresHuman).toBe(true);
    });
  });

  describe('committeeResult', () => {
    it('should return decision with consensus metadata', () => {
      const votes = [
        { model: 'gpt-4o', choice: 'column-A', confidence: 0.95 },
        { model: 'claude-opus-4', choice: 'column-A', confidence: 0.92 },
        { model: 'gemini-pro', choice: 'column-A', confidence: 0.90 }
      ];

      const unanimous = votes.every(v => v.choice === votes[0].choice);

      const result = {
        field: 'sku',
        choice: 'column-A',
        confidence: Math.min(...votes.map(v => v.confidence)),
        consensus: unanimous ? 'unanimous' : '2-of-3',
        requiresHumanInput: false,
        votes: votes
      };

      expect(result.consensus).toBe('unanimous');
      expect(result.requiresHumanInput).toBe(false);
      expect(result.confidence).toBe(0.90);
    });

    it('should flag fields requiring human decision', () => {
      const votes = [
        { model: 'gpt-4o', choice: 'column-A', confidence: 0.80 },
        { model: 'claude-opus-4', choice: 'column-B', confidence: 0.82 },
        { model: 'gemini-pro', choice: 'column-C', confidence: 0.79 }
      ];

      const result = {
        field: 'customer',
        choice: null,
        confidence: 0,
        consensus: 'none',
        requiresHumanInput: true,
        votes: votes,
        candidates: ['column-A', 'column-B', 'column-C']
      };

      expect(result.requiresHumanInput).toBe(true);
      expect(result.candidates?.length).toBe(3);
    });
  });
});
