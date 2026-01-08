import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';

export const Incidents: React.FC = () => {
  const { setCurrentHelpContent } = useApp();

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Incident Management',
      purpose: 'Track and resolve compliance incidents, errors, and exceptions. Maintains a complete record of issues and their resolution for audit purposes.',
      requiredInputs: ['Incident description', 'Severity level', 'Affected obligations', 'Root cause'],
      definitions: {
        'Incident': 'Any deviation from standard compliance process',
        'Critical': 'Issue that could result in regulatory penalty',
        'Root Cause': 'Underlying reason for the incident',
        'Remediation': 'Actions taken to resolve the incident',
      },
      commonMistakes: [
        'Not logging minor incidents - all exceptions should be recorded',
        'Incomplete root cause analysis',
        'Missing follow-up actions',
        'Not communicating incidents to stakeholders',
      ],
      outputs: ['Incident register', 'Resolution status', 'Trend analysis', 'Lessons learned'],
      nextStep: 'Log any compliance deviations immediately and track through to resolution.',
    });
  }, [setCurrentHelpContent]);

  return (
    <div className="p-6">
      <EmptyState
        icon={AlertTriangle}
        title="Incident Management Module"
        description="Track and manage compliance incidents, errors, and exceptions with full audit trails."
      />
    </div>
  );
};
