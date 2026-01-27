// Zustand store for APGMS with localStorage persistence

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  ReconciliationMatch,
  FundingRequest,
  FundingSource,
} from '../types';
import { getInitialMockData } from '../lib/mockData';

interface AppState {
  // Current selections
  currentOrganizationId: string;
  currentPeriodId: string;
  
  // Data
  organizations: Organization[];
  periods: Period[];
  obligations: Obligation[];
  transactions: BankTransaction[];
  ledgerEntries: LedgerEntry[];
  evidencePacks: EvidencePack[];
  policies: ControlPolicy[];
  incidents: Incident[];
  alerts: Alert[];
  auditEvents: AuditEvent[];
  reconciliationMatches: ReconciliationMatch[];
  fundingRequests: FundingRequest[];
  fundingSources: FundingSource[];
  
  // Actions
  setCurrentOrganization: (orgId: string) => void;
  setCurrentPeriod: (periodId: string) => void;
  
  // Obligation actions
  createObligation: (obligation: Omit<Obligation, 'id' | 'createdAt' | 'updatedAt'>) => Obligation;
  updateObligation: (id: string, updates: Partial<Obligation>) => void;
  deleteObligation: (id: string) => void;
  
  // Transaction actions
  createTransaction: (transaction: Omit<BankTransaction, 'id'>) => BankTransaction;
  
  // Ledger actions
  createLedgerEntry: (entry: Omit<LedgerEntry, 'id' | 'balance'>) => LedgerEntry;
  
  // Evidence pack actions
  createEvidencePack: (pack: Omit<EvidencePack, 'id' | 'createdAt' | 'status' | 'items'>) => EvidencePack;
  updateEvidencePack: (id: string, updates: Partial<EvidencePack>) => void;
  generateEvidence: (packId: string) => void;
  verifyEvidence: (packId: string, verifiedBy: string) => void;
  
  // Policy actions
  createPolicy: (policy: Omit<ControlPolicy, 'id'>) => ControlPolicy;
  updatePolicy: (id: string, updates: Partial<ControlPolicy>) => void;
  publishPolicy: (id: string, publishedBy: string) => void;
  
  // Incident actions
  createIncident: (incident: Omit<Incident, 'id' | 'createdAt' | 'timeline'>) => Incident;
  updateIncident: (id: string, updates: Partial<Incident>) => void;
  addIncidentNote: (incidentId: string, note: string, createdBy: string) => void;
  
  // Alert actions
  acknowledgeAlert: (id: string, acknowledgedBy: string) => void;
  resolveAlert: (id: string, resolvedBy: string) => void;
  
  // Reconciliation actions
  createReconciliationMatch: (match: Omit<ReconciliationMatch, 'id'>) => ReconciliationMatch;
  approveReconciliation: (matchId: string, userId: string) => void;
  rejectReconciliation: (matchId: string) => void;
  
  // Funding actions
  createFundingRequest: (request: Omit<FundingRequest, 'id' | 'createdAt' | 'status'>) => FundingRequest;
  updateFundingRequest: (id: string, updates: Partial<FundingRequest>) => void;
  approveFundingRequest: (id: string, approvedBy: string) => void;
  allocateFunding: (requestId: string, sourceId: string, allocatedBy: string) => void;
  createFundingSource: (source: Omit<FundingSource, 'id'>) => FundingSource;
  updateFundingSource: (id: string, updates: Partial<FundingSource>) => void;
  
  // Audit actions
  addAuditEvent: (event: Omit<AuditEvent, 'id' | 'timestamp'>) => void;
  
  // Utility actions
  resetData: () => void;
}

