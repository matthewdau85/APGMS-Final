import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Filter, Download, Search, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { StatusChip } from '../components/StatusChip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { EmptyState } from '../components/EmptyState';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { downloadCSV, downloadJSON } from '../lib/download';
import type { ObligationType } from '../types';

export const Obligations = () => {
  const { setCurrentHelpContent } = useApp();
  const { canCreate, isReadOnly } = useAuth();
  const navigate = useNavigate();
  const {
    obligations,
    createObligation,
    updateObligation,
    currentOrganizationId,
    currentPeriodId,
    periods,
  } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: 'PAYGW' as ObligationType,
    dueDate: '',
    amount: '',
    period: '',
  });

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Obligations Management',
      purpose: 'View, filter, and manage all tax obligations across PAYGW, GST, BAS, and other Australian tax requirements. Track status, due dates, and amounts for compliance reporting.',
      requiredInputs: [
        'Obligation type (PAYGW, GST, BAS, SG)',
        'Due date',
        'Amount (if applicable)',
        'Reporting period',
      ],
      definitions: {
        'PAYGW': 'Pay As You Go Withholding - tax withheld from payments to employees',
        'GST': 'Goods and Services Tax - 10% tax on most goods and services',
        'BAS': 'Business Activity Statement - periodic tax reporting to ATO',
        'SG': 'Superannuation Guarantee - mandatory employer retirement contributions',
      },
      commonMistakes: [
        'Missing statutory due dates - always submit 1-2 days early',
        'Incorrect reporting period assignment',
        'Not reconciling amounts with ledger before submission',
        'Failing to maintain evidence trail for completed obligations',
      ],
      outputs: [
        'Filtered list of obligations by status, type, or period',
        'Due date alerts and reminders',
        'Compliance status overview',
        'Export capability for auditing',
      ],
      nextStep: 'Click on any obligation to view details, or use "Create Obligation" to add a new tax obligation manually.',
      atoReferences: [
        {
          title: 'PAYGW Overview',
          url: 'https://www.ato.gov.au/businesses-and-organisations/hiring-and-paying-your-workers/pay-as-you-go-paygw-withholding',
          description: 'Complete guide to PAYGW obligations and reporting'
        },
        {
          title: 'GST Basics',
          url: 'https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/goods-and-services-tax-gst',
          description: 'Understanding GST requirements and lodgment'
        },
        {
          title: 'BAS Lodgment',
          url: 'https://www.ato.gov.au/business/business-activity-statements-bas-',
          description: 'Business Activity Statement requirements and due dates'
        },
      ],
    });
  }, [setCurrentHelpContent]);

  // Filter obligations for current org
  const orgObligations = obligations.filter(o => o.organizationId === currentOrganizationId);

  const filteredObligations = orgObligations.filter((obl) => {
    const matchesSearch = obl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obl.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || obl.status === statusFilter;
    const matchesType = typeFilter === 'all' || obl.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleCreate = () => {
    if (!formData.title || !formData.dueDate || !formData.amount || !formData.period) {
      toast.error('Please fill in all fields');
      return;
    }

    const newObl = createObligation({
      title: formData.title,
      type: formData.type,
      dueDate: formData.dueDate,
      amount: parseFloat(formData.amount),
      period: formData.period,
      status: 'draft',
      assignee: 'Current User',
      organizationId: currentOrganizationId,
      description: '',
    });

    toast.success('Obligation created');
    setShowCreateDialog(false);
    setFormData({ title: '', type: 'PAYGW', dueDate: '', amount: '', period: '' });
    navigate(`/obligations/${newObl.id}`);
  };

  const handleAssignToMe = (oblId: string) => {
    updateObligation(oblId, { assignee: 'Current User' });
    toast.success('Obligation assigned to you');
  };

  const handleExportCSV = () => {
    const data = filteredObligations.map(obl => ({
      ID: obl.id,
      Title: obl.title,
      Type: obl.type,
      Period: obl.period,
      DueDate: obl.dueDate,
      Amount: obl.amount,
      Status: obl.status,
      Assignee: obl.assignee,
    }));
    downloadCSV(data, 'obligations.csv');
    toast.success('Obligations exported to CSV');
  };

  const handleExportJSON = () => {
    downloadJSON(filteredObligations, 'obligations.json');
    toast.success('Obligations exported to JSON');
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Obligations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track all tax obligations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportJSON}>
            <Download className="h-4 w-4" />
            JSON
          </Button>
          {canCreate && (
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              Create Obligation
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by ID or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="PAYGW">PAYGW</SelectItem>
              <SelectItem value="GST">GST</SelectItem>
              <SelectItem value="BAS">BAS</SelectItem>
              <SelectItem value="SG">SG</SelectItem>
            </SelectContent>
          </Select>

          <div className="text-sm text-muted-foreground">
            {filteredObligations.length} obligation{filteredObligations.length !== 1 ? 's' : ''}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        {filteredObligations.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No obligations found"
            description="No obligations match your current filters. Try adjusting your search criteria or create a new obligation."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Obligation</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assignee</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredObligations.map((obligation) => (
                <TableRow 
                  key={obligation.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`/obligations/${obligation.id}`)}
                >
                  <TableCell>
                    <span className="font-mono text-xs text-muted-foreground">
                      {obligation.id}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{obligation.title}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{obligation.type}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{obligation.period}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{new Date(obligation.dueDate).toLocaleDateString()}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm">
                      ${obligation.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={obligation.status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{obligation.assignee}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {!isReadOnly && obligation.assignee !== 'Current User' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignToMe(obligation.id);
                          }}
                        >
                          <UserPlus className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Obligation</DialogTitle>
            <DialogDescription>
              Add a new tax obligation to the system
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., PAYGW Monthly Remittance - January 2026"
              />
            </div>
            <div>
              <Label htmlFor="type">Type</Label>
              <Select value={formData.type} onValueChange={(val: ObligationType) => setFormData({ ...formData, type: val })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAYGW">PAYGW</SelectItem>
                  <SelectItem value="GST">GST</SelectItem>
                  <SelectItem value="BAS">BAS</SelectItem>
                  <SelectItem value="SG">Superannuation Guarantee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="period">Period</Label>
              <Select value={formData.period} onValueChange={(val) => setFormData({ ...formData, period: val })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period..." />
                </SelectTrigger>
                <SelectContent>
                  {periods.map(p => (
                    <SelectItem key={p.id} value={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Obligation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
