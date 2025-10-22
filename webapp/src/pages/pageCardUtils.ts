export type StatusTone = 'positive' | 'caution' | 'critical';

export const statusToneClasses: Record<StatusTone, string> = {
  positive: 'page-card__status--positive',
  caution: 'page-card__status--caution',
  critical: 'page-card__status--critical'
};

export type Highlight = {
  label: string;
  value: string;
  emphasis?: 'strong';
};

export type FocusCard = {
  title: string;
  status?: {
    label: string;
    tone: StatusTone;
  };
  summary: string;
  highlights: Highlight[];
  footer?: string;
};
