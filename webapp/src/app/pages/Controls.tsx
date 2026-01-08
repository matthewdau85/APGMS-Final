import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Shield } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const Controls: React.FC = () => {
  const { setCurrentHelpContent } = useApp();

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Controls & Policies',
      purpose: 'Define and enforce compliance controls, approval workflows, and internal policies for tax obligations. Ensures governance and regulatory compliance.',
      requiredInputs: ['Control name', 'Policy document', 'Approval workflow', 'Responsibility matrix'],
      definitions: {
        'Control': 'A process or check that ensures compliance requirements are met',
        'Policy': 'Documented rules and procedures for tax compliance',
        'Segregation of Duties': 'Separation of roles to prevent fraud and errors',
      },
      commonMistakes: [
        'Not documenting control changes',
        'Insufficient segregation of duties',
        'Missing approval trails',
      ],
      outputs: ['Control effectiveness reports', 'Policy compliance status', 'Audit documentation'],
      nextStep: 'Review existing controls and update policies as regulations change.',
    });
  }, [setCurrentHelpContent]);

  return (
    <div className="p-6">
      <EmptyState
        icon={Shield}
        title="Controls & Policies Module"
        description="Manage compliance controls, approval workflows, and governance policies for tax obligations."
      />
    </div>
  );
};
