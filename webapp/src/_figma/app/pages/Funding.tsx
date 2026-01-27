import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { Wallet, Plus, DollarSign, CheckCircle2, Clock, AlertCircle, TrendingUp, Building2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import type { FundingRequest, FundingSource } from '../types';

export const Funding = () => {
  const { setCurrentHelpContent } = useApp();
  const { canCreate, canApprove, isReadOnly } = useAuth();
  const {
    fundingRequests,
    fundingSources,
    obligations,
    currentOrganizationId,
    createFundingRequest,
    updateFundingRequest,
    approveFundingRequest,
    allocateFunding,
    createFundingSource,
  } = useAppStore();

  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [showSourceDialog, setShowSourceDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<FundingRequest | null>(null);

  // Form states
  const [requestForm, setRequestForm] = useState({
    title: '',
    amount: '',
    requiredBy: '',
    obligationId: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    justification: '',
  });

  const [sourceForm, setSourceForm] = useState({
    name: '',
    type: 'bank-account' as 'bank-account' | 'line-of-credit' | 'reserve-fund' | 'external',
    balance: '',
    limit: '',
    interestRate: '',
    description: '',
  });

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Funding Management',
      purpose: 'Automated funding request and allocation system for tax obligations. Request funds, approve allocations, and track funding sources to ensure obligations are paid on time.',
      requiredInputs: ['Funding amount', 'Required date', 'Linked obligation', 'Justification'],
      definitions: {
        'Funding Request': 'Request for funds to cover a specific tax obligation',
        'Funding Source': 'Bank account, line of credit, or reserve fund used to pay obligations',
        'Allocation': 'Assignment of funds from a source to fulfill a request',
        'Priority': 'Urgency level (low/medium/high/critical) for funding',
      },
      commonMistakes: [
        'Not linking funding requests to specific obligations',
        'Requesting funds too close to due date',
        'Not maintaining adequate reserve balances',
      ],
      outputs: ['Approved funding requests', 'Source allocation records', 'Funding history'],
      nextStep: 'Create funding requests for upcoming obligations, maintain funding sources, and approve/allocate as needed.',
      atoReferences: [],
    });
  }, [setCurrentHelpContent]);

  const orgRequests = fundingRequests.filter(r => r.organizationId === currentOrganizationId);
  const orgSources = fundingSources.filter(s => s.organizationId === currentOrganizationId);
  const orgObligations = obligations.filter(o => o.organizationId === currentOrganizationId);

  // Calculate statistics
  const totalRequested = orgRequests.reduce((sum, r) => sum + r.amount, 0);
  const totalAllocated = orgRequests.filter(r => r.status === 'allocated').reduce((sum, r) => sum + r.amount, 0);
  const pendingAmount = orgRequests.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.amount, 0);
  const totalAvailable = orgSources.reduce((sum, s) => sum + s.balance, 0);

  const handleCreateRequest = () => {
    if (!requestForm.title || !requestForm.amount || !requestForm.requiredBy) {
      toast.error('Please fill in all required fields');
      return;
    }

    createFundingRequest({
      ...requestForm,
      amount: parseFloat(requestForm.amount),
      organizationId: currentOrganizationId,
    });

    toast.success('Funding request created');
    setShowRequestDialog(false);
    setRequestForm({
      title: '',
      amount: '',
      requiredBy: '',
      obligationId: '',
      priority: 'medium',
      justification: '',
    });
  };

  const handleApprove = (requestId: string) => {
    approveFundingRequest(requestId, 'Current User');
    toast.success('Funding request approved');
  };

  const handleAllocate = (requestId: string, sourceId: string) => {
    const request = orgRequests.find(r => r.id === requestId);
    const source = orgSources.find(s => s.id === sourceId);

    if (!request || !source) return;

    if (source.balance < request.amount) {
      toast.error('Insufficient balance in selected source');
      return;
    }

    allocateFunding(requestId, sourceId, 'Current User');
    toast.success('Funding allocated successfully');
    setSelectedRequest(null);
  };

  const handleCreateSource = () => {
    if (!sourceForm.name || !sourceForm.balance) {
      toast.error('Please fill in all required fields');
      return;
    }

    createFundingSource({
      ...sourceForm,
      balance: parseFloat(sourceForm.balance),
      limit: sourceForm.limit ? parseFloat(sourceForm.limit) : undefined,
      interestRate: sourceForm.interestRate ? parseFloat(sourceForm.interestRate) : undefined,
      organizationId: currentOrganizationId,
      active: true,
    });

    toast.success('Funding source created');
    setShowSourceDialog(false);
    setSourceForm({
      name: '',
      type: 'bank-account',
      balance: '',
      limit: '',
      interestRate: '',
      description: '',
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Funding Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Request and allocate funds for tax obligations
          </p>
        </div>
        <div className="flex gap-2">
          {canCreate && (
            <>
              <Button variant="outline" onClick={() => setShowSourceDialog(true)}>
                <Building2 className="h-4 w-4" />
                Add Source
              </Button>
              <Button onClick={() => setShowRequestDialog(true)}>
                <Plus className="h-4 w-4" />
                New Request
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requested</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalRequested.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {orgRequests.length} request{orgRequests.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${pendingAmount.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {orgRequests.filter(r => r.status === 'pending').length} pending
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Allocated</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalAllocated.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {orgRequests.filter(r => r.status === 'allocated').length} allocated
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Balance</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalAvailable.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {orgSources.filter(s => s.active).length} active source{orgSources.filter(s => s.active).length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="requests" className="space-y-4">
        <TabsList>
          <TabsTrigger value="requests">
            Funding Requests
            {orgRequests.filter(r => r.status === 'pending').length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-5">
                {orgRequests.filter(r => r.status === 'pending').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sources">Funding Sources</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          {orgRequests.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No funding requests"
              description="Create your first funding request for upcoming tax obligations."
            />
          ) : (
            <div className="space-y-3">
              {orgRequests.map((request) => {
                const obligation = orgObligations.find(o => o.id === request.obligationId);
                const source = orgSources.find(s => s.id === request.sourceId);

                return (
                  <Card key={request.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{request.title}</h3>
                            <StatusChip status={request.status} />
                            <Badge className={getPriorityColor(request.priority)}>
                              {request.priority}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Amount</p>
                              <p className="text-sm font-semibold">${request.amount.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Required By</p>
                              <p className="text-sm font-semibold">
                                {new Date(request.requiredBy).toLocaleDateString()}
                              </p>
                            </div>
                            {obligation && (
                              <div>
                                <p className="text-xs text-muted-foreground">Obligation</p>
                                <p className="text-sm font-semibold">{obligation.title}</p>
                              </div>
                            )}
                            {source && (
                              <div>
                                <p className="text-xs text-muted-foreground">Source</p>
                                <p className="text-sm font-semibold">{source.name}</p>
                              </div>
                            )}
                          </div>

                          {request.justification && (
                            <div className="mt-4 p-3 bg-muted rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">Justification</p>
                              <p className="text-sm">{request.justification}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-2 ml-4">
                          {request.status === 'pending' && canApprove && !isReadOnly && (
                            <Button size="sm" onClick={() => handleApprove(request.id)}>
                              <CheckCircle2 className="h-3 w-3" />
                              Approve
                            </Button>
                          )}
                          {request.status === 'approved' && canCreate && !isReadOnly && (
                            <Button size="sm" onClick={() => setSelectedRequest(request)}>
                              <Wallet className="h-3 w-3" />
                              Allocate
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="sources" className="space-y-4">
          {orgSources.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No funding sources"
              description="Add your first funding source to allocate funds to requests."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orgSources.map((source) => (
                <Card key={source.id} className={!source.active ? 'opacity-50' : ''}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-base">{source.name}</CardTitle>
                      </div>
                      {source.active ? (
                        <Badge variant="outline" className="text-xs">Active</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">Inactive</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Type</p>
                      <p className="text-sm font-medium capitalize">
                        {source.type.replace('-', ' ')}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">Available Balance</p>
                      <p className="text-xl font-bold">${source.balance.toLocaleString()}</p>
                    </div>

                    {source.limit && (
                      <div>
                        <p className="text-xs text-muted-foreground">Credit Limit</p>
                        <p className="text-sm font-semibold">${source.limit.toLocaleString()}</p>
                      </div>
                    )}

                    {source.interestRate && (
                      <div>
                        <p className="text-xs text-muted-foreground">Interest Rate</p>
                        <p className="text-sm font-semibold">{source.interestRate}% p.a.</p>
                      </div>
                    )}

                    {source.description && (
                      <p className="text-xs text-muted-foreground pt-2 border-t">
                        {source.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Request Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Funding Request</DialogTitle>
            <DialogDescription>
              Request funds for an upcoming tax obligation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Request Title *</Label>
              <Input
                id="title"
                value={requestForm.title}
                onChange={(e) => setRequestForm({ ...requestForm, title: e.target.value })}
                placeholder="Q2 2024 GST Payment"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Amount (AUD) *</Label>
                <Input
                  id="amount"
                  type="number"
                  value={requestForm.amount}
                  onChange={(e) => setRequestForm({ ...requestForm, amount: e.target.value })}
                  placeholder="50000"
                />
              </div>
              <div>
                <Label htmlFor="requiredBy">Required By *</Label>
                <Input
                  id="requiredBy"
                  type="date"
                  value={requestForm.requiredBy}
                  onChange={(e) => setRequestForm({ ...requestForm, requiredBy: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="obligationId">Linked Obligation</Label>
                <Select
                  value={requestForm.obligationId}
                  onValueChange={(value) => setRequestForm({ ...requestForm, obligationId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select obligation" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgObligations.map(obl => (
                      <SelectItem key={obl.id} value={obl.id}>
                        {obl.title} - ${obl.amount.toLocaleString()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={requestForm.priority}
                  onValueChange={(value: any) => setRequestForm({ ...requestForm, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="justification">Justification</Label>
              <Textarea
                id="justification"
                value={requestForm.justification}
                onChange={(e) => setRequestForm({ ...requestForm, justification: e.target.value })}
                placeholder="Explain why this funding is needed..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRequestDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateRequest}>Create Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Source Dialog */}
      <Dialog open={showSourceDialog} onOpenChange={setShowSourceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Funding Source</DialogTitle>
            <DialogDescription>
              Add a bank account, line of credit, or reserve fund
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="sourceName">Source Name *</Label>
              <Input
                id="sourceName"
                value={sourceForm.name}
                onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                placeholder="NAB Operating Account"
              />
            </div>

            <div>
              <Label htmlFor="sourceType">Type</Label>
              <Select
                value={sourceForm.type}
                onValueChange={(value: any) => setSourceForm({ ...sourceForm, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank-account">Bank Account</SelectItem>
                  <SelectItem value="line-of-credit">Line of Credit</SelectItem>
                  <SelectItem value="reserve-fund">Reserve Fund</SelectItem>
                  <SelectItem value="external">External Source</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="balance">Current Balance *</Label>
                <Input
                  id="balance"
                  type="number"
                  value={sourceForm.balance}
                  onChange={(e) => setSourceForm({ ...sourceForm, balance: e.target.value })}
                  placeholder="150000"
                />
              </div>
              <div>
                <Label htmlFor="limit">Credit Limit (Optional)</Label>
                <Input
                  id="limit"
                  type="number"
                  value={sourceForm.limit}
                  onChange={(e) => setSourceForm({ ...sourceForm, limit: e.target.value })}
                  placeholder="250000"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="interestRate">Interest Rate % (Optional)</Label>
              <Input
                id="interestRate"
                type="number"
                step="0.01"
                value={sourceForm.interestRate}
                onChange={(e) => setSourceForm({ ...sourceForm, interestRate: e.target.value })}
                placeholder="5.25"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={sourceForm.description}
                onChange={(e) => setSourceForm({ ...sourceForm, description: e.target.value })}
                placeholder="Primary operating account..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSourceDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSource}>Add Source</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Allocate Funding Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allocate Funding</DialogTitle>
            <DialogDescription>
              Select a funding source for this request
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-semibold">{selectedRequest.title}</p>
                <p className="text-2xl font-bold mt-2">${selectedRequest.amount.toLocaleString()}</p>
              </div>

              <div className="space-y-2">
                <Label>Select Funding Source</Label>
                {orgSources.filter(s => s.active).map((source) => (
                  <Card
                    key={source.id}
                    className={`cursor-pointer hover:border-primary transition-colors ${
                      source.balance < selectedRequest.amount ? 'opacity-50' : ''
                    }`}
                    onClick={() => {
                      if (source.balance >= selectedRequest.amount) {
                        handleAllocate(selectedRequest.id, source.id);
                      }
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{source.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">
                            {source.type.replace('-', ' ')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">${source.balance.toLocaleString()}</p>
                          {source.balance < selectedRequest.amount && (
                            <p className="text-xs text-destructive">Insufficient</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
