import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Download, Archive } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { StatusChip } from '../components/StatusChip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const evidencePacks = [
  {
    id: 'EP-2025-12-001',
    title: 'PAYGW Dec 2025 Evidence Pack',
    obligationId: 'OBL-001',
    createdDate: '2025-12-28',
    status: 'draft' as const,
    documentsCount: 12,
    createdBy: 'Operator',
  },
  {
    id: 'EP-2025-11-015',
    title: 'GST Q4 2025 Audit Trail',
    obligationId: 'OBL-002',
    createdDate: '2025-11-30',
    status: 'submitted' as const,
    documentsCount: 24,
    createdBy: 'Admin',
  },
  {
    id: 'EP-2025-11-008',
    title: 'BAS Nov 2025 Evidence',
    obligationId: 'OBL-006',
    createdDate: '2025-11-22',
    status: 'approved' as const,
    documentsCount: 18,
    createdBy: 'Operator',
  },
];

export const EvidencePacks: React.FC = () => {
  const { setCurrentHelpContent } = useApp();

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Evidence Pack Management',
      purpose: 'Evidence Packs are comprehensive documentation packages that provide an audit trail for completed tax obligations. They include all supporting documents, calculations, reconciliations, and approvals required for regulatory compliance and internal audits.',
      requiredInputs: [
        'Related obligation reference',
        'All source documents (invoices, receipts, statements)',
        'Reconciliation reports',
        'Payment confirmations',
        'Approval signatures',
      ],
      definitions: {
        'Evidence Pack': 'A sealed collection of all documentation proving compliance with a tax obligation',
        'Draft': 'Pack is being compiled, not yet submitted for review',
        'Submitted': 'Pack submitted to auditor or regulator for review',
        'Approved': 'Pack has been reviewed and approved, ready for archival',
      },
      commonMistakes: [
        'Submitting incomplete documentation - always verify all required documents are included',
        'Missing reconciliation reports',
        'Not including payment proof',
        'Forgetting to seal the pack after final approval',
      ],
      outputs: [
        'Complete evidence package',
        'Audit-ready documentation',
        'Downloadable PDF bundle',
        'Secure archival record',
      ],
      nextStep: 'Create a new evidence pack for a completed obligation, or review existing packs awaiting approval.',
    });
  }, [setCurrentHelpContent]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Evidence Packs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage audit documentation and evidence trails
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export All
          </Button>
          <Link to="/evidence-packs/new">
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Evidence Pack
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Draft Packs</p>
              <p className="text-2xl font-semibold text-foreground mt-2">1</p>
            </div>
            <Archive className="h-8 w-8 text-muted-foreground" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Awaiting Review</p>
              <p className="text-2xl font-semibold text-foreground mt-2">1</p>
            </div>
            <Archive className="h-8 w-8 text-[var(--info)]" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Approved</p>
              <p className="text-2xl font-semibold text-foreground mt-2">1</p>
            </div>
            <Archive className="h-8 w-8 text-[var(--success)]" />
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pack ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Obligation</TableHead>
              <TableHead>Created Date</TableHead>
              <TableHead>Documents</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {evidencePacks.map((pack) => (
              <TableRow key={pack.id}>
                <TableCell>
                  <span className="font-mono text-sm text-muted-foreground">
                    {pack.id}
                  </span>
                </TableCell>
                <TableCell>
                  <p className="font-medium text-foreground">{pack.title}</p>
                </TableCell>
                <TableCell>
                  <Link 
                    to={`/obligations/${pack.obligationId}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {pack.obligationId}
                  </Link>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground">{pack.createdDate}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground">{pack.documentsCount} files</span>
                </TableCell>
                <TableCell>
                  <StatusChip status={pack.status} />
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground">{pack.createdBy}</span>
                </TableCell>
                <TableCell>
                  <Link to={`/evidence-packs/${pack.id}`}>
                    <Button variant="ghost" size="sm">
                      View
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};
