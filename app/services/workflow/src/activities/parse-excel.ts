/**
 * Parse Excel Activity (Temporal)
 *
 * Downloads Excel file from Azure Blob Storage and parses it using the
 * @order-processing/parser service. Builds evidence pack for AI committee review.
 *
 * Handles blocking scenarios:
 * - Formulas detected (strict policy by default)
 * - Protected worksheets
 * - Empty or invalid files
 * - Multiple viable sheets (ambiguous)
 */

import { log } from '@temporalio/activity';
import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';
import { createHash } from 'crypto';

// Import parser service
import {
  parseExcelBuffer,
  CanonicalSalesOrder,
  Issue,
} from '@order-processing/parser';

// Import evidence pack builder and types from committee
import { buildEvidencePack } from '@order-processing/committee';
import type { EvidencePack, ColumnData } from '@order-processing/committee';

// Input/Output interfaces
export interface ParseExcelInput {
  caseId: string;
  blobUrl?: string; // Full blob URL (optional - can construct from caseId)
  filename?: string; // Original filename
  tenantId?: string;
}

export interface ParseIssue {
  code: string;
  severity: 'info' | 'warning' | 'error' | 'blocker';
  message: string;
  fields?: string[];
  suggestedAction?: string;
}

export interface ParseExcelOutput {
  success: boolean;
  blocked: boolean;
  blockReason?: 'formulas' | 'protected' | 'multi_sheet' | 'empty' | 'no_header' | 'parse_error';
  containsFormulas?: boolean;
  canonicalData?: CanonicalSalesOrder;
  evidencePack?: EvidencePack;
  issues: ParseIssue[];
  metadata?: {
    rowCount: number;
    columnCount: number;
    sheetsProcessed: string[];
    detectedLanguage: string;
    fileSha256: string;
    parserVersion: string;
  };
}

/**
 * Parses an Excel file and extracts structured data
 * @param input - The input containing caseId and optional blobUrl
 * @returns Parse result with canonical data or blocking information
 */
export async function parseExcel(input: ParseExcelInput): Promise<ParseExcelOutput> {
  const { caseId, blobUrl, filename, tenantId } = input;

  log.info('Starting Excel parsing', { caseId, blobUrl, filename });

  try {
    // Get blob storage configuration
    const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
    if (!accountName) {
      throw new Error('AZURE_STORAGE_ACCOUNT_NAME not configured');
    }

    const credential = new DefaultAzureCredential();
    const blobServiceClient = new BlobServiceClient(
      `https://${accountName}.blob.core.windows.net`,
      credential
    );

    // Determine blob path
    let containerName: string;
    let blobPath: string;

    if (blobUrl) {
      // Parse the provided blob URL
      const url = new URL(blobUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      containerName = pathParts[0];
      blobPath = pathParts.slice(1).join('/');
    } else {
      // Construct from caseId using convention
      containerName = process.env.AZURE_STORAGE_CONTAINER_INCOMING || 'orders-incoming';
      blobPath = `${caseId}/original.xlsx`;
    }

    log.info('Downloading blob', { caseId, containerName, blobPath });

    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blobClient = containerClient.getBlobClient(blobPath);

    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      log.error('Blob not found', { caseId, blobPath });
      return {
        success: false,
        blocked: true,
        blockReason: 'empty',
        issues: [{
          code: 'FILE_NOT_FOUND',
          severity: 'blocker',
          message: `Excel file not found at ${blobPath}`,
          suggestedAction: 'Please upload the file again',
        }],
      };
    }

    // Download blob to buffer
    const downloadResponse = await blobClient.download();
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to get readable stream from blob');
    }

    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // Calculate SHA-256 hash
    const fileSha256 = createHash('sha256').update(buffer).digest('hex');

    log.info('Blob downloaded', {
      caseId,
      sizeBytes: buffer.length,
      sha256: fileSha256.substring(0, 16) + '...',
    });

    // Parse using the parser service
    const parserResult = await parseExcelBuffer(buffer, {
      caseId,
      filename: filename || 'original.xlsx',
      fileSha256,
      tenantId,
      config: {
        formulaPolicy: 'strict', // Block formulas by default
      },
    });

    // Convert parser issues to activity issues
    const issues = convertIssues(parserResult.issues);

    // Check for blocker issues
    const hasBlocker = issues.some(i => i.severity === 'blocker');
    if (hasBlocker) {
      const blockReason = determineBlockReason(parserResult.issues);

      log.warn('Parsing blocked', {
        caseId,
        blockReason,
        issueCount: issues.length,
      });

      return {
        success: false,
        blocked: true,
        blockReason,
        containsFormulas: parserResult.meta.parsing?.contains_formulas ?? false,
        issues,
      };
    }

    // Build evidence pack for committee
    const evidencePack = buildEvidencePackFromCanonical(caseId, parserResult);

    // Calculate metadata
    const metadata = {
      rowCount: parserResult.line_items.length,
      columnCount: parserResult.schema_inference?.column_mappings?.length ?? 0,
      sheetsProcessed: parserResult.meta.parsing?.sheets_processed ?? [],
      detectedLanguage: parserResult.meta.language_hint ?? 'unknown',
      fileSha256,
      parserVersion: parserResult.meta.parsing?.parser_version ?? 'unknown',
    };

    log.info('Excel parsed successfully', {
      caseId,
      ...metadata,
      confidence: parserResult.confidence.overall,
    });

    return {
      success: true,
      blocked: false,
      containsFormulas: parserResult.meta.parsing?.contains_formulas ?? false,
      canonicalData: parserResult,
      evidencePack,
      issues,
      metadata,
    };
  } catch (error) {
    log.error('Failed to parse Excel', {
      caseId,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      success: false,
      blocked: true,
      blockReason: 'parse_error',
      issues: [{
        code: 'PARSE_ERROR',
        severity: 'blocker',
        message: `Failed to parse Excel file: ${error instanceof Error ? error.message : String(error)}`,
        suggestedAction: 'Please ensure the file is a valid Excel file (.xlsx)',
      }],
    };
  }
}

