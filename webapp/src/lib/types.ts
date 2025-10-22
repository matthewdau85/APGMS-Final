export type ObligationStatus = 'Due soon' | 'Monitoring' | 'Paid';

export type Obligation = {
  id: string;
  name: string;
  amount: string;
  dueDate: string;
  status: ObligationStatus;
  commentary: string;
};

export type PaygwQueueStatus = 'Queued' | 'Processing' | 'Requires attention';

export type PaygwQueueItem = {
  id: string;
  employer: string;
  amount: string;
  payPeriod: string;
  status: PaygwQueueStatus;
  nextAction: string;
};

export type GstVarianceDirection = 'Increase' | 'Decrease';

export type GstVariance = {
  id: string;
  entity: string;
  variance: number;
  direction: GstVarianceDirection;
  narrative: string;
  updated: string;
};

export type AuditTrailItem = {
  id: string;
  actor: string;
  action: string;
  timestamp: string;
  context: string;
};

export type ConnectionStatus = 'Active' | 'Pending' | 'Monitoring';

export type Connection = {
  id: string;
  bank: string;
  limit: string;
  utilization: string;
  status: ConnectionStatus;
  updated: string;
  notes: string;
};
