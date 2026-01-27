import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '../components/ui/sheet';
import { StatusChip } from '../components/StatusChip';
import { EmptyState } from '../components/EmptyState';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import type { Alert } from '../types';

export const Alerts = () => {
  const { setCurrentHelpContent } = useApp();
  const { isReadOnly } = useAuth();
  const navigate = useNavigate();
  const { alerts, acknowledgeAlert, resolveAlert, currentOrganizationId } = useAppStore();
  
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Alerts',
      purpose: 'Monitor system-generated alerts for overdue obligations, low funding coverage, and compliance risks.',
      requiredInputs: ['Review alerts regularly', 'Acknowledge alerts when investigating', 'Resolve alerts when issues are fixed'],
      definitions: {
        'Critical Alert': 'Requires immediate attention - typically overdue obligations or critical compliance failures',
        'Warning Alert': 'Requires attention soon - low coverage, approaching deadlines',
        'Info Alert': 'Informational - upcoming deadlines, system notifications',
      },
      commonMistakes: ['Ignoring critical alerts', 'Not acknowledging alerts when investigating', 'Resolving alerts without fixing root cause'],
      outputs: ['Acknowledged alerts', 'Resolved alerts', 'Alert history'],
      nextStep: 'Acknowledge alerts you are investigating, then resolve them after addressing the issue.',
      atoReferences: [
        {
          title: 'ATO Due Dates Calendar',
          url: 'https://www.ato.gov.au/business/business-activity-statements-bas-/lodging-and-paying-your-bas/bas-due-dates',
          description: 'Official ATO calendar for lodgment and payment due dates'
        },
        {
          title: 'Failure to Lodge on Time',
          url: 'https://www.ato.gov.au/businesses-and-organisations/preparing-lodging-and-paying/penalties-and-interest/failure-to-lodge-on-time-penalty',
          description: 'Understand penalties for late lodgment'
        },
      ],
    });
  }, [setCurrentHelpContent]);

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    if (alert.organizationId !== currentOrganizationId) return false;
    if (severityFilter !== 'all' && alert.severity !== severityFilter) return false;
    if (statusFilter !== 'all' && alert.status !== statusFilter) return false;
    return true;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handleAcknowledge = (alert: Alert) => {
    if (isReadOnly) {
      toast.error('Read-only mode: cannot acknowledge alerts');
      return;
    }
    acknowledgeAlert(alert.id, 'Current User');
    toast.success('Alert acknowledged');
    setSelectedAlert({ ...alert, status: 'acknowledged', acknowledgedAt: new Date().toISOString(), acknowledgedBy: 'Current User' });
  };

  const handleResolve = (alert: Alert) => {
    if (isReadOnly) {
      toast.error('Read-only mode: cannot resolve alerts');
      return;
    }
    resolveAlert(alert.id, 'Current User');
    toast.success('Alert resolved');
    setSelectedAlert(null);
  };

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical': return <AlertTriangle className="h-5 w-5 text-destructive" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-warning" />;
      case 'info': return <Info className="h-5 w-5 text-info" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor system alerts and compliance notifications
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto text-sm text-muted-foreground">
          {filteredAlerts.length} alert{filteredAlerts.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Alerts Table */}
      {filteredAlerts.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="No alerts"
          description="No alerts match your filters. All systems are operating normally."
        />
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlerts.map((alert) => (
                <TableRow
                  key={alert.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedAlert(alert)}
                >
                  <TableCell>{getSeverityIcon(alert.severity)}</TableCell>
                  <TableCell className="font-medium">{alert.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{alert.source}</TableCell>
                  <TableCell>
                    <StatusChip status={alert.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {alert.obligationId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/obligations/${alert.obligationId}`);
                        }}
                      >
                        View
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Alert Detail Sheet */}
      <Sheet open={!!selectedAlert} onOpenChange={() => setSelectedAlert(null)}>
        <SheetContent className="sm:max-w-xl">
          {selectedAlert && (
            <>
              <SheetHeader>
                <div className="flex items-start gap-3">
                  {getSeverityIcon(selectedAlert.severity)}
                  <div className="flex-1">
                    <SheetTitle>{selectedAlert.title}</SheetTitle>
                    <SheetDescription className="mt-1">
                      {selectedAlert.source} • {new Date(selectedAlert.createdAt).toLocaleString()}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div>
                  <h3 className="text-sm font-medium mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground">{selectedAlert.description}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Status</h3>
                  <StatusChip status={selectedAlert.status} />
                </div>

                {selectedAlert.acknowledgedAt && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Acknowledged</h3>
                    <p className="text-sm text-muted-foreground">
                      By {selectedAlert.acknowledgedBy} on {new Date(selectedAlert.acknowledgedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedAlert.resolvedAt && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Resolved</h3>
                    <p className="text-sm text-muted-foreground">
                      By {selectedAlert.resolvedBy} on {new Date(selectedAlert.resolvedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {selectedAlert.obligationId && (
                  <div>
                    <h3 className="text-sm font-medium mb-2">Related Obligation</h3>
                    <Button
                      variant="outline"
                      onClick={() => navigate(`/obligations/${selectedAlert.obligationId}`)}
                    >
                      View Obligation
                    </Button>
                  </div>
                )}

                {/* Actions */}
                {!isReadOnly && (
                  <div className="flex gap-2 pt-4 border-t">
                    {selectedAlert.status === 'open' && (
                      <Button onClick={() => handleAcknowledge(selectedAlert)}>
                        Acknowledge
                      </Button>
                    )}
                    {selectedAlert.status === 'acknowledged' && (
                      <Button onClick={() => handleResolve(selectedAlert)}>
                        Resolve
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
