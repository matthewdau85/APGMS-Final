import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { EmptyState } from '../components/EmptyState';
import { Download, Plus, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { downloadCSV, downloadJSON } from '../lib/download';

export const Ledger = () => {
  const { setCurrentHelpContent } = useApp();
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const { ledgerEntries, createLedgerEntry, currentOrganizationId, currentPeriodId, periods } = useAppStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    description: '',
    debit: '',
    credit: '',
    category: 'Tax Liability',
  });

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Ledger',
      purpose: 'General ledger tracking all financial transactions related to tax obligations. Provides complete audit trail and running balance for segregated accounts.',
      requiredInputs: ['Transaction description', 'Debit or credit amount', 'Category classification'],
      definitions: {
        'Debit': 'Money leaving the account (expenses, tax payments)',
        'Credit': 'Money entering the account (revenue, receipts)',
        'Running Balance': 'Cumulative balance after each transaction',
        'Category': 'Classification for reporting (Revenue, Tax Liability, Expenses, etc.)',
      },
      commonMistakes: [
        'Confusing debit and credit directions',
        'Not categorizing entries properly',
        'Creating duplicate entries for the same transaction'
      ],
      outputs: ['Ledger entry records', 'Running balance', 'Exportable CSV/JSON for reconciliation'],
      nextStep: 'Review ledger entries regularly and export for month-end reconciliation.',
      atoReferences: [
        {
          title: 'Recordkeeping Requirements',
          url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/records-you-need-to-keep',
          description: 'ATO requirements for keeping business records'
        },
        {
          title: 'Tax and Super Simplified',
          url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/simplified-accounting-method',
          description: 'Simplified accounting methods for small businesses'
        },
      ],
    });
  }, [setCurrentHelpContent]);

  // Filter entries for current org and period
  const currentPeriod = periods.find(p => p.id === currentPeriodId);
  const filteredEntries = ledgerEntries
    .filter(entry => {
      if (entry.organizationId !== currentOrganizationId) return false;
      if (currentPeriod) {
        const entryDate = new Date(entry.date);
        const periodStart = new Date(currentPeriod.startDate);
        const periodEnd = new Date(currentPeriod.endDate);
        return entryDate >= periodStart && entryDate <= periodEnd;
      }
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleCreate = () => {
    const debit = parseFloat(formData.debit) || 0;
    const credit = parseFloat(formData.credit) || 0;

    if (debit === 0 && credit === 0) {
      toast.error('Please enter either a debit or credit amount');
      return;
    }

    if (debit > 0 && credit > 0) {
      toast.error('Enter either debit OR credit, not both');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('Please enter a description');
      return;
    }

    createLedgerEntry({
      date: new Date().toISOString().split('T')[0],
      description: formData.description,
      debit,
      credit,
      category: formData.category,
      organizationId: currentOrganizationId,
      createdBy: 'Current User',
    });

    toast.success('Ledger entry created');
    setShowCreateDialog(false);
    setFormData({ description: '', debit: '', credit: '', category: 'Tax Liability' });
  };

  const handleExportCSV = () => {
    const data = filteredEntries.map(entry => ({
      Date: entry.date,
      Description: entry.description,
      Category: entry.category,
      Debit: entry.debit,
      Credit: entry.credit,
      Balance: entry.balance,
    }));
    downloadCSV(data, `ledger-${currentPeriod?.label || 'all'}.csv`);
    toast.success('Ledger exported to CSV');
  };

  const handleExportJSON = () => {
    downloadJSON(filteredEntries, `ledger-${currentPeriod?.label || 'all'}.json`);
    toast.success('Ledger exported to JSON');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">General Ledger</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Complete financial transaction history for {currentPeriod?.label || 'all periods'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handleExportJSON}>
            <Download className="h-4 w-4" />
            Export JSON
          </Button>
          {canEdit && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4" />
                  Manual Adjustment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Manual Ledger Entry</DialogTitle>
                  <DialogDescription>
                    Add a manual adjustment to the ledger. Enter either debit or credit, not both.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Manual adjustment for..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Revenue">Revenue</SelectItem>
                        <SelectItem value="Tax Liability">Tax Liability</SelectItem>
                        <SelectItem value="Expenses">Expenses</SelectItem>
                        <SelectItem value="Adjustment">Adjustment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="debit">Debit ($)</Label>
                      <Input
                        id="debit"
                        type="number"
                        step="0.01"
                        value={formData.debit}
                        onChange={(e) => setFormData({ ...formData, debit: e.target.value, credit: '' })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="credit">Credit ($)</Label>
                      <Input
                        id="credit"
                        type="number"
                        step="0.01"
                        value={formData.credit}
                        onChange={(e) => setFormData({ ...formData, credit: e.target.value, debit: '' })}
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                  <Button onClick={handleCreate}>Create Entry</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      {filteredEntries.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No ledger entries"
          description="No transactions found for this period."
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-sm">
                    {new Date(entry.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{entry.description}</div>
                      {entry.obligationId && (
                        <button
                          onClick={() => navigate(`/obligations/${entry.obligationId}`)}
                          className="text-xs text-primary hover:underline mt-0.5"
                        >
                          View obligation →
                        </button>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.category}</TableCell>
                  <TableCell className="text-right font-mono">
                    {entry.debit > 0 ? `$${entry.debit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {entry.credit > 0 ? `$${entry.credit.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium">
                    ${entry.balance.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary Stats */}
      {filteredEntries.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Total Debits</div>
            <div className="text-2xl font-bold text-destructive mt-1">
              ${filteredEntries.reduce((sum, e) => sum + e.debit, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Total Credits</div>
            <div className="text-2xl font-bold text-success mt-1">
              ${filteredEntries.reduce((sum, e) => sum + e.credit, 0).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Current Balance</div>
            <div className="text-2xl font-bold mt-1">
              ${filteredEntries[0]?.balance.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