/**
 * Convert parser issues to activity issues
 */
function convertIssues(parserIssues: Issue[]): ParseIssue[] {
  return parserIssues.map(issue => ({
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    fields: issue.fields,
    suggestedAction: issue.suggested_user_action ?? undefined,
  }));
}

/**
 * Determine the block reason from issues
 */
function determineBlockReason(
  issues: Issue[]
): 'formulas' | 'protected' | 'multi_sheet' | 'empty' | 'no_header' | 'parse_error' {
  for (const issue of issues) {
    if (issue.code === 'FORMULAS_BLOCKED') return 'formulas';
    if (issue.code === 'PROTECTED_WORKBOOK' || issue.code === 'PROTECTED_SHEET') return 'protected';
    if (issue.code === 'MULTIPLE_SHEET_CANDIDATES') return 'multi_sheet';
    if (issue.code === 'NO_SUITABLE_SHEET' || issue.code === 'EMPTY_FILE') return 'empty';
    if (issue.code === 'NO_HEADER_ROW') return 'no_header';
  }
  return 'parse_error';
}

/**
 * Build evidence pack from canonical sales order for committee review
 */
function buildEvidencePackFromCanonical(
  caseId: string,
  order: CanonicalSalesOrder
): EvidencePack {
  const columns: ColumnData[] = [];

  // Build column data from schema inference
  if (order.schema_inference?.column_mappings) {
    for (const mapping of order.schema_inference.column_mappings) {
      const header = mapping.source_header;

      // Extract sample values from line items
      const values: string[] = [];
      const fieldName = mapping.canonical_field;

      for (const item of order.line_items.slice(0, 10)) {
        let value: unknown;

        switch (fieldName) {
          case 'sku':
            value = item.sku;
            break;
          case 'gtin':
            value = item.gtin;
            break;
          case 'product_name':
            value = item.product_name;
            break;
          case 'quantity':
            value = item.quantity;
            break;
          case 'unit_price':
            value = item.unit_price_source;
            break;
          case 'line_total':
            value = item.line_total_source;
            break;
          default:
            value = null;
        }

        if (value !== null && value !== undefined) {
          values.push(String(value));
        }
      }

      columns.push({
        header,
        values,
      });
    }
  }

  // Use the buildEvidencePack utility
  const evidencePack = buildEvidencePack(caseId, columns);

  // Add metadata
  evidencePack.metadata = {
    sourceFileName: order.meta.source_filename,
    totalRows: order.line_items.length,
    totalColumns: columns.length,
    hasFormulas: order.meta.parsing?.contains_formulas ?? false,
  };

  return evidencePack;
}
