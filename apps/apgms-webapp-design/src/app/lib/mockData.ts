// Mock data generator for APGMS

import type {
  Organization,
  Period,
  Obligation,
  BankTransaction,
  LedgerEntry,
  EvidencePack,
  ControlPolicy,
  Incident,
  Alert,
  AuditEvent,
  BASReadiness,
} from '../types';

export function generateMockOrganizations(): Organization[] {
  return [
    { id: 'org-1', name: 'Acme Corporation Pty Ltd', abn: '12 345 678 901' },
    { id: 'org-2', name: 'Beta Industries Pty Ltd', abn: '23 456 789 012' },
    { id: 'org-3', name: 'Gamma Services Pty Ltd', abn: '34 567 890 123' },
  ];
}

export function generateMockPeriods(): Period[] {
  return [
    { id: 'p-202412', label: 'December 2025', startDate: '2025-12-01', endDate: '2025-12-31' },
    { id: 'p-202501', label: 'January 2026', startDate: '2026-01-01', endDate: '2026-01-31' },
    { id: 'p-202502', label: 'February 2026', startDate: '2026-02-01', endDate: '2026-02-28' },
    { id: 'p-q4-2025', label: 'Q4 2025', startDate: '2025-10-01', endDate: '2025-12-31' },
  ];
}

export function generateMockObligations(orgId: string): Obligation[] {
  return [
    {
      id: 'OBL-001',
      title: 'PAYGW Monthly Remittance - December 2025',
      type: 'PAYGW',
      dueDate: '2026-01-07',
      status: 'overdue',
      amount: 45230.50,
      period: 'December 2025',
      assignee: 'Operator',
      organizationId: orgId,
      createdAt: '2025-12-15T00:00:00Z',
      updatedAt: '2026-01-05T00:00:00Z',
      description: 'Monthly PAYGW withholding remittance for December 2025',
      checklist: [
        { id: 'c1', label: 'Verify payroll data', completed: true, completedAt: '2025-12-20T10:00:00Z', completedBy: 'Admin' },
        { id: 'c2', label: 'Calculate PAYGW amount', completed: true, completedAt: '2025-12-21T14:30:00Z', completedBy: 'System' },
        { id: 'c3', label: 'Reconcile with segregated account', completed: false },
        { id: 'c4', label: 'Generate evidence pack', completed: false },
        { id: 'c5', label: 'Lodge with ATO', completed: false },
      ],
    },
    {
      id: 'OBL-002',
      title: 'GST Monthly Return - December 2025',
      type: 'GST',
      dueDate: '2026-01-21',
      status: 'pending',
      amount: 38450.00,
      period: 'December 2025',
      assignee: 'Admin',
      organizationId: orgId,
      createdAt: '2025-12-10T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
      checklist: [
        { id: 'g1', label: 'Verify sales data', completed: true, completedAt: '2025-12-28T09:00:00Z', completedBy: 'Operator' },
        { id: 'g2', label: 'Calculate GST liability', completed: true, completedAt: '2025-12-29T11:00:00Z', completedBy: 'System' },
        { id: 'g3', label: 'Reconcile transactions', completed: false },
        { id: 'g4', label: 'Generate BAS draft', completed: false },
      ],
    },
    {
      id: 'OBL-003',
      title: 'Superannuation Guarantee - Q2 2026',
      type: 'SG',
      dueDate: '2026-04-28',
      status: 'active',
      amount: 25600.00,
      period: 'Q2 2026',
      assignee: 'Operator',
      organizationId: orgId,
      createdAt: '2026-01-05T00:00:00Z',
      updatedAt: '2026-01-06T00:00:00Z',
    },
    {
      id: 'OBL-004',
      title: 'BAS - Q4 2025',
      type: 'BAS',
      dueDate: '2026-02-28',
      status: 'pending',
      amount: 125430.00,
      period: 'Q4 2025',
      assignee: 'Admin',
      organizationId: orgId,
      createdAt: '2025-12-01T00:00:00Z',
      updatedAt: '2026-01-04T00:00:00Z',
    },
    {
      id: 'OBL-005',
      title: 'PAYGW Monthly Remittance - January 2026',
      type: 'PAYGW',
      dueDate: '2026-02-07',
      status: 'draft',
      amount: 47850.00,
      period: 'January 2026',
      assignee: 'Operator',
      organizationId: orgId,
      createdAt: '2026-01-06T00:00:00Z',
      updatedAt: '2026-01-06T00:00:00Z',
    },
  ];
}

