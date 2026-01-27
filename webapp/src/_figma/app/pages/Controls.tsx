import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import { EmptyState } from '../components/EmptyState';
import { Shield, Plus, FileCheck, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import type { ControlPolicy } from '../types';

export const Controls = () => {
  const { setCurrentHelpContent } = useApp();
  const { canApprove, isReadOnly } = useAuth();
  const { policies, createPolicy, updatePolicy, publishPolicy, currentOrganizationId, auditEvents } = useAppStore();

  const [selectedPolicy, setSelectedPolicy] = useState<ControlPolicy | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [policyToPublish, setPolicyToPublish] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'funding' as ControlPolicy['type'],
    description: '',
    content: '',
    effectiveDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Controls & Policies',
      purpose: 'Governance framework defining funding rules, attestation requirements, approval workflows, and compliance policies. Ensures consistent application of controls across all tax obligations.',
      requiredInputs: ['Policy name and type', 'Policy content and rules', 'Effective date'],
      definitions: {
        'Funding Policy': 'Rules for minimum coverage requirements in segregated accounts',
        'Attestation Policy': 'Requirements for director/officer sign-off before lodgment',
        'Approval Policy': 'Multi-level approval thresholds for large obligations',
        'Published Policy': 'Immutable version that is in effect',
      },
      commonMistakes: [
        'Publishing policies without effective date',
        'Not versioning policy changes',
        'Publishing conflicting policies',
      ],
      outputs: ['Published policies', 'Policy versions', 'Audit trail of policy changes'],
      nextStep: 'Review draft policies and publish when ready. Published policies are immutable.',
      atoReferences: [
        {
          title: 'Corporate Governance',
          url: 'https://www.ato.gov.au/businesses-and-organisations/corporate-tax-measures/tax-governance',
          description: 'ATO guidance on tax governance and internal controls'
        },
      ],
    });
  }, [setCurrentHelpContent]);

  const orgPolicies = policies.filter(p => p.organizationId === currentOrganizationId);

  const handleCreate = () => {
    if (!formData.name.trim() || !formData.content.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    createPolicy({
      name: formData.name,
      version: '1.0',
      type: formData.type,
      description: formData.description,
      content: formData.content,
      effectiveDate: formData.effectiveDate,
      status: 'draft',
      organizationId: currentOrganizationId,
    });

    toast.success('Policy created as draft');
    setShowCreateDialog(false);
    setFormData({
      name: '',
      type: 'funding',
      description: '',
      content: '',
      effectiveDate: new Date().toISOString().split('T')[0],
    });
  };

  const handlePublish = () => {
    if (policyToPublish) {
      publishPolicy(policyToPublish, 'Current User');
      toast.success('Policy published and now in effect');
      setShowPublishConfirm(false);
      setPolicyToPublish(null);
    }
  };

  const getPolicyIcon = (type: ControlPolicy['type']) => {
    switch (type) {
      case 'funding': return '💰';
      case 'attestation': return '✍️';
      case 'approval': return '✅';
      case 'reporting': return '📊';
    }
  };

  const getStatusColor = (status: ControlPolicy['status']) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'published': return 'default';
      case 'archived': return 'outline';
    }
  };

  // Get policy history from audit events
  const getPolicyHistory = (policyId: string) => {
    return auditEvents
      .filter(e => e.entityType === 'ControlPolicy' && e.entityId === policyId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Controls & Policies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Governance framework and compliance policies
          </p>
        </div>
        {canApprove && (
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                New Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Policy</DialogTitle>
                <DialogDescription>
                  Define a new governance policy. It will be created as a draft.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Policy Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., PAYGW Funding Policy"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select value={formData.type} onValueChange={(val: ControlPolicy['type']) => setFormData({ ...formData, type: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="funding">Funding Policy</SelectItem>
                      <SelectItem value="attestation">Attestation Policy</SelectItem>
                      <SelectItem value="approval">Approval Policy</SelectItem>
                      <SelectItem value="reporting">Reporting Policy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description of the policy"
                  />
                </div>
                <div>
                  <Label htmlFor="content">Policy Content</Label>
                  <Textarea
                    id="content"
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Detailed policy rules and requirements..."
                    rows={6}
                  />
                </div>
                <div>
                  <Label htmlFor="effectiveDate">Effective Date</Label>
                  <Input
                    id="effectiveDate"
                    type="date"
                    value={formData.effectiveDate}
                    onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
                <Button onClick={handleCreate}>Create Policy</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Policies List */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Policies</TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="draft">Drafts</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          {orgPolicies.length === 0 ? (
            <EmptyState
              icon={Shield}
              title="No policies defined"
              description="Create your first governance policy to get started."
            />
          ) : (
            <div className="grid gap-4">
              {orgPolicies.map((policy) => (
                <Card key={policy.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedPolicy(policy)}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{getPolicyIcon(policy.type)}</span>
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            {policy.name}
                            <Badge variant={getStatusColor(policy.status)}>
                              {policy.status}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="mt-1">
                            {policy.description}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>Version {policy.version}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(policy.effectiveDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  {policy.status === 'draft' && canApprove && (
                    <CardContent className="pt-0">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPolicyToPublish(policy.id);
                          setShowPublishConfirm(true);
                        }}
                      >
                        <FileCheck className="h-4 w-4" />
                        Publish Policy
                      </Button>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="published" className="space-y-4 mt-4">
          {orgPolicies.filter(p => p.status === 'published').map((policy) => (
            <Card key={policy.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedPolicy(policy)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getPolicyIcon(policy.type)}</span>
                    <div>
                      <CardTitle>{policy.name}</CardTitle>
                      <CardDescription className="mt-1">{policy.description}</CardDescription>
                    </div>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    <div>Version {policy.version}</div>
                    {policy.publishedAt && (
                      <div className="text-xs mt-1">
                        Published {new Date(policy.publishedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="draft" className="space-y-4 mt-4">
          {orgPolicies.filter(p => p.status === 'draft').map((policy) => (
            <Card key={policy.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedPolicy(policy)}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getPolicyIcon(policy.type)}</span>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {policy.name}
                        <Badge variant="secondary">draft</Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">{policy.description}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              {canApprove && (
                <CardContent className="pt-0">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPolicyToPublish(policy.id);
                      setShowPublishConfirm(true);
                    }}
                  >
                    <FileCheck className="h-4 w-4" />
                    Publish Policy
                  </Button>
                </CardContent>
              )}
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* Policy Detail Dialog */}
      <Dialog open={!!selectedPolicy} onOpenChange={() => setSelectedPolicy(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedPolicy && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="text-2xl">{getPolicyIcon(selectedPolicy.type)}</span>
                  {selectedPolicy.name}
                  <Badge variant={getStatusColor(selectedPolicy.status)}>
                    {selectedPolicy.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Version {selectedPolicy.version} • Effective {new Date(selectedPolicy.effectiveDate).toLocaleDateString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedPolicy.description}</p>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-2">Policy Content</h4>
                  <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap">
                    {selectedPolicy.content}
                  </div>
                </div>

                {selectedPolicy.publishedAt && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Publication Details</h4>
                    <p className="text-sm text-muted-foreground">
                      Published by {selectedPolicy.publishedBy} on {new Date(selectedPolicy.publishedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-semibold mb-2">History</h4>
                  <div className="space-y-2">
                    {getPolicyHistory(selectedPolicy.id).map((event) => (
                      <div key={event.id} className="text-sm flex items-start gap-2 p-2 bg-muted/50 rounded">
                        <div className="text-muted-foreground font-mono text-xs mt-0.5">
                          {new Date(event.timestamp).toLocaleString()}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{event.type}</div>
                          <div className="text-muted-foreground">{event.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Publish Confirmation */}
      <AlertDialog open={showPublishConfirm} onOpenChange={setShowPublishConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Publishing this policy will make it active and immutable. You cannot edit a published policy - you can only create new versions.
              <br /><br />
              Are you sure you want to publish this policy?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish}>
              Publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
