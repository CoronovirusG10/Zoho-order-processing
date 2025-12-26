/**
 * Mock Teams Bot Adapter for E2E tests
 * Simulates Teams bot interactions without real Teams API calls
 */

export interface MockTeamsMessage {
  id: string;
  text: string;
  from: {
    id: string;
    name: string;
    aadObjectId: string;
  };
  conversation: {
    id: string;
    tenantId: string;
  };
  attachments?: Array<{
    name: string;
    contentType: string;
    contentUrl: string;
  }>;
}

export class MockTeamsBotAdapter {
  private sentMessages: any[] = [];
  private sentCards: any[] = [];

  async sendMessage(conversationId: string, message: string | any): Promise<void> {
    this.sentMessages.push({
      conversationId,
      message,
      timestamp: new Date().toISOString()
    });
  }

  async sendAdaptiveCard(conversationId: string, card: any): Promise<void> {
    this.sentCards.push({
      conversationId,
      card,
      timestamp: new Date().toISOString()
    });
  }

  async updateMessage(conversationId: string, messageId: string, newMessage: any): Promise<void> {
    const messageIndex = this.sentMessages.findIndex(
      m => m.conversationId === conversationId
    );
    if (messageIndex >= 0) {
      this.sentMessages[messageIndex] = {
        ...this.sentMessages[messageIndex],
        message: newMessage,
        updated: true,
        updatedAt: new Date().toISOString()
      };
    }
  }

  getSentMessages(): any[] {
    return [...this.sentMessages];
  }

  getSentCards(): any[] {
    return [...this.sentCards];
  }

  getLastMessage(): any {
    return this.sentMessages[this.sentMessages.length - 1];
  }

  getLastCard(): any {
    return this.sentCards[this.sentCards.length - 1];
  }

  clear(): void {
    this.sentMessages = [];
    this.sentCards = [];
  }

  // Simulate file upload from Teams
  createMockFileUpload(fileName: string, fileContent: Buffer): MockTeamsMessage {
    return {
      id: `msg-${Date.now()}`,
      text: '',
      from: {
        id: 'user-123',
        name: 'Test User',
        aadObjectId: 'aad-user-123'
      },
      conversation: {
        id: 'conv-123',
        tenantId: 'tenant-b'
      },
      attachments: [
        {
          name: fileName,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          contentUrl: `mock://files/${fileName}`
        }
      ]
    };
  }

  // Simulate user card submission
  createMockCardSubmission(caseId: string, action: string, data: any = {}): any {
    return {
      type: 'message',
      value: {
        caseId,
        action,
        ...data
      },
      from: {
        id: 'user-123',
        aadObjectId: 'aad-user-123'
      },
      conversation: {
        id: 'conv-123'
      }
    };
  }
}

// Mock Teams file download
export async function mockTeamsFileDownload(contentUrl: string): Promise<Buffer> {
  // In real tests, this would return test file content
  return Buffer.from('mock file content');
}

// Mock adaptive card templates
export const mockAdaptiveCards = {
  processingCard: (correlationId: string) => ({
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: 'Processing your order...',
        weight: 'Bolder',
        size: 'Medium'
      },
      {
        type: 'TextBlock',
        text: `Correlation ID: ${correlationId}`,
        isSubtle: true
      }
    ]
  }),

  summaryCard: (data: any) => ({
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: 'Order Summary',
        weight: 'Bolder',
        size: 'Large'
      },
      {
        type: 'FactSet',
        facts: [
          { title: 'Customer', value: data.customer },
          { title: 'Lines', value: data.lineCount.toString() },
          { title: 'Total', value: data.total.toFixed(2) }
        ]
      }
    ],
    actions: [
      {
        type: 'Action.Submit',
        title: 'Create Draft Sales Order',
        data: { action: 'create-draft', caseId: data.caseId }
      }
    ]
  }),

  issuesCard: (issues: any[]) => ({
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: 'Issues Found',
        weight: 'Bolder',
        size: 'Large',
        color: 'Warning'
      },
      ...issues.map(issue => ({
        type: 'Container',
        items: [
          {
            type: 'TextBlock',
            text: issue.message,
            wrap: true
          }
        ]
      }))
    ]
  })
};