export function generateMockTransactions(orgId: string): BankTransaction[] {
  return [
    { id: 'txn-001', date: '2025-12-15', description: 'Revenue - Client A', amount: 125000, type: 'credit', category: 'Revenue', reconciled: true, organizationId: orgId, obligationId: 'OBL-002' },
    { id: 'txn-002', date: '2025-12-18', description: 'Revenue - Client B', amount: 85000, type: 'credit', category: 'Revenue', reconciled: true, organizationId: orgId, obligationId: 'OBL-002' },
    { id: 'txn-003', date: '2025-12-20', description: 'Payroll December', amount: 45230.50, type: 'debit', category: 'Payroll', reconciled: false, organizationId: orgId, obligationId: 'OBL-001' },
    { id: 'txn-004', date: '2025-12-22', description: 'Supplier Payment', amount: 32000, type: 'debit', category: 'Expenses', reconciled: false, organizationId: orgId },
    { id: 'txn-005', date: '2025-12-28', description: 'Revenue - Client C', amount: 96000, type: 'credit', category: 'Revenue', reconciled: false, organizationId: orgId },
  ];
}

export function generateMockLedgerEntries(orgId: string): LedgerEntry[] {
  let balance = 250000;
  return [
    { id: 'led-001', date: '2025-12-15', description: 'Client A Invoice Payment', debit: 0, credit: 125000, balance: balance += 125000, category: 'Revenue', organizationId: orgId, createdBy: 'System' },
    { id: 'led-002', date: '2025-12-18', description: 'Client B Invoice Payment', debit: 0, credit: 85000, balance: balance += 85000, category: 'Revenue', organizationId: orgId, createdBy: 'System' },
    { id: 'led-003', date: '2025-12-20', description: 'Payroll Tax Withholding', debit: 45230.50, credit: 0, balance: balance -= 45230.50, category: 'Tax Liability', organizationId: orgId, createdBy: 'System', obligationId: 'OBL-001' },
    { id: 'led-004', date: '2025-12-22', description: 'Operating Expenses', debit: 32000, credit: 0, balance: balance -= 32000, category: 'Expenses', organizationId: orgId, createdBy: 'Admin' },
  ];
}

export function generateMockEvidencePacks(orgId: string): EvidencePack[] {
  return [
    {
      id: 'pack-001',
      name: 'BAS Q4 2025 Evidence Pack',
      status: 'ready',
      createdAt: '2025-12-28T10:00:00Z',
      generatedAt: '2025-12-29T14:30:00Z',
      periodId: 'p-q4-2025',
      organizationId: orgId,
      obligationIds: ['OBL-004'],
      hash: 'sha256:a3f8b9c2d1e0f7g6h5i4j3k2l1m0n9o8p7q6r5s4t3u2v1w0',
      checksum: 'CRC32:8A3F9BC2',
      items: [
        { id: 'item-001', type: 'reconciliation', name: 'Q4 Reconciliation Report.pdf', description: 'Complete reconciliation for Q4 2025', generatedAt: '2025-12-29T14:15:00Z', size: 245000, hash: 'sha256:abc123' },
        { id: 'item-002', type: 'statement', name: 'Bank Statements Q4.pdf', description: 'All bank statements for Q4 2025', generatedAt: '2025-12-29T14:20:00Z', size: 1230000, hash: 'sha256:def456' },
        { id: 'item-003', type: 'report', name: 'BAS Calculation Detail.xlsx', description: 'Detailed BAS calculations', generatedAt: '2025-12-29T14:25:00Z', size: 89000, hash: 'sha256:ghi789' },
        { id: 'item-004', type: 'attestation', name: 'Director Attestation.pdf', description: 'Signed director attestation', generatedAt: '2025-12-29T14:28:00Z', size: 45000, hash: 'sha256:jkl012' },
      ],
    },
    {
      id: 'pack-002',
      name: 'PAYGW December 2025 Evidence Pack',
      status: 'draft',
      createdAt: '2026-01-05T09:00:00Z',
      periodId: 'p-202412',
      organizationId: orgId,
      obligationIds: ['OBL-001'],
      items: [],
    },
  ];
}

