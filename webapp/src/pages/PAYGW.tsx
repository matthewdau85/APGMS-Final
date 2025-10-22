import { FormEvent, useId, useMemo, useState } from 'react';
import Drawer from '../components/Drawer';
import './PAYGW.css';

type Variance = {
  id: string;
  date: string;
  payee: string;
  description: string;
  amount: string;
  status: string;
  statusVariant: 'pending' | 'monitor' | 'active';
};

const variances: Variance[] = [
  {
    id: '1',
    date: '2024-04-12',
    payee: 'SummitWorks Staffing',
    description: 'Labour hire variance following shift premiums',
    amount: '$42,180.00',
    status: 'Pending review',
    statusVariant: 'pending'
  },
  {
    id: '2',
    date: '2024-04-10',
    payee: 'Metro Industrial Cleaning',
    description: 'Service invoice mismatch (partial delivery)',
    amount: '$18,640.00',
    status: 'Under monitoring',
    statusVariant: 'monitor'
  },
  {
    id: '3',
    date: '2024-04-08',
    payee: 'Northern Equipment Finance',
    description: 'Deferred lease payment variance (30 days)',
    amount: '$76,210.00',
    status: 'Resolution pending',
    statusVariant: 'pending'
  },
  {
    id: '4',
    date: '2024-04-02',
    payee: 'Brightline Logistics',
    description: 'Carrier rate update applied retroactively',
    amount: '$9,420.00',
    status: 'Closed - adjustments posted',
    statusVariant: 'active'
  }
];

const statusClassMap: Record<Variance['statusVariant'], string> = {
  pending: 'paygw-status paygw-status--pending',
  monitor: 'paygw-status paygw-status--monitor',
  active: 'paygw-status paygw-status--active'
};

const wizardSteps = ['Classify issue', 'Choose action', 'Add notes & upload evidence'];

type ChecklistItem = {
  id: string;
  label: string;
  complete: boolean;
};

