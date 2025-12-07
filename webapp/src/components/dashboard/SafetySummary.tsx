import React from 'react';

type SafetyProps = {
  paygwStatus: 'SAFE' | 'UNDER_FUNDED';
  gstStatus: 'SAFE' | 'UNDER_FUNDED';
  nextActions: { id: string; label: string }[];
};

export const SafetySummary: React.FC<SafetyProps> = ({
  paygwStatus,
  gstStatus,
  nextActions,
}) => {
  const badgeClass = (status: 'SAFE' | 'UNDER_FUNDED') =>
    status === 'SAFE'
      ? 'bg-green-100 text-green-800'
      : 'bg-amber-100 text-amber-800';

  const badgeLabel = (status: 'SAFE' | 'UNDER_FUNDED') =>
    status === 'SAFE' ? 'On track' : 'At risk';

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold">PAYGW buffer</h2>
        <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-medium ${badgeClass(paygwStatus)}`}>
          {badgeLabel(paygwStatus)}
        </span>
        <p className="mt-3 text-sm text-slate-600">
          We track what should be set aside for PAYGW and compare it to your
          tax buffer. Green means you’re ready for your next payment.
        </p>
      </div>
      <div className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold">GST buffer</h2>
        <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-medium ${badgeClass(gstStatus)}`}>
          {badgeLabel(gstStatus)}
        </span>
        <p className="mt-3 text-sm text-slate-600">
          This reflects how your GST set-aside compares to what we’ve
          calculated from your bank feed.
        </p>
      </div>
      <div className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold">Next 3 actions</h2>
        {nextActions.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No urgent actions. Keep funding your tax buffers as usual.
          </p>
        ) : (
          <ol className="mt-3 space-y-2 text-sm text-slate-700">
            {nextActions.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span>{a.label}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};
