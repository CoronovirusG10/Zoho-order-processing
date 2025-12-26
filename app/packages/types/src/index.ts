/**
 * @order-processing/types
 *
 * Shared TypeScript type definitions
 */

// Export JSON schemas as const for type inference
export { default as CanonicalSalesOrderSchema } from './schemas/canonical-sales-order.schema.json';
export { default as OrderProcessingEventSchema } from './schemas/order-processing-event.schema.json';

// Export enums
export * from './enums.js';

// Export type definitions
export * from './evidence.js';
export * from './teams.js';
export * from './committee.js';
export * from './zoho.js';
export * from './canonical-order.js';
export * from './events.js';
