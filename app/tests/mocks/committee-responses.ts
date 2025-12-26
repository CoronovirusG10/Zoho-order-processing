/**
 * Mock committee responses for testing
 */

export interface MockCommitteeVote {
  provider: string;
  choice: string;
  confidence: number;
  reasoning?: string;
}

export interface MockCommitteeResult {
  field: string;
  votes: MockCommitteeVote[];
  consensus: 'unanimous' | '2-of-3' | 'none';
  finalChoice: string | null;
  requiresHuman: boolean;
}

// Unanimous agreement scenarios
export const unanimousHighConfidence: MockCommitteeResult = {
  field: 'sku',
  votes: [
    { provider: 'gpt-4o', choice: 'col-A', confidence: 0.95, reasoning: 'Header "SKU" matches perfectly' },
    { provider: 'claude-opus-4', choice: 'col-A', confidence: 0.92, reasoning: 'Column contains SKU-like patterns' },
    { provider: 'gemini-pro', choice: 'col-A', confidence: 0.90, reasoning: 'Sample values match SKU format' }
  ],
  consensus: 'unanimous',
  finalChoice: 'col-A',
  requiresHuman: false
};

export const unanimousLowConfidence: MockCommitteeResult = {
  field: 'description',
  votes: [
    { provider: 'gpt-4o', choice: 'col-B', confidence: 0.70 },
    { provider: 'claude-opus-4', choice: 'col-B', confidence: 0.68 },
    { provider: 'gemini-pro', choice: 'col-B', confidence: 0.65 }
  ],
  consensus: 'unanimous',
  finalChoice: 'col-B',
  requiresHuman: true // Low confidence threshold
};

// 2-of-3 consensus scenarios
export const twoOfThreeConsensus: MockCommitteeResult = {
  field: 'quantity',
  votes: [
    { provider: 'gpt-4o', choice: 'col-C', confidence: 0.90 },
    { provider: 'claude-opus-4', choice: 'col-C', confidence: 0.88 },
    { provider: 'gemini-pro', choice: 'col-D', confidence: 0.75 }
  ],
  consensus: '2-of-3',
  finalChoice: 'col-C',
  requiresHuman: false
};

export const twoOfThreeWithHighMinorityConfidence: MockCommitteeResult = {
  field: 'customer',
  votes: [
    { provider: 'gpt-4o', choice: 'col-A', confidence: 0.85 },
    { provider: 'claude-opus-4', choice: 'col-A', confidence: 0.83 },
    { provider: 'gemini-pro', choice: 'col-B', confidence: 0.88 }
  ],
  consensus: '2-of-3',
  finalChoice: null,
  requiresHuman: true // Minority has higher confidence
};

// Complete disagreement scenarios
export const completeDisagreement: MockCommitteeResult = {
  field: 'customer',
  votes: [
    { provider: 'gpt-4o', choice: 'col-A', confidence: 0.80 },
    { provider: 'claude-opus-4', choice: 'col-B', confidence: 0.82 },
    { provider: 'gemini-pro', choice: 'col-C', confidence: 0.79 }
  ],
  consensus: 'none',
  finalChoice: null,
  requiresHuman: true
};

// Critical field disagreement (always requires human)
export const criticalFieldDisagreement: MockCommitteeResult = {
  field: 'customer',
  votes: [
    { provider: 'gpt-4o', choice: 'col-A', confidence: 0.92 },
    { provider: 'claude-opus-4', choice: 'col-B', confidence: 0.90 },
    { provider: 'gemini-pro', choice: 'col-A', confidence: 0.88 }
  ],
  consensus: '2-of-3',
  finalChoice: null,
  requiresHuman: true // Critical field + any disagreement = human required
};

// Provider error scenarios
export const providerTimeout: MockCommitteeResult = {
  field: 'sku',
  votes: [
    { provider: 'gpt-4o', choice: 'col-A', confidence: 0.95 },
    { provider: 'claude-opus-4', choice: 'col-A', confidence: 0.92 }
    // gemini-pro timed out
  ],
  consensus: 'unanimous',
  finalChoice: 'col-A',
  requiresHuman: false // Can proceed with 2/3 if unanimous
};

export const allProvidersTimeout: MockCommitteeResult = {
  field: 'sku',
  votes: [],
  consensus: 'none',
  finalChoice: null,
  requiresHuman: true
};

// Multilingual scenarios
export const farsiHeaderMapping: MockCommitteeResult = {
  field: 'sku',
  votes: [
    { provider: 'gpt-4o', choice: 'col-A', confidence: 0.93, reasoning: 'Farsi header "کد کالا" means "product code"' },
    { provider: 'claude-opus-4', choice: 'col-A', confidence: 0.91, reasoning: 'Persian text matches SKU concept' },
    { provider: 'gemini-pro', choice: 'col-A', confidence: 0.89, reasoning: 'Header translation indicates SKU field' }
  ],
  consensus: 'unanimous',
  finalChoice: 'col-A',
  requiresHuman: false
};

// Weighted voting scenarios
export const weightedVotingExample = {
  field: 'quantity',
  votes: [
    { provider: 'gpt-4o', choice: 'col-C', confidence: 0.90, weight: 0.40 },
    { provider: 'claude-opus-4', choice: 'col-D', confidence: 0.85, weight: 0.35 },
    { provider: 'gemini-pro', choice: 'col-C', confidence: 0.80, weight: 0.25 }
  ],
  weightedScores: {
    'col-C': (0.90 * 0.40) + (0.80 * 0.25), // = 0.56
    'col-D': (0.85 * 0.35) // = 0.2975
  },
  finalChoice: 'col-C',
  consensus: '2-of-3',
  requiresHuman: false
};

// Calibration data for weight calculation
export const mockCalibrationData = {
  'gpt-4o': {
    accuracy: 0.92,
    fieldsCorrect: 46,
    fieldsTotal: 50,
    lastCalibrated: '2025-12-20T00:00:00Z'
  },
  'claude-opus-4': {
    accuracy: 0.88,
    fieldsCorrect: 44,
    fieldsTotal: 50,
    lastCalibrated: '2025-12-20T00:00:00Z'
  },
  'gemini-pro': {
    accuracy: 0.85,
    fieldsCorrect: 42,
    fieldsTotal: 50,
    lastCalibrated: '2025-12-20T00:00:00Z'
  }
};

export function calculateMockWeights(calibrationData: typeof mockCalibrationData): Record<string, number> {
  const total = Object.values(calibrationData).reduce((sum, data) => sum + data.accuracy, 0);

  return Object.entries(calibrationData).reduce((weights, [provider, data]) => {
    weights[provider] = data.accuracy / total;
    return weights;
  }, {} as Record<string, number>);
}

export const mockWeights = calculateMockWeights(mockCalibrationData);
// Expected result:
// {
//   'gpt-4o': ~0.35,
//   'claude-opus-4': ~0.33,
//   'gemini-pro': ~0.32
// }
