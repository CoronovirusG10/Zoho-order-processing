/**
 * Mock AI Provider responses for E2E tests
 * Simulates GPT-4, Claude, and Gemini responses
 */

export interface MockProviderConfig {
  provider: 'gpt-4o' | 'claude-opus-4' | 'gemini-pro';
  accuracyProfile?: 'high' | 'medium' | 'low';
}

export class MockProviderService {
  private callHistory: any[] = [];

  async generateMapping(provider: string, evidencePack: any, config: MockProviderConfig = { provider: 'gpt-4o' }): Promise<any> {
    const { field, candidates } = evidencePack;

    // Record call for audit
    this.callHistory.push({
      provider,
      field,
      candidateCount: candidates.length,
      timestamp: new Date().toISOString()
    });

    // Mock response based on provider and accuracy profile
    const accuracyProfile = config.accuracyProfile || 'high';
    const baseConfidence = accuracyProfile === 'high' ? 0.92 :
                          accuracyProfile === 'medium' ? 0.85 : 0.75;

    // Simulate intelligent column selection
    const choice = this.selectBestCandidate(field, candidates);
    const confidence = baseConfidence + (Math.random() * 0.05 - 0.025); // Small variance

    return {
      provider,
      field,
      choice: choice.id,
      confidence: Math.min(0.99, Math.max(0.60, confidence)),
      reasoning: `Selected "${choice.header}" based on header similarity and sample values`
    };
  }

  private selectBestCandidate(field: string, candidates: any[]): any {
    // Mock logic to select most likely candidate
    // In real implementation, this simulates LLM reasoning

    const fieldKeywords: Record<string, string[]> = {
      sku: ['sku', 'item code', 'product code', 'کد کالا', 'code'],
      quantity: ['qty', 'quantity', 'amount', 'تعداد', 'مقدار'],
      customer: ['customer', 'client', 'مشتری', 'شرکت'],
      price: ['price', 'rate', 'unit price', 'قیمت'],
      total: ['total', 'amount', 'جمع', 'sum']
    };

    const keywords = fieldKeywords[field] || [];

    // Find candidate with best keyword match
    for (const keyword of keywords) {
      const match = candidates.find(c =>
        c.header.toLowerCase().includes(keyword.toLowerCase())
      );
      if (match) return match;
    }

    // Fallback to first candidate
    return candidates[0];
  }

  getCallHistory(): any[] {
    return [...this.callHistory];
  }

  clear(): void {
    this.callHistory = [];
  }
}

// Pre-defined mock responses for common scenarios
export const mockProviderResponses = {
  unanimousMapping: {
    'gpt-4o': { choice: 'col-A', confidence: 0.95 },
    'claude-opus-4': { choice: 'col-A', confidence: 0.92 },
    'gemini-pro': { choice: 'col-A', confidence: 0.90 }
  },

  twoOfThreeConsensus: {
    'gpt-4o': { choice: 'col-A', confidence: 0.90 },
    'claude-opus-4': { choice: 'col-A', confidence: 0.88 },
    'gemini-pro': { choice: 'col-B', confidence: 0.75 }
  },

  completeDisagreement: {
    'gpt-4o': { choice: 'col-A', confidence: 0.80 },
    'claude-opus-4': { choice: 'col-B', confidence: 0.82 },
    'gemini-pro': { choice: 'col-C', confidence: 0.79 }
  },

  lowConfidence: {
    'gpt-4o': { choice: 'col-A', confidence: 0.65 },
    'claude-opus-4': { choice: 'col-A', confidence: 0.62 },
    'gemini-pro': { choice: 'col-A', confidence: 0.68 }
  }
};

// Mock provider timeout/error simulation
export class MockProviderError extends Error {
  constructor(
    public provider: string,
    public errorType: 'timeout' | 'rate_limit' | 'api_error',
    message?: string
  ) {
    super(message || `Mock ${errorType} error for ${provider}`);
    this.name = 'MockProviderError';
  }
}

export function simulateProviderError(provider: string, errorType: 'timeout' | 'rate_limit' | 'api_error'): never {
  throw new MockProviderError(provider, errorType);
}

// Mock provider latency simulation
export async function simulateProviderLatency(provider: string, ms: number = 1000): Promise<void> {
  const latencies = {
    'gpt-4o': 1200,
    'claude-opus-4': 980,
    'gemini-pro': 1500
  };

  const delay = ms || latencies[provider as keyof typeof latencies] || 1000;
  await new Promise(resolve => setTimeout(resolve, delay));
}
