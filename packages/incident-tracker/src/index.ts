import { maskCollection, maskIncidentLike, type MaskingOptions } from "@apgms/shared/pii";

export type IncidentSeverity = "low" | "medium" | "high";

export interface IncidentLineItem {
  id: string;
  accountNumber: string;
  description: string;
  amountCents: number;
  owner: string;
}

export interface IncidentRelationshipEntry {
  id: string;
  summary: string;
  status: string;
}

export interface IncidentRelationships {
  duplicates: IncidentRelationshipEntry[];
  followUps: IncidentRelationshipEntry[];
  related: IncidentRelationshipEntry[];
}

export interface RawIncident extends Record<string, unknown> {
  id: string;
  orgId: string;
  title: string;
  summary: string;
  severity: IncidentSeverity;
  status: string;
  reportedAt: string;
  lastUpdatedAt: string;
  reporter: {
    name: string;
    email: string;
    phone: string;
    team: string;
  };
  impactedCustomers: Array<{
    name: string;
    email: string;
    accountNumber: string;
    reference: string;
  }>;
  lineItems: IncidentLineItem[];
  timeline: string[];
  metadata: {
    detectionSource: string;
    signals: number;
    tags: string[];
  };
  relationships: IncidentRelationships;
}

export type Incident = Omit<RawIncident, "relationships"> & {
  linkedIncidents: IncidentLink[];
  linkageSummary: IncidentLinkageSummary;
};

export interface IncidentLink {
  id: string;
  summary: string;
  status: string;
  relationship: "duplicate" | "follow_up" | "related";
}

export interface IncidentLinkageSummary {
  total: number;
  byRelationship: Record<IncidentLink["relationship"], number>;
}

export type ExampleFetcher = () => Promise<RawIncident>;

export interface IncidentTrackerOptions {
  exampleFetcher?: ExampleFetcher;
  maskOptions?: MaskingOptions;
}

export class IncidentTracker {
  constructor(private readonly options: IncidentTrackerOptions = {}) {}

  async fetchExampleIncident(): Promise<Incident> {
    const fetcher = this.options.exampleFetcher ?? defaultExampleFetcher;
    const rawIncident = await fetcher();

    const linkage = buildLinkage(rawIncident.relationships);
    const maskedIncident = maskIncidentLike(rawIncident, {
      additionalKeys: [
        ...(this.options.maskOptions?.additionalKeys ?? []),
        "reporter",
        "customer",
        "lineItems",
        "timeline",
      ],
    });

    const maskedLinks = maskCollection(linkage, {
      additionalKeys: ["summary", ...(this.options.maskOptions?.additionalKeys ?? [])],
    });

    const { relationships: _ignored, ...rest } = maskedIncident;
    const baseIncident = rest as Omit<RawIncident, "relationships">;

    return {
      ...baseIncident,
      linkedIncidents: maskedLinks,
      linkageSummary: buildLinkageSummary(linkage),
    };
  }
}

const EXAMPLE_INCIDENT: RawIncident = {
  id: "inc-2025-02-011",
  orgId: "org-ledger",
  title: "Ledger drift detected in payroll batch 42",
  summary:
    "Automated controls detected a variance between ledger postings and payroll provider totals for batch 42.",
  severity: "high",
  status: "investigating",
  reportedAt: "2025-02-11T02:35:00.000Z",
  lastUpdatedAt: "2025-02-11T04:20:00.000Z",
  reporter: {
    name: "Samantha Ledger",
    email: "samantha.ledger@example.com",
    phone: "+61 401 555 222",
    team: "Finance Operations",
  },
  impactedCustomers: [
    {
      name: "Jordan Example",
      email: "jordan@example-enterprise.com",
      accountNumber: "982374982374",
      reference: "CUST-3321",
    },
    {
      name: "Priya Confidential",
      email: "priya.confidential@example.com",
      accountNumber: "555001289456",
      reference: "CUST-3322",
    },
  ],
  lineItems: [
    {
      id: "line-001",
      accountNumber: "120-334-552",
      description: "Missing payroll reconciliation journal",
      amountCents: 1250000,
      owner: "Payroll Ops",
    },
    {
      id: "line-002",
      accountNumber: "120-334-553",
      description: "Reversal applied without approval",
      amountCents: -1250000,
      owner: "Finance Control",
    },
  ],
  timeline: [
    "02:30 Automated control flagged drift > $10k",
    "02:33 PagerDuty alert sent to Finance Ops",
    "02:40 Incident declared by Samantha Ledger",
  ],
  metadata: {
    detectionSource: "automated-monitoring",
    signals: 4,
    tags: ["ledger", "payroll", "controls"],
  },
  relationships: {
    duplicates: [
      {
        id: "inc-2024-09-004",
        summary: "Historical ledger drift in payroll batch 12",
        status: "closed",
      },
    ],
    followUps: [
      {
        id: "task-2025-02-018",
        summary: "Implement automated variance rollback",
        status: "open",
      },
    ],
    related: [
      {
        id: "inc-2025-01-010",
        summary: "Payroll provider API timeout",
        status: "monitoring",
      },
    ],
  },
};

const defaultExampleFetcher: ExampleFetcher = async () => EXAMPLE_INCIDENT;

function buildLinkage(relationships: IncidentRelationships): IncidentLink[] {
  const entries: IncidentLink[] = [];
  const append = (
    items: IncidentRelationshipEntry[],
    relationship: IncidentLink["relationship"]
  ) => {
    for (const item of items) {
      entries.push({
        id: item.id,
        summary: item.summary,
        status: item.status,
        relationship,
      });
    }
  };

  append(relationships.duplicates, "duplicate");
  append(relationships.followUps, "follow_up");
  append(relationships.related, "related");

  const deduped = new Map<string, IncidentLink>();
  for (const entry of entries) {
    const key = `${entry.relationship}:${entry.id}`;
    if (!deduped.has(key)) {
      deduped.set(key, entry);
    }
  }

  return Array.from(deduped.values());
}

function buildLinkageSummary(links: IncidentLink[]): IncidentLinkageSummary {
  const base: IncidentLinkageSummary = {
    total: 0,
    byRelationship: {
      duplicate: 0,
      follow_up: 0,
      related: 0,
    },
  };

  for (const link of links) {
    base.total += 1;
    base.byRelationship[link.relationship] += 1;
  }

  return base;
}