export default function PAYGWPage() {
  const [alertVisible, setAlertVisible] = useState(true);
  const [alertEscalated, setAlertEscalated] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeVariance, setActiveVariance] = useState<Variance | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [classification, setClassification] = useState('');
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const formId = useId();
  const classificationId = useId();
  const actionAdjustId = useId();
  const actionRescheduleId = useId();
  const actionPlanId = useId();
  const notesId = useId();
  const fileId = useId();

  const checklist: ChecklistItem[] = useMemo(
    () => [
      {
        id: 'alert',
        label: 'Alert acknowledged',
        complete: !alertVisible
      },
      {
        id: 'investigation',
        label: 'Investigation classified',
        complete: classification !== ''
      },
      {
        id: 'resolution',
        label: 'Resolution path selected',
        complete: action !== ''
      },
      {
        id: 'docs',
        label: 'Documentation captured',
        complete: notes.trim().length > 0 || Boolean(evidenceFile)
      }
    ],
    [action, alertVisible, classification, evidenceFile, notes]
  );

  const handleOpenDrawer = (variance: Variance) => {
    setActiveVariance(variance);
    setDrawerOpen(true);
    setCurrentStep(0);
    setClassification('');
    setAction('');
    setNotes('');
    setEvidenceFile(null);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
  };

  const handleNextStep = () => {
    setCurrentStep((previous) => Math.min(previous + 1, wizardSteps.length - 1));
  };

  const handlePreviousStep = () => {
    setCurrentStep((previous) => Math.max(previous - 1, 0));
  };

  const handleWizardSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Stub persistence hook for future API integration.
    console.info('Variance remediation submitted', {
      varianceId: activeVariance?.id,
      classification,
      action,
      notesLength: notes.trim().length,
      evidence: evidenceFile?.name ?? 'none'
    });
    setDrawerOpen(false);
  };

  const isLastStep = currentStep === wizardSteps.length - 1;

  return (
    <div className="paygw-page">
      <header className="paygw-header">
        <h1>PAYGW variance flow</h1>
        <p>
          Investigate and remediate withholding discrepancies with a guided workflow that
          captures classification, corrective actions, and supporting evidence.
        </p>
      </header>

      {alertVisible ? (
        <section
          className={`paygw-alert ${alertEscalated ? 'paygw-alert--danger' : 'paygw-alert--warning'}`}
          role="alert"
          aria-live="polite"
        >
          <div className="paygw-alert__header">
            <div>
              <p className="paygw-alert__title">
                {alertEscalated ? 'Escalated variance requiring action' : 'Variance detected in PAYGW flow'}
              </p>
              <p>
                Quarterly lodgement shows a variance that exceeds the automated tolerance threshold.
                Launch an investigation or escalate for immediate attention.
              </p>
            </div>
            <div className="paygw-alert__actions">
              <button type="button" onClick={() => setAlertEscalated((value) => !value)}>
                {alertEscalated ? 'Mark as contained' : 'Escalate'}
              </button>
              <button type="button" onClick={() => setAlertVisible(false)}>
                Dismiss
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="paygw-table-container" aria-label="Variance queue">
        <table className="paygw-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Payee</th>
              <th scope="col">Description</th>
              <th scope="col">Amount</th>
              <th scope="col">Status</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {variances.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <div className="paygw-empty-state">No variances to display.</div>
                </td>
              </tr>
            ) : (
              variances.map((variance) => (
                <tr key={variance.id}>
                  <td>{variance.date}</td>
                  <td>{variance.payee}</td>
                  <td>{variance.description}</td>
                  <td>{variance.amount}</td>
                  <td>
                    <span className={statusClassMap[variance.statusVariant]}>{variance.status}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="paygw-remediate"
                      onClick={() => handleOpenDrawer(variance)}
                    >
                      Remediate
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="paygw-checklist" aria-label="Variance remediation checklist">
        <h2>Alert → investigation → resolution → docs</h2>
        <ul>
          {checklist.map((item) => (
            <li key={item.id}>
              <input type="checkbox" checked={item.complete} readOnly aria-describedby={`${item.id}-label`} />
              <span id={`${item.id}-label`}>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      <Drawer
        isOpen={drawerOpen}
        onClose={handleCloseDrawer}
        title={activeVariance ? `Remediate ${activeVariance.payee}` : 'Variance remediation'}
        footer={
          <div className="paygw-drawer-footer">
            {currentStep > 0 ? (
              <button type="button" className="paygw-secondary-button" onClick={handlePreviousStep}>
                Back
              </button>
            ) : null}
            {!isLastStep ? (
              <button type="button" className="paygw-primary-button" onClick={handleNextStep}>
                Continue
              </button>
            ) : (
              <button type="submit" form={formId} className="paygw-primary-button">
                Complete remediation
              </button>
            )}
          </div>
        }
      >
        <form id={formId} onSubmit={handleWizardSubmit}>
          {activeVariance ? (
            <div className="paygw-form-group paygw-variance-summary">
              <p className="paygw-variance-summary__label">Variance summary</p>
              <p className="paygw-variance-summary__value">
                {activeVariance.description} — {activeVariance.amount} ({activeVariance.date})
              </p>
            </div>
          ) : null}

          <ol className="paygw-steps">
            {wizardSteps.map((step, index) => (
              <li
                key={step}
                className={`paygw-step ${index === currentStep ? 'paygw-step--active' : ''}`}
              >
                <span className="paygw-step__index">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>

          {currentStep === 0 ? (
            <div className="paygw-form-group">
              <label htmlFor={classificationId}>Issue classification</label>
              <select
                id={classificationId}
                className="paygw-select"
                value={classification}
                onChange={(event) => setClassification(event.target.value)}
                required
              >
                <option value="" disabled>
                  Select classification
                </option>
                <option value="processing-error">Processing error</option>
                <option value="timing-variance">Timing variance</option>
                <option value="supplier-misreport">Supplier misreport</option>
                <option value="potential-fraud">Potential fraud</option>
              </select>
            </div>
          ) : null}

          {currentStep === 1 ? (
            <fieldset className="paygw-form-group">
              <legend>Choose corrective action</legend>
              <div className="paygw-radio-group">
                <label className="paygw-radio-option" htmlFor={actionAdjustId}>
                  <input
                    type="radio"
                    id={actionAdjustId}
                    name="action"
                    value="adjust-funds"
                    checked={action === 'adjust-funds'}
                    onChange={(event) => setAction(event.target.value)}
                    required
                  />
                  Adjust funds
                </label>
                <label className="paygw-radio-option" htmlFor={actionRescheduleId}>
                  <input
                    type="radio"
                    id={actionRescheduleId}
                    name="action"
                    value="reschedule"
                    checked={action === 'reschedule'}
                    onChange={(event) => setAction(event.target.value)}
                  />
                  Reschedule remittance
                </label>
                <label className="paygw-radio-option" htmlFor={actionPlanId}>
                  <input
                    type="radio"
                    id={actionPlanId}
                    name="action"
                    value="payment-plan"
                    checked={action === 'payment-plan'}
                    onChange={(event) => setAction(event.target.value)}
                  />
                  Establish payment plan
                </label>
              </div>
            </fieldset>
          ) : null}

          {currentStep === 2 ? (
            <div className="paygw-form-group paygw-notes-upload">
              <div className="paygw-form-group">
                <label htmlFor={notesId}>Investigation notes</label>
                <textarea
                  id={notesId}
                  className="paygw-textarea"
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Summarise findings, stakeholder outreach, and pending decisions"
                />
              </div>
              <div className="paygw-form-group">
                <label htmlFor={fileId}>Upload evidence</label>
                <input
                  id={fileId}
                  className="paygw-file"
                  type="file"
                  onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
                />
                {evidenceFile ? <span>Attached: {evidenceFile.name}</span> : null}
              </div>
            </div>
          ) : null}
        </form>
      </Drawer>
    </div>
  );
}
