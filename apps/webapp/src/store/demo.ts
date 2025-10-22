import { create } from 'zustand';
import type {
  Alert,
  Anomaly,
  Discrepancy,
  GstLocation,
  GstSnapshot,
  Integration,
  PaygwSnapshot,
  Thresholds,
  Transaction
} from '../types/apgms';

interface DemoState {
  paygwSnapshot: PaygwSnapshot;
  discrepancies: Discrepancy[];
  gstSnapshot: GstSnapshot;
  gstLocations: GstLocation[];
  transactions: Transaction[];
  integrations: Integration[];
  alerts: Alert[];
  anomalies: Anomaly[];
  thresholds: Thresholds;
}

export const useDemoStore = create<DemoState>(() => ({
  paygwSnapshot: {
    secured: 1850000,
    liability: 2110000,
    dueDate: '2024-10-18',
    variance: -260000,
    variancePct: 12.3
  },
  discrepancies: [
    {
      date: '2024-10-14',
      batch: 'PAYGW-214',
      reported: 48200,
      secured: 45100,
      variance: -3100,
      status: 'Pending'
    },
    {
      date: '2024-10-12',
      batch: 'PAYGW-209',
      reported: 36500,
      secured: 36200,
      variance: -300,
      status: 'In Progress'
    },
    {
      date: '2024-10-10',
      batch: 'PAYGW-204',
      reported: 41500,
      secured: 41500,
      variance: 0,
      status: 'Resolved'
    }
  ],
  gstSnapshot: {
    collected: 1260000,
    liability: 1185000,
    totalVariance: 75000,
    confidencePct: 86.5
  },
  gstLocations: [
    { name: 'Sydney HQ', week: 'Oct 7 - Oct 13', variance: 42000, confidencePct: 91.2 },
    { name: 'Melbourne Fulfilment', week: 'Oct 7 - Oct 13', variance: 28500, confidencePct: 84.1 },
    { name: 'Brisbane Digital', week: 'Oct 7 - Oct 13', variance: -7600, confidencePct: 78.4 },
    { name: 'Perth Retail', week: 'Oct 7 - Oct 13', variance: 9100, confidencePct: 73.6 }
  ],
  transactions: [
    {
      location: 'Sydney HQ',
      period: 'Q3 FY25',
      collected: 482000,
      liability: 451000,
      variance: 31000,
      confidencePct: 92.4
    },
    {
      location: 'Melbourne Fulfilment',
      period: 'Q3 FY25',
      collected: 365000,
      liability: 342000,
      variance: 23000,
      confidencePct: 87.9
    },
    {
      location: 'Brisbane Digital',
      period: 'Q3 FY25',
      collected: 287000,
      liability: 301000,
      variance: -14000,
      confidencePct: 81.6
    }
  ],
  integrations: [
    { name: 'ATO Business Portal', product: 'PAYGW', status: 'Active', lastSync: '12 minutes ago' },
    { name: 'Azure AD', product: 'SSO', status: 'Secure', lastSync: '1 hour ago' },
    { name: 'SAP Concur', product: 'Expenses', status: 'Monitor', lastSync: 'Yesterday 18:20' }
  ],
  alerts: [
    {
      title: 'Variance threshold exceeded',
      when: '5 minutes ago',
      level: 'Warning',
      message: 'Sydney HQ exceeded the variance limit for October remittances.'
    },
    {
      title: 'Integration sync healthy',
      when: '32 minutes ago',
      level: 'Info',
      message: 'PAYGW feed reconciled without issues during the last scheduled pull.'
    },
    {
      title: 'Manual review requested',
      when: 'Yesterday',
      level: 'Info',
      message: 'Finance requested review of Brisbane Digital outlier prior to filing.'
    }
  ],
  anomalies: [
    {
      ts: '2024-10-14T02:45:00Z',
      source: 'ATO PAYGW feed',
      rule: 'PAYGW:HighVariance',
      severity: 'high',
      description: 'Variance against liability breached configured threshold for the second consecutive day.'
    },
    {
      ts: '2024-10-13T23:10:00Z',
      source: 'ATO GST feed',
      rule: 'GST:LocationTrend',
      severity: 'medium',
      description: 'Melbourne Fulfilment variance climbed 8% week-over-week.'
    },
    {
      ts: '2024-10-13T15:32:00Z',
      source: 'Identity service',
      rule: 'Auth:FailedAttempts',
      severity: 'low',
      description: 'Multiple failed SSO attempts detected from a monitored vendor account.'
    }
  ],
  thresholds: {
    largeTx: 50000,
    patternSensitivity: 68,
    failedAttempts: 5,
    realtime: true,
    email: true,
    autoblock: false
  }
}));