const initialData = getInitialMockData();

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentOrganizationId: initialData.organizations[0].id,
      currentPeriodId: initialData.periods[0].id,
      organizations: initialData.organizations,
      periods: initialData.periods,
      obligations: initialData.obligations,
      transactions: initialData.transactions,
      ledgerEntries: initialData.ledgerEntries,
      evidencePacks: initialData.evidencePacks,
      policies: initialData.policies,
      incidents: initialData.incidents,
      alerts: initialData.alerts,
      auditEvents: initialData.auditEvents,
      reconciliationMatches: [],
      fundingRequests: [],
      fundingSources: [],
      
      // Current selections
      setCurrentOrganization: (orgId) => set({ currentOrganizationId: orgId }),
      setCurrentPeriod: (periodId) => set({ currentPeriodId: periodId }),
      
      // Obligation actions
      createObligation: (oblData) => {
        const newObl: Obligation = {
          ...oblData,
          id: `OBL-${Date.now()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ obligations: [...state.obligations, newObl] }));
        
        get().addAuditEvent({
          type: 'create',
          entityType: 'Obligation',
          entityId: newObl.id,
          userId: 'current-user',
          userName: oblData.assignee,
          description: `Created obligation: ${newObl.title}`,
        });
        
        return newObl;
      },
      
      updateObligation: (id, updates) => {
        set((state) => ({
          obligations: state.obligations.map((obl) =>
            obl.id === id ? { ...obl, ...updates, updatedAt: new Date().toISOString() } : obl
          ),
        }));
        
        get().addAuditEvent({
          type: 'update',
          entityType: 'Obligation',
          entityId: id,
          userId: 'current-user',
          userName: 'Current User',
          changes: updates,
          description: `Updated obligation ${id}`,
        });
      },
      
      deleteObligation: (id) => {
        set((state) => ({
          obligations: state.obligations.filter((obl) => obl.id !== id),
        }));
        
        get().addAuditEvent({
          type: 'delete',
          entityType: 'Obligation',
          entityId: id,
          userId: 'current-user',
          userName: 'Current User',
          description: `Deleted obligation ${id}`,
        });
      },
      
      // Transaction actions
      createTransaction: (txnData) => {
        const newTxn: BankTransaction = {
          ...txnData,
          id: `txn-${Date.now()}`,
        };
        set((state) => ({ transactions: [...state.transactions, newTxn] }));
        return newTxn;
      },
      
      // Ledger actions
      createLedgerEntry: (entryData) => {
        const state = get();
        const lastEntry = state.ledgerEntries[state.ledgerEntries.length - 1];
        const previousBalance = lastEntry?.balance || 0;
        const newBalance = previousBalance + entryData.credit - entryData.debit;
        
        const newEntry: LedgerEntry = {
          ...entryData,
          id: `led-${Date.now()}`,
          balance: newBalance,
        };
        
        set((state) => ({ ledgerEntries: [...state.ledgerEntries, newEntry] }));
        return newEntry;
      },
      
      // Evidence pack actions
      createEvidencePack: (packData) => {
        const newPack: EvidencePack = {
          ...packData,
          id: `pack-${Date.now()}`,
          createdAt: new Date().toISOString(),
          status: 'draft',
          items: [],
        };
        set((state) => ({ evidencePacks: [...state.evidencePacks, newPack] }));
        
        get().addAuditEvent({
          type: 'create',
          entityType: 'EvidencePack',
          entityId: newPack.id,
          userId: 'current-user',
          userName: 'Current User',
          description: `Created evidence pack: ${newPack.name}`,
        });
        
        return newPack;
      },
      
      updateEvidencePack: (id, updates) => {
        set((state) => ({
          evidencePacks: state.evidencePacks.map((pack) =>
            pack.id === id ? { ...pack, ...updates } : pack
          ),
        }));
      },
      
      generateEvidence: (packId) => {
        const timestamp = new Date().toISOString();
        const hash = `sha256:${Math.random().toString(36).substring(2)}`;
        
        set((state) => ({
          evidencePacks: state.evidencePacks.map((pack) =>
            pack.id === packId
              ? {
                  ...pack,
                  status: 'generating' as const,
                  generatedAt: timestamp,
                  hash,
                  checksum: `CRC32:${Math.random().toString(16).substring(2, 10).toUpperCase()}`,
                  items: [
                    {
                      id: `item-${Date.now()}-1`,
                      type: 'reconciliation' as const,
                      name: 'Reconciliation Report.pdf',
                      description: 'Complete reconciliation report',
                      generatedAt: timestamp,
                      size: Math.floor(Math.random() * 500000) + 100000,
                      hash: `sha256:${Math.random().toString(36).substring(2)}`,
                    },
                    {
                      id: `item-${Date.now()}-2`,
                      type: 'statement' as const,
                      name: 'Bank Statements.pdf',
                      description: 'Period bank statements',
                      generatedAt: timestamp,
                      size: Math.floor(Math.random() * 1000000) + 500000,
                      hash: `sha256:${Math.random().toString(36).substring(2)}`,
                    },
                    {
                      id: `item-${Date.now()}-3`,
                      type: 'report' as const,
                      name: 'Tax Calculation Detail.xlsx',
                      description: 'Detailed tax calculations',
                      generatedAt: timestamp,
                      size: Math.floor(Math.random() * 100000) + 50000,
                      hash: `sha256:${Math.random().toString(36).substring(2)}`,
                    },
                  ],
                }
              : pack
          ),
        }));
        
        // Simulate async generation
        setTimeout(() => {
          set((state) => ({
            evidencePacks: state.evidencePacks.map((pack) =>
              pack.id === packId ? { ...pack, status: 'ready' as const } : pack
            ),
          }));
        }, 2000);
      },
      
      verifyEvidence: (packId, verifiedBy) => {
        set((state) => ({
          evidencePacks: state.evidencePacks.map((pack) =>
            pack.id === packId
              ? { ...pack, status: 'verified' as const, verifiedAt: new Date().toISOString(), verifiedBy }
              : pack
          ),
        }));
        
        get().addAuditEvent({
          type: 'verify',
          entityType: 'EvidencePack',
          entityId: packId,
          userId: 'current-user',
          userName: verifiedBy,
          description: `Verified evidence pack ${packId}`,
        });
      },
      
      // Policy actions
      createPolicy: (policyData) => {
        const newPolicy: ControlPolicy = {
          ...policyData,
          id: `pol-${Date.now()}`,
        };
        set((state) => ({ policies: [...state.policies, newPolicy] }));
        return newPolicy;
      },
      
      updatePolicy: (id, updates) => {
        set((state) => ({
          policies: state.policies.map((pol) => (pol.id === id ? { ...pol, ...updates } : pol)),
        }));
      },
      
      publishPolicy: (id, publishedBy) => {
        set((state) => ({
          policies: state.policies.map((pol) =>
            pol.id === id
              ? { ...pol, status: 'published' as const, publishedAt: new Date().toISOString(), publishedBy }
              : pol
          ),
        }));
        
        get().addAuditEvent({
          type: 'approve',
          entityType: 'ControlPolicy',
          entityId: id,
          userId: 'current-user',
          userName: publishedBy,
          description: `Published policy ${id}`,
        });
      },
      
      // Incident actions
      createIncident: (incidentData) => {
        const newIncident: Incident = {
          ...incidentData,
          id: `inc-${Date.now()}`,
          createdAt: new Date().toISOString(),
          timeline: [
            {
              id: `note-${Date.now()}`,
              note: 'Incident created',
              createdAt: new Date().toISOString(),
              createdBy: incidentData.owner,
            },
          ],
        };
        set((state) => ({ incidents: [...state.incidents, newIncident] }));
        return newIncident;
      },
      
      updateIncident: (id, updates) => {
        set((state) => ({
          incidents: state.incidents.map((inc) => (inc.id === id ? { ...inc, ...updates } : inc)),
        }));
      },
      
      addIncidentNote: (incidentId, note, createdBy) => {
        const newNote = {
          id: `note-${Date.now()}`,
          note,
          createdAt: new Date().toISOString(),
          createdBy,
        };
        
        set((state) => ({
          incidents: state.incidents.map((inc) =>
            inc.id === incidentId ? { ...inc, timeline: [...inc.timeline, newNote] } : inc
          ),
        }));
      },
      
      // Alert actions
      acknowledgeAlert: (id, acknowledgedBy) => {
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === id
              ? { ...alert, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString(), acknowledgedBy }
              : alert
          ),
        }));
      },
      
      resolveAlert: (id, resolvedBy) => {
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === id
              ? { ...alert, status: 'resolved' as const, resolvedAt: new Date().toISOString(), resolvedBy }
              : alert
          ),
        }));
      },
      
      // Reconciliation actions
      createReconciliationMatch: (matchData) => {
        const newMatch: ReconciliationMatch = {
          ...matchData,
          id: `match-${Date.now()}`,
        };
        set((state) => ({ reconciliationMatches: [...state.reconciliationMatches, newMatch] }));
        return newMatch;
      },
      
      approveReconciliation: (matchId, userId) => {
        set((state) => ({
          reconciliationMatches: state.reconciliationMatches.map((match) =>
            match.id === matchId
              ? { ...match, status: 'approved' as const, matchedAt: new Date().toISOString(), matchedBy: userId }
              : match
          ),
        }));
        
        // Update transaction as reconciled
        const match = get().reconciliationMatches.find((m) => m.id === matchId);
        if (match) {
          set((state) => ({
            transactions: state.transactions.map((txn) =>
              txn.id === match.bankTransactionId
                ? { ...txn, reconciled: true, obligationId: match.obligationId }
                : txn
            ),
          }));
          
          get().addAuditEvent({
            type: 'reconcile',
            entityType: 'ReconciliationMatch',
            entityId: matchId,
            userId: 'current-user',
            userName: userId,
            description: `Approved reconciliation match ${matchId}`,
          });
        }
      },
      
      rejectReconciliation: (matchId) => {
        set((state) => ({
          reconciliationMatches: state.reconciliationMatches.map((match) =>
            match.id === matchId ? { ...match, status: 'rejected' as const } : match
          ),
        }));
      },
      
      // Funding actions
      createFundingRequest: (requestData) => {
        const newRequest: FundingRequest = {
          ...requestData,
          id: `req-${Date.now()}`,
          createdAt: new Date().toISOString(),
          status: 'pending' as const,
        };
        set((state) => ({ fundingRequests: [...state.fundingRequests, newRequest] }));
        
        get().addAuditEvent({
          type: 'create',
          entityType: 'FundingRequest',
          entityId: newRequest.id,
          userId: 'current-user',
          userName: 'Current User',
          description: `Created funding request: ${newRequest.title}`,
        });
        
        return newRequest;
      },
      
      updateFundingRequest: (id, updates) => {
        set((state) => ({
          fundingRequests: state.fundingRequests.map((req) =>
            req.id === id ? { ...req, ...updates } : req
          ),
        }));
        
        get().addAuditEvent({
          type: 'update',
          entityType: 'FundingRequest',
          entityId: id,
          userId: 'current-user',
          userName: 'Current User',
          changes: updates,
          description: `Updated funding request ${id}`,
        });
      },
      
      approveFundingRequest: (id, approvedBy) => {
        set((state) => ({
          fundingRequests: state.fundingRequests.map((req) =>
            req.id === id
              ? { ...req, status: 'approved' as const, approvedAt: new Date().toISOString(), approvedBy }
              : req
          ),
        }));
        
        get().addAuditEvent({
          type: 'approve',
          entityType: 'FundingRequest',
          entityId: id,
          userId: 'current-user',
          userName: approvedBy,
          description: `Approved funding request ${id}`,
        });
      },
      
      allocateFunding: (requestId, sourceId, allocatedBy) => {
        set((state) => ({
          fundingRequests: state.fundingRequests.map((req) =>
            req.id === requestId
              ? { ...req, status: 'allocated' as const, allocatedAt: new Date().toISOString(), allocatedBy, sourceId }
              : req
          ),
        }));
        
        get().addAuditEvent({
          type: 'allocate',
          entityType: 'FundingRequest',
          entityId: requestId,
          userId: 'current-user',
          userName: allocatedBy,
          description: `Allocated funding request ${requestId} from source ${sourceId}`,
        });
      },
      
      createFundingSource: (sourceData) => {
        const newSource: FundingSource = {
          ...sourceData,
          id: `src-${Date.now()}`,
        };
        set((state) => ({ fundingSources: [...state.fundingSources, newSource] }));
        
        get().addAuditEvent({
          type: 'create',
          entityType: 'FundingSource',
          entityId: newSource.id,
          userId: 'current-user',
          userName: 'Current User',
          description: `Created funding source: ${newSource.name}`,
        });
        
        return newSource;
      },
      
      updateFundingSource: (id, updates) => {
        set((state) => ({
          fundingSources: state.fundingSources.map((src) =>
            src.id === id ? { ...src, ...updates } : src
          ),
        }));
        
        get().addAuditEvent({
          type: 'update',
          entityType: 'FundingSource',
          entityId: id,
          userId: 'current-user',
          userName: 'Current User',
          changes: updates,
          description: `Updated funding source ${id}`,
        });
      },
      
      // Audit actions
      addAuditEvent: (eventData) => {
        const newEvent: AuditEvent = {
          ...eventData,
          id: `audit-${Date.now()}`,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({ auditEvents: [...state.auditEvents, newEvent] }));
      },
      
      // Utility actions
      resetData: () => {
        const freshData = getInitialMockData();
        set({
          currentOrganizationId: freshData.organizations[0].id,
          currentPeriodId: freshData.periods[0].id,
          organizations: freshData.organizations,
          periods: freshData.periods,
          obligations: freshData.obligations,
          transactions: freshData.transactions,
          ledgerEntries: freshData.ledgerEntries,
          evidencePacks: freshData.evidencePacks,
          policies: freshData.policies,
          incidents: freshData.incidents,
          alerts: freshData.alerts,
          auditEvents: freshData.auditEvents,
          reconciliationMatches: [],
          fundingRequests: [],
          fundingSources: [],
        });
      },
    }),
    {
      name: 'apgms-storage',
    }
  )
);