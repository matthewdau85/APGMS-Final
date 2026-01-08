import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { StatusChip } from '../components/StatusChip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

export const ObligationDetail: React.FC = () => {
  const { id } = useParams();
  const { setCurrentHelpContent } = useApp();

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
    });
  }, [setCurrentHelpContent]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link to="/obligations">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">PAYGW Monthly Remittance - December 2025</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Obligation ID: {id}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Download Report
          </Button>
          <Button size="sm">
            Lodge & Pay
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Status</p>
          <div className="mt-2">
            <StatusChip status="overdue" />
          </div>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Due Date</p>
          <p className="text-lg font-semibold text-foreground mt-2">2026-01-07</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Amount</p>
          <p className="text-lg font-semibold text-foreground mt-2">$45,230.50</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Period</p>
          <p className="text-lg font-semibold text-foreground mt-2">December 2025</p>
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

        <TabsContent value="overview" className="mt-6 space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Obligation Details</h3>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">Type</dt>
                <dd className="text-sm font-medium text-foreground mt-1">PAYGW Withholding</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Assignee</dt>
                <dd className="text-sm font-medium text-foreground mt-1">Operator</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Created</dt>
                <dd className="text-sm font-medium text-foreground mt-1">2025-12-01</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Last Modified</dt>
                <dd className="text-sm font-medium text-foreground mt-1">2026-01-04</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Payment Method</dt>
                <dd className="text-sm font-medium text-foreground mt-1">Electronic Transfer</dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Payment Reference</dt>
                <dd className="text-sm font-mono text-foreground mt-1">PRN-2025-12-001</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Amount Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Gross Withholding</span>
                <span className="text-sm font-mono text-foreground">$52,340.00</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-sm text-muted-foreground">Adjustments</span>
                <span className="text-sm font-mono text-foreground">-$7,109.50</span>
              </div>
              <div className="flex justify-between items-center py-2 font-semibold">
                <span className="text-foreground">Net Payable</span>
                <span className="text-lg font-mono text-foreground">$45,230.50</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Checklist</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-[var(--success)] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Reconciliation Complete</p>
                  <p className="text-xs text-muted-foreground">Verified against ledger</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-[var(--success)] mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Supporting Documents Attached</p>
                  <p className="text-xs text-muted-foreground">3 files uploaded</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Payment Pending</p>
                  <p className="text-xs text-muted-foreground">Awaiting lodgment</p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="mt-6">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Transaction history would be displayed here</p>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-6">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Supporting documents would be displayed here</p>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="mt-6">
          <Card className="p-6">
            <p className="text-sm text-muted-foreground">Audit trail would be displayed here</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