export function generateMockPolicies(orgId: string): ControlPolicy[] {
  return [
    {
      id: 'pol-001',
      name: 'PAYGW Funding Policy',
      version: '2.1',
      type: 'funding',
      description: 'Minimum funding coverage requirements for PAYGW obligations',
      content: 'All PAYGW withholdings must be transferred to segregated accounts within 2 business days of payroll processing. Minimum coverage: 100%.',
      publishedAt: '2025-11-15T10:00:00Z',
      publishedBy: 'Admin',
      effectiveDate: '2025-12-01',
      status: 'published',
      organizationId: orgId,
    },
    {
      id: 'pol-002',
      name: 'GST Remittance Attestation',
      version: '1.5',
      type: 'attestation',
      description: 'Director attestation requirements for GST lodgment',
      content: 'Directors must attest to the accuracy of GST calculations before lodgment. Attestations must be digitally signed and archived.',
      publishedAt: '2025-10-01T10:00:00Z',
      publishedBy: 'Admin',
      effectiveDate: '2025-11-01',
      status: 'published',
      organizationId: orgId,
    },
    {
      id: 'pol-003',
      name: 'Dual Approval for Large Obligations',
      version: '1.0',
      type: 'approval',
      description: 'Dual approval requirement for obligations over $50,000',
      content: 'Any tax obligation exceeding $50,000 requires approval from both the CFO and an independent reviewer before lodgment.',
      status: 'draft',
      effectiveDate: '2026-02-01',
      organizationId: orgId,
    },
  ];
}

export function generateMockIncidents(orgId: string): Incident[] {
  return [
    {
      id: 'inc-001',
      title: 'Payroll Data Discrepancy Detected',
      description: 'Automated reconciliation detected $2,450 variance between payroll export and PAYGW calculation',
      severity: 'high',
      status: 'investigating',
      owner: 'Operator',
      createdAt: '2026-01-04T14:23:00Z',
      impactedObligationIds: ['OBL-001'],
      organizationId: orgId,
      timeline: [
        { id: 'note-001', note: 'Incident created automatically by reconciliation engine', createdAt: '2026-01-04T14:23:00Z', createdBy: 'System' },
        { id: 'note-002', note: 'Assigned to Operator for investigation', createdAt: '2026-01-04T14:25:00Z', createdBy: 'Admin' },
        { id: 'note-003', note: 'Identified missing superannuation entry in payroll export', createdAt: '2026-01-04T16:10:00Z', createdBy: 'Operator' },
      ],
    },
    {
      id: 'inc-002',
      title: 'Late BAS Lodgment - Q3 2025',
      description: 'BAS for Q3 2025 was lodged 3 days after the due date due to reconciliation delays',
      severity: 'medium',
      status: 'resolved',
      owner: 'Admin',
      createdAt: '2025-11-24T09:00:00Z',
      resolvedAt: '2025-11-30T16:00:00Z',
      impactedObligationIds: [],
      organizationId: orgId,
      timeline: [
        { id: 'note-004', note: 'BAS lodged late, ATO penalty notice received', createdAt: '2025-11-24T09:00:00Z', createdBy: 'Admin' },
        { id: 'note-005', note: 'Root cause: delayed vendor invoice reconciliation', createdAt: '2025-11-25T11:30:00Z', createdBy: 'Admin' },
        { id: 'note-006', note: 'Process improvement implemented: automated vendor reconciliation alerts', createdAt: '2025-11-30T14:00:00Z', createdBy: 'Admin' },
        { id: 'note-007', note: 'Incident resolved and closed', createdAt: '2025-11-30T16:00:00Z', createdBy: 'Admin' },
      ],
    },
  ];
}

