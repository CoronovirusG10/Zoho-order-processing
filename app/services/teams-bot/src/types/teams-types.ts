/**
 * Teams-specific type definitions for the bot service
 */

export interface TeamsAttachment {
  contentType: string;
  contentUrl?: string;
  content?: {
    downloadUrl?: string;
    uniqueId?: string;
    fileType?: string;
  };
  name?: string;
  thumbnailUrl?: string;
}

export interface TeamsTenantInfo {
  id: string;
}

export interface TeamsChannelData {
  tenant?: TeamsTenantInfo;
  teamsTeamId?: string;
  teamsChannelId?: string;
  channel?: {
    id: string;
  };
  team?: {
    id: string;
  };
  eventType?: string;
  meeting?: {
    id: string;
  };
}

export interface CaseMetadata {
  caseId: string;
  tenantId: string;
  userId: string;
  conversationId: string;
  activityId: string;
  fileName: string;
  fileSha256?: string;
  blobUri?: string;
  correlationId: string;
}

export interface AdaptiveCardAction {
  action:
    | 'submit_corrections'
    | 'request_reupload'
    | 'approve_create'
    | 'request_changes'
    | 'select_customer'
    | 'select_item'
    | 'submit_item_selections'
    | 'skip_item'
    | 'cancel_selection'
    | 'confirm_cancel'
    | 'dismiss';
  caseId: string;
  userNotes?: string;
  // Selection-related fields
  tenantId?: string;
  workflowId?: string;
  lineRow?: number;
  selectionType?: 'customer' | 'items';
}

export interface BlobUploadResult {
  blobUri: string;
  sha256: string;
  contentType: string;
  size: number;
}

export interface ProcessingStatus {
  caseId: string;
  status: 'uploading' | 'processing' | 'needs_input' | 'ready' | 'creating' | 'completed' | 'failed';
  message?: string;
  correlationId: string;
  timestamp: Date;
}

export interface IssueItem {
  code: string;
  severity: 'info' | 'warning' | 'error' | 'blocker';
  message: string;
  messageEn: string;
  messageFa?: string;
  fields?: string[];
  suggestedUserAction?: string;
}

export interface OrderReview {
  caseId: string;
  customerName: string;
  lineItemCount: number;
  totalSource: string;
  totalZoho: string;
  warnings: string[];
}

export interface ZohoCreationResult {
  salesorderId: string;
  salesorderNumber: string;
  status: string;
  url: string;
}
