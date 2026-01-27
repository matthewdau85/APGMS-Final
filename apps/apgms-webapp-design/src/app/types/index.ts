// Core domain types for APGMS

export type UserRole = 'Operator' | 'Admin' | 'Auditor' | 'Regulator';

export type ObligationType = 'PAYGW' | 'GST' | 'BAS' | 'SG';

export type ObligationStatus =
  | 'draft'
  | 'pending'
  | 'active'
  | 'completed'
  | 'overdue'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'critical';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertStatus = 'open' | 'acknowledged' | 'resolved';

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';

export type PackStatus = 'draft' | 'generating' | 'ready' | 'verified' | 'archived';

export type AuditEventType =
  | 'create'
  | 'update'
  | 'delete'
  | 'reconcile'
  | 'lodge'
  | 'approve'
  | 'reject'
  | 'verify';

export interface Organization {
  id: string;
  name: string;
  abn: string;
}

export interface Period {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
}

export interface Obligation {
  id: string;
  title: string;
  type: ObligationType;
  dueDate: string;
  status: ObligationStatus;
  amount: number;
  period: string;
  assignee: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  checklist?: ChecklistItem[];
  linkedTransactionIds?: string[];
  evidencePackId?: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  category: string;
  obligationId?: string;
  reconciled: boolean;
  organizationId: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  category: string;
  obligationId?: string;
  transactionId?: string;
  organizationId: string;
  createdBy: string;
}

export interface ReconciliationMatch {
  id: string;
  bankTransactionId: string;
  ledgerEntryId?: string;
  obligationId?: string;
  confidence: number;
  status: 'suggested' | 'approved' | 'rejected' | 'manual';
  matchedAt?: string;
  matchedBy?: string;
}

export interface EvidencePack {
  id: string;
  name: string;
  status: PackStatus;
  createdAt: string;
  generatedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  periodId: string;
  organizationId: string;
  obligationIds: string[];
  items: EvidenceItem[];
  hash?: string;
  checksum?: string;
}

export interface EvidenceItem {
  id: string;
  type: 'receipt' | 'statement' | 'report' | 'attestation' | 'reconciliation';
  name: string;
  description: string;
  generatedAt: string;
  size: number;
  hash: string;
}

export interface ControlPolicy {
  id: string;
  name: string;
  version: string;
  type: 'funding' | 'attestation' | 'approval' | 'reporting';
  description: string;
  content: string;
  publishedAt?: string;
  publishedBy?: string;
  effectiveDate: string;
  status: 'draft' | 'published' | 'archived';
  organizationId: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  owner: string;
  createdAt: string;
  resolvedAt?: string;
  impactedObligationIds: string[];
  organizationId: string;
  timeline: IncidentNote[];
}

export interface IncidentNote {
  id: string;
  note: string;
  createdAt: string;
  createdBy: string;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  createdAt: string;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  obligationId?: string;
  organizationId: string;
}

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  timestamp: string;
  changes?: Record<string, any>;
  description: string;
}

export interface BASReadiness {
  periodId: string;
  ready: boolean;
  blockers: string[];
  fundingStatus: {
    paygwCoverage: number;
    gstCoverage: number;
    sgCoverage: number;
  };
  obligationsSummary: {
    total: number;
    completed: number;
    pending: number;
    overdue: number;
  };
}

// Funding Module Types
export type FundingAccountType = 'PAYGW' | 'GST' | 'SG' | 'BAS';

export interface FundingAccount {
  id: string;
  name: string;
  type: FundingAccountType;
  balance: number;
  targetBalance: number;
  organizationId: string;
  createdAt: string;
  isOneWay: boolean; // Funds cannot be withdrawn except via ATO payment
}

export interface SweepRule {
  id: string;
  accountId: string;
  name: string;
  type: 'percentage_payroll' | 'percentage_sales' | 'fixed_weekly' | 'fixed_monthly';
  amount: number; // % or fixed amount
  frequency: 'weekly' | 'monthly' | 'on_transaction';
  active: boolean;
  createdAt: string;
  lastExecutedAt?: string;
}

export interface FundingTransaction {
  id: string;
  accountId: string;
  type: 'sweep_in' | 'ato_payment' | 'reversal' | 'adjustment';
  amount: number;
  description: string;
  createdAt: string;
  createdBy: string;
  obligationId?: string;
  reversalReason?: string; // Required for reversals
  incidentId?: string; // Required for reversals
}

// Connector Module Types
export type ConnectorCategory = 'Payroll' | 'Accounting' | 'POS' | 'Banking' | 'ATO';
export type ConnectorAuthMethod = 'oauth' | 'apiKey' | 'fileImport';
export type ConnectorStatus = 'disconnected' | 'connected' | 'error' | 'pending';
export type SyncStatus = 'idle' | 'running' | 'success' | 'failed';

export interface ConnectorProvider {
  id: string;
  name: string;
  category: ConnectorCategory;
  authMethod: ConnectorAuthMethod;
  logoUrl?: string;
  description: string;
}

export interface Connection {
  id: string;
  organizationId: string;
  providerId: string;
  status: ConnectorStatus;
  connectedAt?: string;
  lastSyncAt?: string;
  errorMessage?: string;
  scopes: string[];
  mapping: Record<string, string>; // source field -> APGMS field
  config: Record<string, any>; // Provider-specific config
}

export interface SyncJob {
  id: string;
  connectionId: string;
  status: SyncStatus;
  startedAt: string;
  finishedAt?: string;
  recordsProcessed: number;
  recordsCreated: number;
  recordsFailed: number;
  errorLog?: string[];
}

// Helper types
export interface ATOReference {
  title: string;
  url: string;
  description: string;
}

export interface HelpContent {
  title: string;
  purpose: string;
  requiredInputs: string[];
  definitions: Record<string, string>;
  commonMistakes: string[];
  outputs: string[];
  nextStep: string;
  atoReferences?: ATOReference[];
}