export function generateMockAlerts(orgId: string): Alert[] {
  return [
    {
      id: 'alert-001',
      title: 'PAYGW Obligation Overdue',
      description: 'OBL-001: PAYGW Monthly Remittance - December 2025 is 1 day overdue',
      severity: 'critical',
      status: 'open',
      source: 'Obligation Monitor',
      createdAt: '2026-01-08T00:01:00Z',
      obligationId: 'OBL-001',
      organizationId: orgId,
    },
    {
      id: 'alert-002',
      title: 'Low Funding Coverage - GST',
      description: 'GST segregated account coverage is at 87% (target: 100%)',
      severity: 'warning',
      status: 'acknowledged',
      source: 'Funding Monitor',
      createdAt: '2026-01-06T08:15:00Z',
      acknowledgedAt: '2026-01-06T09:30:00Z',
      acknowledgedBy: 'Admin',
      organizationId: orgId,
    },
    {
      id: 'alert-003',
      title: 'BAS Due in 7 Days',
      description: 'Q4 2025 BAS is due on 2026-02-28 (7 days remaining)',
      severity: 'info',
      status: 'open',
      source: 'Due Date Monitor',
      createdAt: '2026-01-07T00:00:00Z',
      obligationId: 'OBL-004',
      organizationId: orgId,
    },
  ];
}

export function generateMockAuditEvents(orgId: string): AuditEvent[] {
  return [
    {
      id: 'audit-001',
      type: 'create',
      entityType: 'Obligation',
      entityId: 'OBL-001',
      userId: 'user-admin',
      userName: 'Admin',
      timestamp: '2025-12-15T10:00:00Z',
      description: 'Created PAYGW obligation for December 2025',
    },
    {
      id: 'audit-002',
      type: 'update',
      entityType: 'Obligation',
      entityId: 'OBL-001',
      userId: 'user-operator',
      userName: 'Operator',
      timestamp: '2025-12-20T14:30:00Z',
      changes: { status: { from: 'draft', to: 'pending' } },
      description: 'Updated obligation status to pending',
    },
    {
      id: 'audit-003',
      type: 'reconcile',
      entityType: 'Transaction',
      entityId: 'txn-001',
      userId: 'system',
      userName: 'System',
      timestamp: '2025-12-28T11:00:00Z',
      description: 'Automatically reconciled bank transaction to GST obligation',
    },
    {
      id: 'audit-004',
      type: 'approve',
      entityType: 'EvidencePack',
      entityId: 'pack-001',
      userId: 'user-admin',
      userName: 'Admin',
      timestamp: '2025-12-29T15:00:00Z',
      description: 'Approved evidence pack for Q4 2025 BAS',
    },
  ];
}

export function generateMockBASReadiness(periodId: string): BASReadiness {
  return {
    periodId,
    ready: false,
    blockers: [
      'OBL-001 is overdue and not reconciled',
      'GST segregated account coverage is below 100% (currently 87%)',
      'Evidence pack for Q4 2025 requires verification',
    ],
    fundingStatus: {
      paygwCoverage: 98.5,
      gstCoverage: 87.2,
      sgCoverage: 100.0,
    },
    obligationsSummary: {
      total: 5,
      completed: 0,
      pending: 3,
      overdue: 1,
    },
  };
}

// Initial data seed function
export function getInitialMockData() {
  const orgs = generateMockOrganizations();
  const periods = generateMockPeriods();
  const orgId = orgs[0].id;

  return {
    organizations: orgs,
    periods,
    obligations: generateMockObligations(orgId),
    transactions: generateMockTransactions(orgId),
    ledgerEntries: generateMockLedgerEntries(orgId),
    evidencePacks: generateMockEvidencePacks(orgId),
    policies: generateMockPolicies(orgId),
    incidents: generateMockIncidents(orgId),
    alerts: generateMockAlerts(orgId),
    auditEvents: generateMockAuditEvents(orgId),
  };
}
