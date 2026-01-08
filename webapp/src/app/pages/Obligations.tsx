import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Filter, Download, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { StatusChip } from '../components/StatusChip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { EmptyState } from '../components/EmptyState';
import { FileText } from 'lucide-react';

const obligations = [
  {
    id: 'OBL-001',
    title: 'PAYGW Monthly Remittance - December 2025',
    type: 'PAYGW',
    dueDate: '2026-01-07',
    status: 'overdue' as const,
    amount: 45230.50,
    period: 'December 2025',
    assignee: 'Operator',
  },
  {
    id: 'OBL-002',
    title: 'GST Return - Q4 2025',
    type: 'GST',
    dueDate: '2026-01-15',
    status: 'pending' as const,
    amount: 123456.78,
    period: 'Q4 2025',
    assignee: 'Admin',
  },
  {
    id: 'OBL-003',
    title: 'BAS Statement Reconciliation',
    type: 'BAS',
    dueDate: '2026-01-20',
    status: 'active' as const,
    amount: 87654.32,
    period: 'Q4 2025',
    assignee: 'Operator',
  },
  {
    id: 'OBL-004',
    title: 'Superannuation Guarantee Contribution',
    type: 'SG',
    dueDate: '2026-01-28',
    status: 'pending' as const,
    amount: 34567.89,
    period: 'Q4 2025',
    assignee: 'Operator',
  },
  {
    id: 'OBL-005',
    title: 'PAYGW Withholding Verification',
    type: 'PAYGW',
    dueDate: '2026-01-25',
    status: 'active' as const,
    amount: 56789.12,
    period: 'December 2025',
    assignee: 'Operator',
  },
  {
    id: 'OBL-006',
    title: 'GST Payment - November 2025',
    type: 'GST',
    dueDate: '2025-12-21',
    status: 'completed' as const,
    amount: 98765.43,
    period: 'November 2025',
    assignee: 'Admin',
  },
];

export const Obligations: React.FC = () => {
  const { setCurrentHelpContent } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

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
    });
  }, [setCurrentHelpContent]);

  const filteredObligations = obligations.filter((obl) => {
    const matchesSearch = obl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obl.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || obl.status === statusFilter;
    const matchesType = typeFilter === 'all' || obl.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Obligations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and track all tax obligations
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Link to="/obligations/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Obligation
            </Button>
          </Link>
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
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
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
        </div>
      </Card>

      {/* Table */}
      <Card>
        {filteredObligations.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No obligations found"
            description="No obligations match your current filters. Try adjusting your search criteria or create a new obligation."
            action={{
              label: 'Create Obligation',
              onClick: () => {},
            }}
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
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredObligations.map((obligation) => (
                <TableRow key={obligation.id}>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">
                      {obligation.id}
                    </span>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{obligation.title}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">{obligation.type}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">{obligation.period}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">{obligation.dueDate}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-sm text-foreground">
                      ${obligation.amount.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={obligation.status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">{obligation.assignee}</span>
                  </TableCell>
                  <TableCell>
                    <Link to={`/obligations/${obligation.id}`}>
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
};
