import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { AlertTriangle, Plus, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import type { Incident, IncidentSeverity } from '../types';

export const Incidents = () => {
  const { setCurrentHelpContent } = useApp();
  const { canCreate, isReadOnly } = useAuth();
  const navigate = useNavigate();
  const {
    incidents,
    createIncident,
    updateIncident,
    addIncidentNote,
    currentOrganizationId,
  } = useAppStore();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [noteText, setNoteText] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    severity: 'medium' as IncidentSeverity,
    category: 'compliance',
  });

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Incidents',
      purpose: 'Track and manage compliance incidents, control failures, and system anomalies. Maintain complete audit trail of incident resolution.',
      requiredInputs: ['Incident title and description', 'Severity level', 'Category classification'],
      definitions: {
        'Incident': 'Any event that deviates from normal operations or compliance requirements',
        'Severity': 'Impact level - Critical (immediate), High (urgent), Medium (soon), Low (routine)',
        'Root Cause': 'Underlying reason for the incident occurrence',
      },
      commonMistakes: [
        'Not documenting incidents immediately',
        'Closing incidents without root cause analysis',
        'Failing to link incidents to affected obligations',
      ],
      outputs: ['Incident records', 'Resolution timeline', 'Audit trail'],
      nextStep: 'Create incidents for any compliance issues, investigate root cause, and document resolution.',
      atoReferences: [
        {
          title: 'Voluntary Disclosures',
          url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/how-to-lodge/voluntary-disclosures',
          description: 'How to voluntarily disclose errors to the ATO'
        },
      ],
    });
  }, [setCurrentHelpContent]);

  const orgIncidents = incidents.filter(i => i.organizationId === currentOrganizationId);
  
  const filteredIncidents = orgIncidents.filter(incident => {
    const matchesStatus = statusFilter === 'all' || incident.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter;
    return matchesStatus && matchesSeverity;
  });

  const handleCreate = () => {
    if (!formData.title || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    createIncident({
      title: formData.title,
      description: formData.description,
      severity: formData.severity,
      category: formData.category,
      status: 'open',
      organizationId: currentOrganizationId,
      reportedBy: 'Current User',
    });

    toast.success('Incident created');
    setShowCreateDialog(false);
    setFormData({ title: '', description: '', severity: 'medium', category: 'compliance' });
  };

  const handleAddNote = () => {
    if (!noteText.trim() || !selectedIncident) return;

    addIncidentNote(selectedIncident.id, noteText, 'Current User');
    setNoteText('');
    toast.success('Note added');

    // Update selected incident
    const updated = incidents.find(i => i.id === selectedIncident.id);
    if (updated) setSelectedIncident(updated);
  };

  const handleUpdateStatus = (incidentId: string, newStatus: Incident['status']) => {
    updateIncident(incidentId, { status: newStatus });
    toast.success(`Incident ${newStatus}`);

    // Update selected incident if it's the one being changed
    if (selectedIncident?.id === incidentId) {
      const updated = incidents.find(i => i.id === incidentId);
      if (updated) setSelectedIncident(updated);
    }
  };

  const getSeverityColor = (severity: IncidentSeverity) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Incidents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track and resolve compliance incidents
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            Create Incident
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto text-sm text-muted-foreground">
          {filteredIncidents.length} incident{filteredIncidents.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Incidents Table */}
      {filteredIncidents.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="No incidents"
          description="No compliance incidents match your filters."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIncidents.map((incident) => (
                <TableRow
                  key={incident.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedIncident(incident)}
                >
                  <TableCell className="font-mono text-xs">{incident.id}</TableCell>
                  <TableCell className="font-medium">{incident.title}</TableCell>
                  <TableCell className="capitalize">{incident.category}</TableCell>
                  <TableCell>
                    <Badge variant={getSeverityColor(incident.severity)}>
                      {incident.severity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={incident.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(incident.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Incident</DialogTitle>
            <DialogDescription>
              Report a new compliance incident or system issue
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief description of the incident"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detailed description of what happened..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="severity">Severity</Label>
                <Select value={formData.severity} onValueChange={(val: IncidentSeverity) => setFormData({ ...formData, severity: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="data">Data Quality</SelectItem>
                    <SelectItem value="process">Process</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate}>Create Incident</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incident Detail Sheet */}
      <Sheet open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {selectedIncident && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <SheetTitle>{selectedIncident.title}</SheetTitle>
                    <SheetDescription>
                      Reported by {selectedIncident.reportedBy} on {new Date(selectedIncident.createdAt).toLocaleString()}
                    </SheetDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={getSeverityColor(selectedIncident.severity)}>
                      {selectedIncident.severity}
                    </Badge>
                    <StatusChip status={selectedIncident.status} />
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Description */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Description</h4>
                  <p className="text-sm text-muted-foreground">{selectedIncident.description}</p>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Category</h4>
                    <p className="text-sm text-muted-foreground capitalize">{selectedIncident.category}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Status</h4>
                    <p className="text-sm text-muted-foreground capitalize">{selectedIncident.status}</p>
                  </div>
                </div>

                {/* Related Links */}
                {(selectedIncident.relatedObligationId || selectedIncident.relatedAlertId) && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Related Items</h4>
                    <div className="space-y-2">
                      {selectedIncident.relatedObligationId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedIncident(null);
                            navigate(`/obligations/${selectedIncident.relatedObligationId}`);
                          }}
                        >
                          View Related Obligation
                        </Button>
                      )}
                      {selectedIncident.relatedAlertId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedIncident(null);
                            navigate('/alerts');
                          }}
                        >
                          View Related Alert
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Resolution */}
                {selectedIncident.resolvedAt && (
                  <div className="p-4 bg-success/10 rounded-lg border border-success/20">
                    <h4 className="text-sm font-semibold mb-2 text-success">Resolution</h4>
                    <p className="text-sm text-muted-foreground mb-1">{selectedIncident.resolution}</p>
                    <p className="text-xs text-muted-foreground">
                      Resolved by {selectedIncident.resolvedBy} on {new Date(selectedIncident.resolvedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {/* Timeline / Notes */}
                <div>
                  <h4 className="text-sm font-semibold mb-3">Timeline</h4>
                  <div className="space-y-3">
                    {selectedIncident.notes && selectedIncident.notes.length > 0 ? (
                      selectedIncident.notes.map((note, index) => (
                        <div key={index} className="p-3 bg-muted rounded-lg">
                          <div className="flex items-start justify-between mb-1">
                            <span className="text-sm font-medium">{note.author}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(note.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{note.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No notes yet</p>
                    )}
                  </div>
                </div>

                {/* Add Note */}
                {!isReadOnly && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Add Note</h4>
                    <div className="flex gap-2">
                      <Input
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add investigation note..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && noteText.trim()) {
                            handleAddNote();
                          }
                        }}
                      />
                      <Button onClick={handleAddNote} disabled={!noteText.trim()}>
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                {!isReadOnly && (
                  <div className="flex gap-2 pt-4 border-t">
                    {selectedIncident.status === 'open' && (
                      <Button onClick={() => handleUpdateStatus(selectedIncident.id, 'investigating')}>
                        Start Investigation
                      </Button>
                    )}
                    {selectedIncident.status === 'investigating' && (
                      <Button onClick={() => handleUpdateStatus(selectedIncident.id, 'resolved')}>
                        Mark Resolved
                      </Button>
                    )}
                    {selectedIncident.status === 'resolved' && (
                      <Button onClick={() => handleUpdateStatus(selectedIncident.id, 'closed')}>
                        Close Incident
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
