export type ID = string;

export type ObligationStatus = "draft" | "due" | "overdue" | "lodged" | "reconciled";
export type ObligationType = "BAS" | "PAYGW" | "IAS" | "PAYGI" | "STP" | "FBT";

export interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  done: boolean;
}

export interface Obligation {
  id: ID;
  type: ObligationType;
  label: string;
  periodLabel: string;
  dueDate: string; // ISO
  status: ObligationStatus;
  amountDue?: number;
  checklist: ChecklistItem[];
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: ID;
  title: string;
  message: string;
  severity: AlertSeverity;
  createdAt: string;
  dismissed?: boolean;
  relatedObligationId?: ID;
}

export type EvidencePackStatus = "draft" | "ready" | "exported";

export interface EvidencePack {
  id: ID;
  title: string;
  periodLabel: string;
  createdAt: string;
  status: EvidencePackStatus;
  manifestHash: string;
  itemCount: number;
  verifiedAt?: string;
}

export type ConnectorType = "bank" | "payroll" | "pos" | "accounting" | "other";
export type ConnectorStatus =
  | "disconnected"
  | "connected"
  | "syncing"
  | "error"
  | "pending";

export interface Connector {
  id: ID;
  name: string;
  type: ConnectorType;
  status: ConnectorStatus;
  lastSyncAt?: string;
  errorMessage?: string;
}

export interface OrganizationFunds {
  reserveBalance: number;
  taxBalance: number;
}

export interface Organization {
  id: ID;
  name: string;
  abn?: string;
  funds?: OrganizationFunds;
}

export interface Period {
  id: ID;
  label: string;
  startDate: string;
  endDate: string;
}

export type IncidentStatus = "open" | "investigating" | "contained" | "resolved";

export interface IncidentNote {
  id: string;
  note: string;
  createdAt: string;
  createdBy: string;
  // UI-friendly aliases (some pages use these names)
  author?: string;
  timestamp?: string;
  content?: string;
}

export interface Incident {
  id: ID;
  title: string;
  category?: string;
  reportedBy?: string;
  relatedObligationId?: string;
  relatedAlertId?: string;
  resolution?: string;
  notes?: IncidentNote[];
  status: IncidentStatus;
  severity: AlertSeverity;
  createdAt: string;
  resolvedAt?: string;
  timeline: IncidentNote[];
}

export type AuditEventType =
  | "create_obligation"
  | "update_obligation"
  | "lodge_obligation"
  | "reconcile_obligation"
  | "create_alert"
  | "dismiss_alert"
  | "create_evidence"
  | "export_evidence"
  | "verify"
  | "allocate";

export interface AuditEvent {
  id: ID;
  type: AuditEventType;
  at: string;
  actor: string;
  message: string;
  meta?: Record<string, unknown>;
}

export type FundingRequestPriority = "low" | "medium" | "high";
export type FundingRequestStatus = "pending" | "approved" | "allocated" | "rejected";

export interface FundingRequest {
  id: string;
  title: string;
  amount: number;
  requiredBy: string; // ISO date
  obligationId?: string;
  priority: FundingRequestPriority;
  justification?: string;
  status: FundingRequestStatus;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  allocatedBy?: string;
  allocatedAt?: string;
  fundingSourceId?: string;
}

export type FundingSourceType = "bank" | "credit" | "internal" | "other";

export interface FundingSource {
  id: string;
  name: string;
  type: FundingSourceType;
  balance: number;
  limit?: number;
  interestRate?: number;
  description?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
