import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, CheckCircle2, Edit, Archive, FileText, Calendar } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { StatusChip } from '../components/StatusChip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { EmptyState } from '../components/EmptyState';
import { toast } from 'sonner';
import { downloadJSON } from '../lib/download';

export const ObligationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setCurrentHelpContent } = useApp();
  const { canEdit, canLodge } = useAuth();
  const {
    obligations,
    updateObligation,
    createEvidencePack,
    generateEvidence,
    transactions,
    ledgerEntries,
    evidencePacks,
    auditEvents,
  } = useAppStore();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    amount: '',
    dueDate: '',
  });

  const obligation = obligations.find(o => o.id === id);

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Obligation Details',
      purpose: 'View comprehensive details for a specific tax obligation including amounts, dates, status, transaction history, and supporting documentation.',
      requiredInputs: [
        'Complete all required fields before submission',
        'Attach supporting documentation',
        'Verify amounts match ledger records',
      ],
      definitions: {
        'Lodgment': 'Official submission of the obligation to the ATO',
        'Payment Reference': 'Unique identifier for payment tracking',
        'Audit Trail': 'Complete record of all changes and actions',
      },
      commonMistakes: [
        'Submitting without final reconciliation',
        'Missing required supporting documents',
        'Not verifying payment confirmation',
      ],
      outputs: [
        'Complete obligation record',
        'Payment confirmation',
        'Evidence pack generation',
      ],
      nextStep: 'Review all details, complete any pending actions, then proceed to lodge or pay.',
      atoReferences: [
        {
          title: 'Lodgment Options',
          url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/how-to-lodge',
          description: 'Methods for lodging tax obligations with the ATO'
        },
      ],
    });
  }, [setCurrentHelpContent]);

  useEffect(() => {
    if (obligation) {
      setEditFormData({
        title: obligation.title,
        amount: obligation.amount.toString(),
        dueDate: obligation.dueDate,
      });
    }
  }, [obligation]);

  if (!obligation) {
    return (
      <div className="p-6">
        <EmptyState
          icon={FileText}
          title="Obligation not found"
          description="The requested obligation could not be found."
        />
        <Button onClick={() => navigate('/obligations')} className="mt-4">
          Back to Obligations
        </Button>
      </div>
    );
  }

  // Get linked transactions
  const linkedTransactions = transactions.filter(t => 
    obligation.linkedTransactionIds?.includes(t.id)
  );

  // Get linked ledger entries
  const linkedLedgerEntries = ledgerEntries.filter(e => 
    e.obligationId === obligation.id
  );

  // Get evidence packs
  const relatedPacks = evidencePacks.filter(p => 
    p.obligationIds.includes(obligation.id)
  );

  // Get audit trail
  const obligationAuditEvents = auditEvents
    .filter(e => e.entityType === 'Obligation' && e.entityId === obligation.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const handleEdit = () => {
    if (!editFormData.title || !editFormData.amount || !editFormData.dueDate) {
      toast.error('Please fill in all fields');
      return;
    }

    updateObligation(obligation.id, {
      title: editFormData.title,
      amount: parseFloat(editFormData.amount),
      dueDate: editFormData.dueDate,
    });

    toast.success('Obligation updated');
    setShowEditDialog(false);
  };

  const handleMarkComplete = () => {
    updateObligation(obligation.id, { status: 'completed' });
    toast.success('Obligation marked as complete');
  };

  const handleGeneratePack = () => {
    const pack = createEvidencePack({
      name: `Evidence Pack - ${obligation.title}`,
      periodId: obligation.id,
      organizationId: obligation.organizationId,
      obligationIds: [obligation.id],
    });

    generateEvidence(pack.id);
    toast.success('Generating evidence pack...');
    setTimeout(() => navigate('/evidence-packs'), 1000);
  };

  const handleChecklistToggle = (index: number) => {
    if (!canEdit) return;
    
    const newChecklist = [...(obligation.checklist || [])];
    newChecklist[index] = { ...newChecklist[index], completed: !newChecklist[index].completed };
    
    updateObligation(obligation.id, { checklist: newChecklist });
    toast.success(newChecklist[index].completed ? 'Item completed' : 'Item unchecked');
  };

  const handleExportAudit = () => {
    downloadJSON(obligationAuditEvents, `audit-trail-${obligation.id}.json`);
    toast.success('Audit trail exported');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/obligations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{obligation.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Obligation ID: {obligation.id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
                <Edit className="h-4 w-4" />
                Edit
              </Button>
              {obligation.status !== 'completed' && obligation.status !== 'submitted' && (
                <Button variant="outline" size="sm" onClick={handleMarkComplete}>
                  <CheckCircle2 className="h-4 w-4" />
                  Mark Complete
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleGeneratePack}>
                <Archive className="h-4 w-4" />
                Generate Pack
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAuditDrawer(true)}>
            Audit Trail
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Status</p>
          <div className="mt-2">
            <StatusChip status={obligation.status} />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Due Date</p>
          <p className="text-lg font-semibold mt-2">{new Date(obligation.dueDate).toLocaleDateString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Amount</p>
          <p className="text-lg font-semibold mt-2">${obligation.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Period</p>
          <p className="text-lg font-semibold mt-2">{obligation.period}</p>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Type</p>
                <p className="font-medium mt-1">{obligation.type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Assignee</p>
                <p className="font-medium mt-1">{obligation.assignee}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium mt-1">{new Date(obligation.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Updated</p>
                <p className="font-medium mt-1">{new Date(obligation.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
            {obligation.description && (
              <div className="mt-4">
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="mt-1">{obligation.description}</p>
              </div>
            )}
          </Card>

          {/* Checklist */}
          {obligation.checklist && obligation.checklist.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold mb-4">Checklist</h3>
              <div className="space-y-3">
                {obligation.checklist.map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <Checkbox
                      checked={item.completed}
                      onCheckedChange={() => handleChecklistToggle(index)}
                      disabled={!canEdit}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <p className={`font-medium ${item.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {item.label}
                      </p>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-6">
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Linked Transactions</h3>
            {linkedTransactions.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No linked transactions"
                description="No bank transactions have been matched to this obligation yet."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Category</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedTransactions.map(txn => (
                    <TableRow key={txn.id}>
                      <TableCell>{new Date(txn.date).toLocaleDateString()}</TableCell>
                      <TableCell>{txn.description}</TableCell>
                      <TableCell className="text-right font-mono">
                        ${Math.abs(txn.amount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{txn.category}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Ledger Entries</h3>
            {linkedLedgerEntries.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No ledger entries"
                description="No ledger entries linked to this obligation."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linkedLedgerEntries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.debit > 0 ? `$${entry.debit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {entry.credit > 0 ? `$${entry.credit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${entry.balance.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Evidence Packs</h3>
              {canEdit && (
                <Button size="sm" onClick={handleGeneratePack}>
                  <Archive className="h-4 w-4" />
                  Generate Draft
                </Button>
              )}
            </div>
            {relatedPacks.length === 0 ? (
              <EmptyState
                icon={Archive}
                title="No evidence packs"
                description="No evidence packs have been generated for this obligation."
              />
            ) : (
              <div className="space-y-3">
                {relatedPacks.map(pack => (
                  <div
                    key={pack.id}
                    className="p-4 border rounded-lg cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate('/evidence-packs')}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{pack.name}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Created {new Date(pack.createdAt).toLocaleDateString()} • {pack.items.length} items
                        </p>
                      </div>
                      <StatusChip status={pack.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Audit Events</h3>
              <Button size="sm" variant="outline" onClick={handleExportAudit}>
                <Download className="h-4 w-4" />
                Export JSON
              </Button>
            </div>
            {obligationAuditEvents.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No audit events"
                description="No audit events recorded for this obligation."
              />
            ) : (
              <div className="space-y-3">
                {obligationAuditEvents.map(event => (
                  <div key={event.id} className="p-4 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{event.type}</p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">By {event.userName}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Obligation</DialogTitle>
            <DialogDescription>Update obligation details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-amount">Amount ($)</Label>
              <Input
                id="edit-amount"
                type="number"
                step="0.01"
                value={editFormData.amount}
                onChange={(e) => setEditFormData({ ...editFormData, amount: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-dueDate">Due Date</Label>
              <Input
                id="edit-dueDate"
                type="date"
                value={editFormData.dueDate}
                onChange={(e) => setEditFormData({ ...editFormData, dueDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Trail Drawer */}
      <Sheet open={showAuditDrawer} onOpenChange={setShowAuditDrawer}>
        <SheetContent className="sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Audit Trail</SheetTitle>
            <SheetDescription>Complete history of changes and actions</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {obligationAuditEvents.map(event => (
              <div key={event.id} className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-sm">{event.type}</p>
                  <span className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{event.description}</p>
                <p className="text-xs text-muted-foreground mt-1">By {event.userName}</p>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
