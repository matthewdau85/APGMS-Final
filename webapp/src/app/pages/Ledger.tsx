import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const Ledger: React.FC = () => {
  const { setCurrentHelpContent } = useApp();

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Financial Ledger',
      purpose: 'View and manage all financial transactions related to tax obligations. The ledger provides a complete audit trail of payments, withholdings, and adjustments.',
      requiredInputs: ['Transaction date', 'Amount', 'Account codes', 'Description'],
      definitions: {
        'Ledger Entry': 'A single financial transaction record',
        'Reconciliation': 'Process of matching ledger entries to obligations',
      },
      commonMistakes: ['Incorrect account coding', 'Missing transaction references'],
      outputs: ['Complete transaction history', 'Account balances', 'Reconciliation reports'],
      nextStep: 'Navigate to Reconciliation to match ledger entries with obligations.',
    });
  }, [setCurrentHelpContent]);

  return (
    <div className="p-6">
      <EmptyState
        icon={BookOpen}
        title="Ledger Module"
        description="The Financial Ledger module displays all transactions and provides comprehensive accounting records for tax compliance."
      />
    </div>
  );
};
