/**
 * Excel Parser for Sales Orders
 * Main entry point
 *
 * Deterministic Excel parsing with evidence tracking.
 * Outputs canonical JSON per SOLUTION_DESIGN.md section 4.8
 */

import { Workbook } from 'exceljs';
import { parseExcel } from './parser';
import { ParserOptions, ParserConfig, DEFAULT_PARSER_CONFIG, CanonicalSalesOrder } from './types';

export { parseExcel } from './parser';
export * from './types';
export * from './formula-detector';
export * from './sheet-selector';
export * from './header-detector';
export * from './schema-inference';
export * from './row-extractor';
export * from './normalizer';
export * from './validator';

/**
 * Parse an Excel file from a file path
 */
export async function parseExcelFile(
  filePath: string,
  options: ParserOptions
): Promise<CanonicalSalesOrder> {
  const workbook = new Workbook();
  await workbook.xlsx.readFile(filePath);

  return parseExcel(workbook, options);
}

/**
 * Parse an Excel file from a buffer
 */
export async function parseExcelBuffer(
  buffer: Buffer | ArrayBuffer,
  options: ParserOptions
): Promise<CanonicalSalesOrder> {
  const workbook = new Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);

  return parseExcel(workbook, options);
}

/**
 * Parse an Excel file from a stream
 */
export async function parseExcelStream(
  stream: NodeJS.ReadableStream | ReadableStream,
  options: ParserOptions
): Promise<CanonicalSalesOrder> {
  const workbook = new Workbook();
  // exceljs expects a Node.js Stream, so we cast here
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.read(stream as any);

  return parseExcel(workbook, options);
}

export default {
  parseExcel,
  parseExcelFile,
  parseExcelBuffer,
  parseExcelStream
};
