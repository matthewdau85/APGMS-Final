import type {
  AuditTrailItem,
  Connection,
  GstVariance,
  Obligation,
  PaygwQueueItem
} from './types';

const FETCH_DELAY = 600;

type FetchOptions = {
  signal?: AbortSignal;
};

const mockObligations: Obligation[] = [
  {
    id: 'obligation-1',
    name: 'PAYG remittance - Australia',
    amount: '$215,420',
    dueDate: 'Due in 3 days',
    status: 'Due soon',
    commentary: 'Confirm withheld amounts after this week\'s payroll close.'
  },
  {
    id: 'obligation-2',
    name: 'SG superannuation top-up',
    amount: '$86,000',
    dueDate: 'Scheduled 18 Oct',
    status: 'Monitoring',
    commentary: 'Waiting on confirmation from Melbourne subsidiary finance lead.'
  },
  {
    id: 'obligation-3',
    name: 'PAYG catch-up - New Zealand',
    amount: 'NZ$54,280',
    dueDate: 'Filed 2 days ago',
    status: 'Paid',
    commentary: 'Settled with IRD. Reconcile in Workpapers prior to month end.'
  }
];

const mockPaygwQueue: PaygwQueueItem[] = [
  {
    id: 'queue-1',
    employer: 'Northwind Manufacturing',
    amount: '$84,200',
    payPeriod: 'Fortnight ending 11 Oct',
    status: 'Queued',
    nextAction: 'Validate overtime adjustments before submission.'
  },
  {
    id: 'queue-2',
    employer: 'Brightside Retail Group',
    amount: '$41,930',
    payPeriod: 'Monthly close 30 Sep',
    status: 'Requires attention',
    nextAction: 'Payroll variance exceeds 5% - flag with controller.'
  },
  {
    id: 'queue-3',
    employer: 'Helios Energy JV',
    amount: '$57,610',
    payPeriod: 'Fortnight ending 4 Oct',
    status: 'Processing',
    nextAction: 'ATO lodgement in-flight. Expect confirmation this afternoon.'
  }
];

const mockGstVariance: GstVariance = {
  id: 'gst-variance-1',
  entity: 'APAC consolidated',
  variance: 4.6,
  direction: 'Decrease',
  narrative: 'Variance driven by accelerated input tax credits for Q1 solar deployments.',
  updated: 'Updated 9 Oct'
};

const mockAuditTrail: AuditTrailItem[] = [
  {
    id: 'audit-1',
    actor: 'S. Patel',
    action: 'Approved updated PAYG submission',
    timestamp: 'Today · 10:42 AEDT',
    context: 'Northwind Manufacturing payroll cycle'
  },
  {
    id: 'audit-2',
    actor: 'M. Chen',
    action: 'Reconciled GST variance report',
    timestamp: 'Yesterday · 16:10 AEDT',
    context: 'Q3 APAC consolidated filings'
  },
  {
    id: 'audit-3',
    actor: 'K. Robinson',
    action: 'Requested supporting docs from syndicate partner',
    timestamp: '2 days ago',
    context: 'Helios Energy JV compliance pack'
  }
];

const mockConnections: Connection[] = [
  {
    id: 'connection-1',
    bank: 'Commonwealth Bank',
    limit: '$1.2B',
    utilization: '64%',
    status: 'Active',
    updated: 'Today 10:24',
    notes: 'Term sheet expansion approved for Helios storage facility.'
  },
  {
    id: 'connection-2',
    bank: 'Northwind Credit Union',
    limit: '$820M',
    utilization: '71%',
    status: 'Monitoring',
    updated: 'Yesterday',
    notes: 'Utilization trending upward ahead of portfolio rebalance.'
  },
  {
    id: 'connection-3',
    bank: 'First Harbor Partners',
    limit: '$640M',
    utilization: '48%',
    status: 'Pending',
    updated: '2 days ago',
    notes: 'Awaiting revised covenants from legal after counterparty feedback.'
  }
];

function clonePayload<T>(payload: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(payload);
  }

  return JSON.parse(JSON.stringify(payload)) as T;
}

function simulateFetch<T>(payload: T, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve(clonePayload(payload));
    }, FETCH_DELAY);

    const handleAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };

    if (signal) {
      if (signal.aborted) {
        handleAbort();
        return;
      }

      signal.addEventListener('abort', handleAbort, { once: true });
    }
  });
}

export function isAbortError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'name' in error) {
    return (error as { name?: string }).name === 'AbortError';
  }

  return false;
}

export function getObligations(options: FetchOptions = {}): Promise<Obligation[]> {
  return simulateFetch(mockObligations, options.signal);
}

export function getPaygwQueue(options: FetchOptions = {}): Promise<PaygwQueueItem[]> {
  return simulateFetch(mockPaygwQueue, options.signal);
}

export function getGstVariance(options: FetchOptions = {}): Promise<GstVariance> {
  return simulateFetch(mockGstVariance, options.signal);
}

export function getAuditTrail(options: FetchOptions = {}): Promise<AuditTrailItem[]> {
  return simulateFetch(mockAuditTrail, options.signal);
}

export function getConnections(options: FetchOptions = {}): Promise<Connection[]> {
  return simulateFetch(mockConnections, options.signal);
}
