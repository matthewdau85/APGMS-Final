import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Progress } from '../components/ui/progress';
import { EmptyState } from '../components/EmptyState';
import { CheckCircle2, GitMerge, X, ArrowRight, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export const Reconciliation = () => {
  const { setCurrentHelpContent } = useApp();
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const {
    transactions,
    obligations,
    reconciliationMatches,
    createReconciliationMatch,
    approveReconciliation,
    rejectReconciliation,
    currentOrganizationId,
  } = useAppStore();

  const [showManualMatch, setShowManualMatch] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [selectedObligation, setSelectedObligation] = useState<string>('');
  const [isRunningMatch, setIsRunningMatch] = useState(false);

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Reconciliation',
      purpose: 'Automated matching engine that links bank transactions to tax obligations. Ensures every dollar is tracked and properly allocated to PAYGW, GST, or SG obligations.',
      requiredInputs: ['Bank transaction data', 'Obligation records', 'Confidence threshold for auto-matching'],
      definitions: {
        'Suggested Match': 'AI-suggested link between transaction and obligation based on amount, date, description',
        'Confidence Score': 'Percentage indicating how likely the match is correct (>90% is high confidence)',
        'Coverage': 'Percentage of transactions successfully reconciled to obligations',
      },
      commonMistakes: [
        'Rejecting high-confidence matches without review',
        'Not investigating unmatched transactions',
        'Creating duplicate manual matches',
      ],
      outputs: ['Reconciled transactions', 'Updated obligation statuses', 'Coverage metrics'],
      nextStep: 'Review suggested matches, approve high-confidence matches, investigate low-confidence or unmatched transactions.',
      atoReferences: [
        {
          title: 'Recordkeeping for Tax',
          url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/records-you-need-to-keep',
          description: 'Requirements for keeping transaction records'
        },
        {
          title: 'Business Bank Account',
          url: 'https://www.ato.gov.au/businesses-and-organisations/starting-your-business/getting-started/business-bank-account',
          description: 'Guidance on separating business and personal finances'
        },
      ],
    });
  }, [setCurrentHelpContent]);

  // Filter for current org
  const orgTransactions = transactions.filter(t => t.organizationId === currentOrganizationId);
  const orgObligations = obligations.filter(o => o.organizationId === currentOrganizationId);

  // Unmatched transactions
  const unmatchedTransactions = orgTransactions.filter(t => !t.reconciled);

  // Calculate coverage
  const totalTransactions = orgTransactions.length;
  const reconciledCount = orgTransactions.filter(t => t.reconciled).length;
  const coveragePercent = totalTransactions > 0 ? (reconciledCount / totalTransactions) * 100 : 0;

  const handleRunMatching = async () => {
    setIsRunningMatch(true);
    
    // Simulate AI matching algorithm
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let matchedCount = 0;
    unmatchedTransactions.forEach(txn => {
      // Simple matching logic: find obligation with similar amount
      const matchingObl = orgObligations.find(obl => 
        Math.abs(obl.amount - Math.abs(txn.amount)) < 100 && !obl.linkedTransactionIds?.includes(txn.id)
      );
      
      if (matchingObl) {
        // Create suggested match with confidence score
        const amountDiff = Math.abs(matchingObl.amount - Math.abs(txn.amount));
        const confidence = Math.max(50, 100 - (amountDiff / matchingObl.amount) * 100);
        
        createReconciliationMatch({
          bankTransactionId: txn.id,
          obligationId: matchingObl.id,
          confidence: Math.round(confidence),
          status: 'suggested',
        });
        
        matchedCount++;
      }
    });
    
    setIsRunningMatch(false);
    toast.success(`Found ${matchedCount} potential matches`);
  };

  const handleApprove = (matchId: string) => {
    approveReconciliation(matchId, 'Current User');
    toast.success('Match approved and reconciled');
  };

  const handleReject = (matchId: string) => {
    rejectReconciliation(matchId);
    toast.info('Match rejected');
  };

  const handleManualMatch = () => {
    if (!selectedTransaction || !selectedObligation) {
      toast.error('Please select both transaction and obligation');
      return;
    }

    createReconciliationMatch({
      bankTransactionId: selectedTransaction,
      obligationId: selectedObligation,
      confidence: 100,
      status: 'manual',
    });

    approveReconciliation(
      reconciliationMatches[reconciliationMatches.length - 1]?.id || 'manual',
      'Current User'
    );

    toast.success('Manual match created and approved');
    setShowManualMatch(false);
    setSelectedTransaction(null);
    setSelectedObligation('');
  };

  // Suggested matches to review
  const suggestedMatches = reconciliationMatches.filter(m => m.status === 'suggested');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reconciliation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Match bank transactions to tax obligations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setShowManualMatch(true)}>
                Create Manual Match
              </Button>
              <Button onClick={handleRunMatching} disabled={isRunningMatch || unmatchedTransactions.length === 0}>
                {isRunningMatch ? 'Matching...' : 'Run Auto-Match'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Coverage Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Coverage</CardDescription>
            <CardTitle className="text-3xl">{coveragePercent.toFixed(1)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={coveragePercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {reconciledCount} of {totalTransactions} transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unmatched</CardDescription>
            <CardTitle className="text-3xl">{unmatchedTransactions.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Transactions requiring attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Review</CardDescription>
            <CardTitle className="text-3xl">{suggestedMatches.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              AI-suggested matches awaiting approval
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Suggested Matches */}
      {suggestedMatches.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Suggested Matches</h2>
          {suggestedMatches.map((match) => {
            const txn = orgTransactions.find(t => t.id === match.bankTransactionId);
            const obl = orgObligations.find(o => o.id === match.obligationId);
            
            if (!txn || !obl) return null;

            return (
              <Card key={match.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="font-medium">{txn.description}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {new Date(txn.date).toLocaleDateString()} • ${Math.abs(txn.amount).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        match.confidence >= 90 ? 'bg-success/10 text-success' :
                        match.confidence >= 70 ? 'bg-warning/10 text-warning' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {match.confidence}% match
                      </div>
                    </div>

                    <ArrowRight className="h-4 w-4 text-muted-foreground" />

                    <div className="flex-1">
                      <div className="font-medium">{obl.title}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {obl.type} • ${obl.amount.toLocaleString()}
                      </div>
                    </div>

                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(match.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleApprove(match.id)}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Unmatched Transactions */}
      {unmatchedTransactions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Unmatched Transactions</h2>
          <div className="border rounded-lg divide-y">
            {unmatchedTransactions.map((txn) => (
              <div key={txn.id} className="p-4 flex items-center justify-between hover:bg-muted/50">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-warning" />
                  <div>
                    <div className="font-medium">{txn.description}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(txn.date).toLocaleDateString()} • {txn.category}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-medium">
                    ${Math.abs(txn.amount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </div>
                  {canEdit && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedTransaction(txn.id);
                        setShowManualMatch(true);
                      }}
                      className="mt-1"
                    >
                      Match manually
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {unmatchedTransactions.length === 0 && suggestedMatches.length === 0 && (
        <EmptyState
          icon={GitMerge}
          title="All transactions reconciled"
          description="Great work! All bank transactions have been matched to obligations."
        />
      )}

      {/* Manual Match Dialog */}
      <Dialog open={showManualMatch} onOpenChange={setShowManualMatch}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Manual Match</DialogTitle>
            <DialogDescription>
              Link a bank transaction to a tax obligation manually.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Bank Transaction</label>
              <Select value={selectedTransaction || ''} onValueChange={setSelectedTransaction}>
                <SelectTrigger>
                  <SelectValue placeholder="Select transaction..." />
                </SelectTrigger>
                <SelectContent>
                  {unmatchedTransactions.map((txn) => (
                    <SelectItem key={txn.id} value={txn.id}>
                      {txn.description} - ${Math.abs(txn.amount).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Tax Obligation</label>
              <Select value={selectedObligation} onValueChange={setSelectedObligation}>
                <SelectTrigger>
                  <SelectValue placeholder="Select obligation..." />
                </SelectTrigger>
                <SelectContent>
                  {orgObligations.map((obl) => (
                    <SelectItem key={obl.id} value={obl.id}>
                      {obl.title} - ${obl.amount.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowManualMatch(false)}>Cancel</Button>
            <Button onClick={handleManualMatch}>Create Match</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
