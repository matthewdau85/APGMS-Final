import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Clock, CheckCircle, FileText, Plus, GitMerge, Archive, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Area, AreaChart } from 'recharts';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { StatusChip } from '../components/StatusChip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import type { ObligationType } from '../types';

// Enhanced color palette for better visual appeal
const CHART_COLORS = {
  PAYGW: '#3b82f6',      // Blue
  GST: '#10b981',        // Green
  BAS: '#f59e0b',        // Amber
  SG: '#8b5cf6',         // Purple
  FBT: '#ec4899',        // Pink
  draft: '#94a3b8',      // Slate
  pending: '#f59e0b',    // Amber
  approved: '#3b82f6',   // Blue
  submitted: '#06b6d4',  // Cyan
  completed: '#10b981',  // Green
  overdue: '#ef4444',    // Red
};

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

// Custom tooltip for better data presentation
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
        <p className="font-semibold text-sm mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: <span className="font-bold">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export const Dashboard = () => {
  const { setCurrentHelpContent } = useApp();
  const { canCreate } = useAuth();
  const navigate = useNavigate();
  const {
    obligations,
    evidencePacks,
    transactions,
    alerts,
    fundingRequests,
    createObligation,
    createEvidencePack,
    generateEvidence,
    createReconciliationMatch,
    currentOrganizationId,
    currentPeriodId,
    periods,
  } = useAppStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEvidenceDialog, setShowEvidenceDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    type: 'PAYGW' as ObligationType,
    dueDate: '',
    amount: '',
    period: '',
  });

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Dashboard Overview',
      purpose: 'Real-time command center for Australian tax compliance. Monitor obligations, funding status, reconciliation coverage, and system alerts.',
      requiredInputs: [],
      definitions: {
        'Work Queue': 'Prioritized list of all pending obligations and tasks requiring action',
        'Overdue Obligations': 'Tax obligations that have passed their statutory due date - immediate action required',
        'Evidence Pack': 'Immutable audit trail for completed obligations',
        'Coverage': 'Percentage of transactions matched to obligations',
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
      nextStep: 'Review overdue items first, then work through the queue by priority.',
      atoReferences: [
        {
          title: 'ATO Lodgment Calendar',
          url: 'https://www.ato.gov.au/tax-and-super-professionals/for-tax-professionals/prepare-and-lodge/lodgment-program-and-deferral-dates',
          description: 'Official ATO calendar for all lodgment due dates'
        },
        {
          title: 'Single Touch Payroll',
          url: 'https://www.ato.gov.au/businesses-and-organisations/hiring-and-paying-your-workers/single-touch-payroll',
          description: 'STP reporting requirements and deadlines'
        },
      ],
    });
  }, [setCurrentHelpContent]);

  // Filter data for current org
  const currentPeriod = periods.find(p => p.id === currentPeriodId);
  const orgObligations = obligations.filter(o => o.organizationId === currentOrganizationId);
  const orgPacks = evidencePacks.filter(p => p.organizationId === currentOrganizationId);
  const orgTransactions = transactions.filter(t => t.organizationId === currentOrganizationId);
  const orgAlerts = alerts.filter(a => a.organizationId === currentOrganizationId);
  const orgFundingRequests = fundingRequests.filter(r => r.organizationId === currentOrganizationId);

  // Calculate stats
  const overdue = orgObligations.filter(o => new Date(o.dueDate) < new Date() && o.status !== 'completed' && o.status !== 'submitted');
  const dueThisWeek = orgObligations.filter(o => {
    const due = new Date(o.dueDate);
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    return due <= weekFromNow && due >= new Date() && o.status !== 'completed';
  });
  const completed = orgObligations.filter(o => o.status === 'completed' || o.status === 'submitted');
  const openPacks = orgPacks.filter(p => p.status === 'draft' || p.status === 'generating');
  
  // Reconciliation coverage
  const reconciledCount = orgTransactions.filter(t => t.reconciled).length;
  const coveragePercent = orgTransactions.length > 0 ? (reconciledCount / orgTransactions.length) * 100 : 0;

  // Open alerts
  const openAlerts = orgAlerts.filter(a => a.status === 'open');

  // Work queue (top 5 obligations by priority)
  const workQueue = orgObligations
    .filter(o => o.status !== 'completed' && o.status !== 'submitted')
    .sort((a, b) => {
      if (a.status === 'overdue' && b.status !== 'overdue') return -1;
      if (b.status === 'overdue' && a.status !== 'overdue') return 1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 5);

  // Chart data - Obligations by type
  const obligationsByType = orgObligations.reduce((acc, obl) => {
    acc[obl.type] = (acc[obl.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(obligationsByType).map(([name, value]) => ({ name, value }));

  // Chart data - Obligations by status
  const obligationsByStatus = orgObligations.reduce((acc, obl) => {
    acc[obl.status] = (acc[obl.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const barData = Object.entries(obligationsByStatus).map(([name, value]) => ({ 
    name: name.charAt(0).toUpperCase() + name.slice(1), 
    value,
    fill: CHART_COLORS[name as keyof typeof CHART_COLORS] || '#94a3b8'
  }));

  // Financial overview - Total amounts by obligation type
  const financialByType = orgObligations.reduce((acc, obl) => {
    if (!acc[obl.type]) {
      acc[obl.type] = { type: obl.type, total: 0, count: 0 };
    }
    acc[obl.type].total += obl.amount;
    acc[obl.type].count += 1;
    return acc;
  }, {} as Record<string, { type: string; total: number; count: number }>);

  const financialData = Object.values(financialByType).map(item => ({
    name: item.type,
    amount: item.total,
    count: item.count,
    fill: CHART_COLORS[item.type as keyof typeof CHART_COLORS] || '#94a3b8'
  }));

  // Funding status data
  const fundingPending = orgFundingRequests.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);
  const fundingAllocated = orgFundingRequests.filter(r => r.status === 'allocated').reduce((sum, r) => sum + r.amount, 0);
  const fundingApproved = orgFundingRequests.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.amount, 0);

  const fundingData = [
    { name: 'Pending', value: fundingPending, fill: '#f59e0b' },
    { name: 'Approved', value: fundingApproved, fill: '#3b82f6' },
    { name: 'Allocated', value: fundingAllocated, fill: '#10b981' },
  ].filter(item => item.value > 0);

  const handleCreateObligation = () => {
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
    navigate(`/obligations/${newObl.id}`);
  };

  const handleRunReconciliation = async () => {
    toast.info('Running reconciliation engine...');
    
    // Simulate matching
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    let matchedCount = 0;
    const unmatchedTransactions = orgTransactions.filter(t => !t.reconciled);
    
    unmatchedTransactions.forEach(txn => {
      const matchingObl = orgObligations.find(obl => 
        Math.abs(obl.amount - Math.abs(txn.amount)) < 100 && !obl.linkedTransactionIds?.includes(txn.id)
      );
      
      if (matchingObl) {
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
    
    toast.success(`Found ${matchedCount} potential matches. Review in Reconciliation page.`);
    setTimeout(() => navigate('/reconciliation'), 1000);
  };

  const handleGenerateEvidence = () => {
    const pack = createEvidencePack({
      name: `Evidence Pack - ${currentPeriod?.label || 'Current Period'}`,
      periodId: currentPeriodId,
      organizationId: currentOrganizationId,
      obligationIds: orgObligations.map(o => o.id),
    });

    generateEvidence(pack.id);
    toast.success('Generating evidence pack...');
    setShowEvidenceDialog(false);
    setTimeout(() => navigate('/evidence-packs'), 1000);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compliance control center for {currentPeriod?.label || 'all periods'}
        </p>
      </div>

      {/* Critical Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-3xl font-bold text-destructive mt-2">{overdue.length}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Immediate action required
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Due This Week</p>
                <p className="text-3xl font-bold text-warning mt-2">{dueThisWeek.length}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Requires planning
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-3xl font-bold text-success mt-2">{completed.length}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {((completed.length / orgObligations.length) * 100).toFixed(0)}% of total
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Alerts</p>
                <p className="text-3xl font-bold text-foreground mt-2">{openAlerts.length}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  System notifications
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Obligations by Type</CardTitle>
            <p className="text-sm text-muted-foreground">Distribution of tax obligations</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  outerRadius={90}
                  innerRadius={50}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                      stroke="hsl(var(--background))"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend 
                  verticalAlign="bottom" 
                  height={36}
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Obligations by Status</CardTitle>
            <p className="text-sm text-muted-foreground">Current workflow state</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="value" 
                  radius={[8, 8, 0, 0]}
                >
                  {barData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Financial Overview Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Financial Obligations by Type</CardTitle>
            <p className="text-sm text-muted-foreground">Total amounts (AUD)</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={financialData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis 
                  type="number"
                  tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                />
                <YAxis 
                  type="category"
                  dataKey="name" 
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  stroke="hsl(var(--border))"
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                          <p className="font-semibold text-sm mb-1">{payload[0].payload.name}</p>
                          <p className="text-sm" style={{ color: payload[0].color }}>
                            Amount: <span className="font-bold">${payload[0].value?.toLocaleString()}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payload[0].payload.count} obligation{payload[0].payload.count !== 1 ? 's' : ''}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="amount" 
                  radius={[0, 8, 8, 0]}
                >
                  {financialData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {fundingData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Funding Status</CardTitle>
              <p className="text-sm text-muted-foreground">Request breakdown (AUD)</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={fundingData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value }) => `${name} $${(value / 1000).toFixed(0)}k`}
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {fundingData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.fill}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
                            <p className="font-semibold text-sm mb-1">{payload[0].name}</p>
                            <p className="text-sm" style={{ color: payload[0].payload.fill }}>
                              <span className="font-bold">${payload[0].value?.toLocaleString()}</span>
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Reconciliation Progress</CardTitle>
              <p className="text-sm text-muted-foreground">Transaction matching status</p>
            </CardHeader>
            <CardContent className="flex items-center justify-center" style={{ height: 280 }}>
              <div className="text-center">
                <div className="relative inline-flex">
                  <svg className="w-32 h-32">
                    <circle
                      className="text-muted"
                      strokeWidth="8"
                      stroke="currentColor"
                      fill="transparent"
                      r="56"
                      cx="64"
                      cy="64"
                    />
                    <circle
                      className="text-primary"
                      strokeWidth="8"
                      strokeDasharray={`${coveragePercent * 3.52} 352`}
                      strokeLinecap="round"
                      stroke="#10b981"
                      fill="transparent"
                      r="56"
                      cx="64"
                      cy="64"
                      transform="rotate(-90 64 64)"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-3xl font-bold">{coveragePercent.toFixed(0)}%</span>
                  </div>
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {reconciledCount} / {orgTransactions.length} transactions
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Work Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Work Queue</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{workQueue.length} items requiring attention</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/obligations')}>
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {workQueue.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No pending obligations</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Obligation</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workQueue.map((item) => (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/obligations/${item.id}`)}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>{new Date(item.dueDate).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono">${item.amount.toLocaleString()}</TableCell>
                    <TableCell><StatusChip status={item.status} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">View</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {canCreate && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Create Obligation</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Manually add a new tax obligation
                </p>
                <Button className="w-full" onClick={() => setShowCreateDialog(true)}>
                  Create
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <GitMerge className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Run Reconciliation</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Match transactions to obligations
                </p>
                <Button variant="outline" className="w-full" onClick={handleRunReconciliation}>
                  Start
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Archive className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Generate Evidence</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Create audit documentation
                </p>
                <Button variant="outline" className="w-full" onClick={handleGenerateEvidence}>
                  Generate
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Create Obligation Dialog */}
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
            <Button onClick={handleCreateObligation}>Create Obligation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};