import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { GitMerge } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const Reconciliation: React.FC = () => {
  const { setCurrentHelpContent } = useApp();

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Reconciliation Engine',
      purpose: 'Automatically match ledger transactions with tax obligations to ensure accuracy and completeness. Identifies discrepancies and generates variance reports.',
      requiredInputs: ['Ledger period', 'Obligation period', 'Matching rules'],
      definitions: {
        'Auto-match': 'System automatically matches transactions by amount and date',
        'Variance': 'Difference between ledger and obligation amounts',
        'Manual Override': 'User-approved exception to matching rules',
      },
      commonMistakes: [
        'Not reviewing auto-matches before approval',
        'Ignoring small variances - all must be explained',
        'Running reconciliation before all transactions are posted',
      ],
      outputs: ['Matched transactions', 'Variance report', 'Reconciliation certificate'],
      nextStep: 'Select a period and run reconciliation to identify any discrepancies.',
    });
  }, [setCurrentHelpContent]);

  return (
    <div className="p-6">
      <EmptyState
        icon={GitMerge}
        title="Reconciliation Module"
        description="Automatically match and reconcile ledger transactions with tax obligations to ensure compliance accuracy."
      />
    </div>
  );
};
