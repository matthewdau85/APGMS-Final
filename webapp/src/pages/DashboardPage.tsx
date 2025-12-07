import React from 'react';
import { SafetySummary } from '../components/dashboard/SafetySummary';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export const DashboardPage: React.FC = () => {
  const { data: compliance } = useQuery({
    queryKey: ['regulator-compliance-summary', { period: 'current' }],
    queryFn: () => apiClient.get('/regulator/compliance-summary?period=current'),
  });

  const { data: risk } = useQuery({
    queryKey: ['risk-summary', { period: 'current' }],
    queryFn: () => apiClient.get('/risk/summary?period=current'),
  });

  const paygwStatus = compliance?.status?.paygw ?? 'SAFE';
  const gstStatus = compliance?.status?.gst ?? 'SAFE';

  const nextActions = (() => {
    const items: { id: string; label: string }[] = [];
    if (paygwStatus === 'UNDER_FUNDED') {
      items.push({
        id: 'top-up-paygw',
        label: 'Transfer to your PAYGW buffer to reach the safe target.',
      });
    }
    if (gstStatus === 'UNDER_FUNDED') {
      items.push({
        id: 'top-up-gst',
        label: 'Transfer to your GST buffer to cover your current obligations.',
      });
    }
    if (risk?.overallLevel === 'HIGH') {
      items.push({
        id: 'review-risk',
        label: 'Review risk summary and talk to your accountant about a plan.',
      });
    }
    return items.slice(0, 3);
  })();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">ATO-ready tax buffers</h1>
      <SafetySummary
        paygwStatus={paygwStatus}
        gstStatus={gstStatus}
        nextActions={nextActions}
      />
      {/* existing dashboard content */}
    </div>
  );
};
