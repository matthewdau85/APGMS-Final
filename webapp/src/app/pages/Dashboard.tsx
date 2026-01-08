import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Clock, CheckCircle, FileText, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { StatusChip } from '../components/StatusChip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const stats = [
  {
    name: 'Overdue Obligations',
    value: '3',
    change: '+2 from last period',
    trend: 'up',
    icon: AlertCircle,
    color: 'destructive',
  },
  {
    name: 'Due This Week',
    value: '12',
    change: 'Same as last week',
    trend: 'neutral',
    icon: Clock,
    color: 'warning',
  },
  {
    name: 'Completed This Period',
    value: '47',
    change: '+8 from last period',
    trend: 'down',
    icon: CheckCircle,
    color: 'success',
  },
  {
    name: 'Open Evidence Packs',
    value: '5',
    change: '2 awaiting review',
    trend: 'neutral',
    icon: FileText,
    color: 'info',
  },
];

const workQueue = [
  {
    id: '1',
    title: 'PAYGW Monthly Remittance - December 2025',
    type: 'PAYGW',
    dueDate: '2026-01-07',
    status: 'overdue' as const,
    priority: 'critical',
    assignee: 'Operator',
  },
  {
    id: '2',
    title: 'GST Return - Q4 2025',
    type: 'GST',
    dueDate: '2026-01-15',
    status: 'pending' as const,
    priority: 'high',
    assignee: 'Admin',
  },
  {
    id: '3',
    title: 'BAS Statement Reconciliation',
    type: 'BAS',
    dueDate: '2026-01-20',
    status: 'active' as const,
    priority: 'medium',
    assignee: 'Operator',
  },
  {
    id: '4',
    title: 'PAYGW Withholding Verification',
    type: 'PAYGW',
    dueDate: '2026-01-25',
    status: 'active' as const,
    priority: 'medium',
    assignee: 'Operator',
  },
  {
    id: '5',
    title: 'Annual GST Audit Preparation',
    type: 'Audit',
    dueDate: '2026-02-01',
    status: 'pending' as const,
    priority: 'low',
    assignee: 'Auditor',
  },
];

export const Dashboard: React.FC = () => {
  const { setCurrentHelpContent } = useApp();

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Dashboard Overview',
      purpose: 'The Dashboard provides a real-time view of your compliance work queue, critical obligations, and system status. It serves as the primary control center for managing Australian tax obligations.',
      requiredInputs: [],
      definitions: {
        'Work Queue': 'A prioritized list of all pending obligations and tasks requiring action',
        'Overdue Obligations': 'Tax obligations that have passed their statutory due date',
        'Evidence Pack': 'A collection of supporting documents and audit trails for a completed obligation',
      },
      commonMistakes: [
        'Ignoring overdue items - these should be addressed immediately',
        'Not reviewing the work queue daily',
        'Failing to reassign tasks when team members are unavailable',
      ],
      outputs: [
        'Prioritized task list',
        'System health status',
        'Compliance metrics and trends',
      ],
      nextStep: 'Click on any obligation to view details, or navigate to Obligations for the full list.',
    });
  }, [setCurrentHelpContent]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your compliance work queue and system overview
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.name}</p>
                <p className="text-2xl font-semibold text-foreground mt-2">{stat.value}</p>
                <div className="flex items-center gap-1 mt-2">
                  {stat.trend === 'up' && <TrendingUp className="h-3 w-3 text-destructive" />}
                  {stat.trend === 'down' && <TrendingDown className="h-3 w-3 text-[var(--success)]" />}
                  <p className="text-xs text-muted-foreground">{stat.change}</p>
                </div>
              </div>
              <div className={`w-10 h-10 rounded-full bg-[var(--${stat.color})]/10 flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 text-[var(--${stat.color})]`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Work Queue */}
      <Card>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Work Queue</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {workQueue.length} items requiring attention
            </p>
          </div>
          <Link to="/obligations">
            <Button variant="outline" size="sm">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Obligation</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workQueue.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">#{item.id}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground">{item.type}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground">{item.dueDate}</span>
                </TableCell>
                <TableCell>
                  <StatusChip status={item.status} />
                </TableCell>
                <TableCell>
                  <span className="text-sm text-foreground">{item.assignee}</span>
                </TableCell>
                <TableCell>
                  <Link to={`/obligations/${item.id}`}>
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

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">Create Obligation</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Manually add a new tax obligation
          </p>
          <Link to="/obligations/new">
            <Button className="w-full">Create</Button>
          </Link>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">Run Reconciliation</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Compare ledger with obligations
          </p>
          <Link to="/reconciliation">
            <Button variant="outline" className="w-full">Start</Button>
          </Link>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-2">Generate Evidence Pack</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create audit documentation
          </p>
          <Link to="/evidence-packs/new">
            <Button variant="outline" className="w-full">Generate</Button>
          </Link>
        </Card>
      </div>
    </div>
  );
};
