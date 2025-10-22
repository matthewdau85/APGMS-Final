export type Percent = number; // 0..100
export interface PaygwSnapshot {
  secured: number;
  liability: number;
  dueDate: string;
  variance: number;
  variancePct: Percent;
}
export interface Discrepancy {
  date: string;
  batch: string;
  reported: number;
  secured: number;
  variance: number;
  status: 'Pending' | 'Resolved' | 'In Progress';
}
export interface GstSnapshot {
  collected: number;
  liability: number;
  totalVariance: number;
  confidencePct: Percent;
}
export interface GstLocation {
  name: string;
  week: string;
  variance: number;
  confidencePct: Percent;
}
export interface Transaction {
  location: string;
  period: string;
  collected: number;
  liability: number;
  variance: number;
  confidencePct: Percent;
}
export interface Integration {
  name: string;
  product: string;
  status: 'Active' | 'Secure' | 'Monitor';
  lastSync: string;
}
export interface Alert {
  title: string;
  when: string;
  level: 'Warning' | 'Info';
  message: string;
}
export interface Anomaly {
  ts: string;
  source: string;
  rule: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}
export interface Thresholds {
  largeTx: number;
  patternSensitivity: Percent;
  failedAttempts: number;
  realtime: boolean;
  email: boolean;
  autoblock: boolean;
}
