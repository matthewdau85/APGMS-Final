import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { StatusChip } from '../components/StatusChip';
import { AlertTriangle, CheckCircle2, FileCheck, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { generateMockBASReadiness } from '../lib/mockData';

export const BAS = () => {
  const { setCurrentHelpContent } = useApp();
  const { canLodge } = useAuth();
  const navigate = useNavigate();
  const {
    currentPeriodId,
    currentOrganizationId,
    periods,
    obligations,
    evidencePacks,
    updateObligation,
    createEvidencePack,
    generateEvidence,
    addAuditEvent,
  } = useAppStore();

  const [selectedPeriodId, setSelectedPeriodId] = useState(currentPeriodId);
  const [showLodgeConfirm, setShowLodgeConfirm] = useState(false);
  const [isLodging, setIsLodging] = useState(false);

  useEffect(() => {
    setCurrentHelpContent({
      title: 'BAS Lodgment',
      purpose: 'BAS lodgment cockpit providing go/no-go decision support. Verify all obligations are ready, funding is sufficient, and evidence packs are complete before lodging.',
      requiredInputs: ['Select period for lodgment', 'Resolve all blockers', 'Ensure 100% funding coverage'],
      definitions: {
        'Ready to Lodge': 'All obligations completed, full funding coverage, evidence packs verified',
        'Blocked': 'One or more blockers prevent lodgment - must be resolved before proceeding',
        'Funding Coverage': 'Percentage of tax liability secured in segregated accounts (target: 100%)',
      },
      commonMistakes: ['Lodging with unresolved blockers', 'Insufficient funding in segregated accounts', 'Missing or unverified evidence packs'],
      outputs: ['BAS lodgment confirmation', 'Evidence pack for audit trail', 'Updated obligation statuses'],
      nextStep: 'Resolve all blockers, then click "Lodge BAS" to submit.',
      atoReferences: [
        {
          title: 'BAS Lodgment Due Dates',
          url: 'https://www.ato.gov.au/business/business-activity-statements-bas-/lodging-and-paying-your-bas/bas-due-dates',
          description: 'Official ATO calendar for BAS lodgment deadlines'
        },
        {
          title: 'BAS Payment Options',
          url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/paying/payment-options',
          description: 'How to pay your BAS electronically or by other methods'
        },
        {
          title: 'General Interest Charge (GIC)',
          url: 'https://www.ato.gov.au/Rates/General-interest-charge-GIC/',
          description: 'Interest charged on late or unpaid tax liabilities'
        },
        {
          title: 'Failure to Lodge Penalty',
          url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/penalties-and-interest/failure-to-lodge-on-time-penalty',
          description: 'Penalties for failing to lodge BAS by the due date'
        },
      ],
    });
  }, [setCurrentHelpContent]);

  // Get BAS readiness for selected period
  const readiness = generateMockBASReadiness(selectedPeriodId);
  
  // Get obligations for this period
  const periodObligations = obligations.filter(
    o => o.organizationId === currentOrganizationId && o.period === periods.find(p => p.id === selectedPeriodId)?.label
  );

  const handleLodge = async () => {
    setIsLodging(true);
    
    // Simulate lodgment process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Update all period obligations to submitted
    periodObligations.forEach(obl => {
      if (obl.status !== 'completed') {
        updateObligation(obl.id, { status: 'submitted' });
      }
    });

    // Create evidence pack if doesn't exist
    const existingPack = evidencePacks.find(p => p.periodId === selectedPeriodId);
    if (!existingPack) {
      const pack = createEvidencePack({
        name: `BAS ${periods.find(p => p.id === selectedPeriodId)?.label} Evidence Pack`,
        periodId: selectedPeriodId,
        organizationId: currentOrganizationId,
        obligationIds: periodObligations.map(o => o.id),
      });
      generateEvidence(pack.id);
    }

    // Add audit event
    addAuditEvent({
      type: 'lodge',
      entityType: 'BAS',
      entityId: selectedPeriodId,
      userId: 'current-user',
      userName: 'Current User',
      description: `Lodged BAS for ${periods.find(p => p.id === selectedPeriodId)?.label}`,
    });

    setIsLodging(false);
    setShowLodgeConfirm(false);
    toast.success('BAS lodged successfully!');
    
    // Navigate to evidence packs
    setTimeout(() => navigate('/evidence-packs'), 1000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">BAS Lodgment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify readiness and lodge Business Activity Statement
          </p>
        </div>

        <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {periods.map(period => (
              <SelectItem key={period.id} value={period.id}>
                {period.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Readiness Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lodgment Readiness</CardTitle>
              <CardDescription>
                {periods.find(p => p.id === selectedPeriodId)?.label} BAS Status
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {readiness.ready ? (
                <>
                  <CheckCircle2 className="h-6 w-6 text-success" />
                  <StatusChip status="approved" />
                </>
              ) : (
                <>
                  <AlertTriangle className="h-6 w-6 text-warning" />
                  <StatusChip status="pending" />
                </>
              )}
            </div>
          </div>
        </CardHeader>
        {!readiness.ready && readiness.blockers.length > 0 && (
          <CardContent>
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-destructive">Blockers</h4>
              <ul className="space-y-1">
                {readiness.blockers.map((blocker, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                    {blocker}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Funding Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Funding Coverage
          </CardTitle>
          <CardDescription>Segregated account balances vs. obligations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">PAYGW Coverage</span>
              <span className="text-sm font-medium">{readiness.fundingStatus.paygwCoverage.toFixed(1)}%</span>
            </div>
            <Progress value={readiness.fundingStatus.paygwCoverage} className="h-2" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">GST Coverage</span>
              <span className="text-sm font-medium">{readiness.fundingStatus.gstCoverage.toFixed(1)}%</span>
            </div>
            <Progress value={readiness.fundingStatus.gstCoverage} className="h-2" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">SG Coverage</span>
              <span className="text-sm font-medium">{readiness.fundingStatus.sgCoverage.toFixed(1)}%</span>
            </div>
            <Progress value={readiness.fundingStatus.sgCoverage} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Obligations Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            Obligations Summary
          </CardTitle>
          <CardDescription>{periodObligations.length} obligations for this period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{readiness.obligationsSummary.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">{readiness.obligationsSummary.completed}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">{readiness.obligationsSummary.pending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-destructive">{readiness.obligationsSummary.overdue}</div>
              <div className="text-xs text-muted-foreground">Overdue</div>
            </div>
          </div>

          {/* Obligations List */}
          <div className="mt-6 space-y-2">
            {periodObligations.map(obl => (
              <div
                key={obl.id}
                className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/obligations/${obl.id}`)}
              >
                <div className="flex-1">
                  <div className="font-medium">{obl.title}</div>
                  <div className="text-sm text-muted-foreground">
                    Due: {new Date(obl.dueDate).toLocaleDateString()} • ${obl.amount.toLocaleString()}
                  </div>
                </div>
                <StatusChip status={obl.status} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lodge Button */}
      <div className="flex items-center justify-between p-6 border rounded-lg bg-card">
        <div>
          <h3 className="font-medium">Ready to Lodge?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {readiness.ready 
              ? 'All checks passed. You can proceed with BAS lodgment.' 
              : 'Resolve all blockers before lodging.'}
          </p>
        </div>
        <Button
          size="lg"
          disabled={!readiness.ready || !canLodge || isLodging}
          onClick={() => setShowLodgeConfirm(true)}
        >
          {isLodging ? 'Lodging...' : 'Lodge BAS'}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showLodgeConfirm} onOpenChange={setShowLodgeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm BAS Lodgment</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to lodge BAS for {periods.find(p => p.id === selectedPeriodId)?.label}.
              This will:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Mark all period obligations as submitted</li>
                <li>Generate an evidence pack for audit trail</li>
                <li>Create an audit event</li>
              </ul>
              <p className="mt-3 font-medium">Are you sure you want to proceed?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLodge} disabled={isLodging}>
              {isLodging ? 'Lodging...' : 'Confirm Lodge'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
