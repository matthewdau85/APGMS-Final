import { create } from 'zustand';

type MetricKey = 'activeMandates' | 'totalCommittedCapital' | 'averageUtilization';

type Metric = {
  id: MetricKey;
  title: string;
  value: string;
  change: string;
  description: string;
};

type VarianceTone = 'positive' | 'negative' | 'neutral';

type PaygwVariance = {
  tone: VarianceTone;
  label: string;
};

type KpiStore = {
  metrics: Record<MetricKey, Metric>;
  paygwCompliance: number;
  paygwVariance: PaygwVariance;
  basLodgmentDays: number;
  setMetric: (key: MetricKey, updates: Partial<Omit<Metric, 'id'>>) => void;
  setPaygwCompliance: (value: number) => void;
  setPaygwVariance: (updates: Partial<PaygwVariance>) => void;
  setBasLodgmentDays: (days: number) => void;
};

export const useKpiStore = create<KpiStore>((set) => ({
  metrics: {
    activeMandates: {
      id: 'activeMandates',
      title: 'Active mandates',
      value: '24',
      change: '+3.4% vs last week',
      description:
        'Structured credit and private equity deals currently tracked in the Pro+ workspace.'
    },
    totalCommittedCapital: {
      id: 'totalCommittedCapital',
      title: 'Total committed capital',
      value: '$4.8B',
      change: '+$180M new commitments',
      description: 'Aggregate bank and fund lines allocated across open portfolios.'
    },
    averageUtilization: {
      id: 'averageUtilization',
      title: 'Average utilization',
      value: '67%',
      change: '-5.3% risk exposure',
      description: 'Weighted utilization across all active bank lines for the current quarter.'
    }
  },
  paygwCompliance: 82,
  paygwVariance: {
    tone: 'positive',
    label: '+4.1% ahead of forecast'
  },
  basLodgmentDays: 7,
  setMetric: (key, updates) =>
    set((state) => ({
      metrics: {
        ...state.metrics,
        [key]: {
          ...state.metrics[key],
          ...updates,
          id: key
        }
      }
    })),
  setPaygwCompliance: (value) =>
    set(() => ({
      paygwCompliance: Math.max(0, Math.min(100, Math.round(value)))
    })),
  setPaygwVariance: (updates) =>
    set((state) => ({
      paygwVariance: {
        ...state.paygwVariance,
        ...updates
      }
    })),
  setBasLodgmentDays: (days) =>
    set(() => ({
      basLodgmentDays: Math.max(0, Math.round(days))
    }))
}));

export const useMetricList = () =>
  useKpiStore((state) => Object.values(state.metrics));

export type { Metric, MetricKey, PaygwVariance, VarianceTone };
