/**
 * Tests for card builder utilities
 */

import { describe, it, expect } from 'vitest';
import { replaceVariables, buildCard } from '../card-builder.js';

describe('Card Builder', () => {
  describe('replaceVariables', () => {
    it('should replace single variable', () => {
      const template = 'Hello ${name}!';
      const result = replaceVariables(template, { name: 'World' });
      expect(result).toBe('Hello World!');
    });

    it('should replace multiple variables', () => {
      const template = '${greeting} ${name}!';
      const result = replaceVariables(template, {
        greeting: 'Hello',
        name: 'World',
      });
      expect(result).toBe('Hello World!');
    });

    it('should replace multiple occurrences', () => {
      const template = '${x} + ${x} = ${y}';
      const result = replaceVariables(template, { x: '2', y: '4' });
      expect(result).toBe('2 + 2 = 4');
    });

    it('should handle missing variables', () => {
      const template = 'Hello ${name}!';
      const result = replaceVariables(template, {});
      expect(result).toBe('Hello ${name}!');
    });
  });

  describe('buildCard', () => {
    it('should build card from template', () => {
      const template = {
        type: 'AdaptiveCard',
        body: [
          {
            type: 'TextBlock',
            text: 'Case: ${caseId}',
          },
        ],
      };

      const result = buildCard(template, { caseId: 'ABC-123' });

      expect(result.type).toBe('AdaptiveCard');
      expect(result.body[0].text).toBe('Case: ABC-123');
    });

    it('should handle nested properties', () => {
      const template = {
        type: 'AdaptiveCard',
        body: [
          {
            type: 'FactSet',
            facts: [
              {
                title: 'Customer',
                value: '${customer}',
              },
              {
                title: 'Total',
                value: '${total}',
              },
            ],
          },
        ],
      };

      const result = buildCard(template, {
        customer: 'ACME Corp',
        total: '$1,234.56',
      });

      expect(result.body[0].facts[0].value).toBe('ACME Corp');
      expect(result.body[0].facts[1].value).toBe('$1,234.56');
    });
  });
});
