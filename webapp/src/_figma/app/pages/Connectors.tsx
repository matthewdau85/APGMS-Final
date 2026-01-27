import { Switch } from '../components/ui/switch';
import { IntegrationArchitecture } from '../components/IntegrationArchitecture';
import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Settings2,
  Building2,
  Users,
  CreditCard,
  Landmark,
  ShoppingCart,
  FileText,
  Link2,
  Zap,
  Database,
  ArrowRight,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

// Connector type definitions
interface Connector {
  id: string;
  name: string;
  category: 'accounting' | 'payroll' | 'banking' | 'pos' | 'ato' | 'other';
  logo: string;
  description: string;
  protocol: 'REST' | 'SOAP' | 'SBR' | 'GraphQL' | 'OAuth2';
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  lastSync?: string;
  features: string[];
  dataFlows: {
    inbound: string[];
    outbound: string[];
  };
  requiredAuth: 'oauth' | 'api-key' | 'certificate' | 'credentials';
  setupComplexity: 'simple' | 'moderate' | 'complex';
}

const AVAILABLE_CONNECTORS: Connector[] = [
  // Accounting
  {
    id: 'xero',
    name: 'Xero',
    category: 'accounting',
    logo: '📊',
    description: 'Cloud accounting software - Auto-sync invoices, expenses, and reconciliation data',
    protocol: 'OAuth2',
    status: 'connected',
    lastSync: '2026-01-08T10:30:00',
    features: ['Invoices', 'Bills', 'Bank Transactions', 'Contacts', 'Chart of Accounts'],
    dataFlows: {
      inbound: ['Bank Transactions', 'Invoices', 'Bills', 'Tax Codes'],
      outbound: ['GST Returns', 'Payment Confirmations', 'Reconciliation Status'],
    },
    requiredAuth: 'oauth',
    setupComplexity: 'simple',
  },
  {
    id: 'myob',
    name: 'MYOB',
    category: 'accounting',
    logo: '📗',
    description: 'MYOB AccountRight & Essentials - Sync financial data and tax obligations',
    protocol: 'REST',
    status: 'disconnected',
    features: ['General Ledger', 'Payables', 'Receivables', 'Tax', 'Payroll'],
    dataFlows: {
      inbound: ['Transactions', 'Invoices', 'Tax Obligations', 'Employee Data'],
      outbound: ['Compliance Reports', 'Payment Status', 'Reconciliation Matches'],
    },
    requiredAuth: 'oauth',
    setupComplexity: 'moderate',
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    category: 'accounting',
    logo: '💚',
    description: 'Intuit QuickBooks - Comprehensive accounting integration',
    protocol: 'OAuth2',
    status: 'disconnected',
    features: ['Accounts', 'Transactions', 'Invoices', 'Tax', 'Reports'],
    dataFlows: {
      inbound: ['Bank Feeds', 'Invoice Data', 'Vendor Bills', 'Tax Settings'],
      outbound: ['BAS Data', 'Payment Records', 'Audit Logs'],
    },
    requiredAuth: 'oauth',
    setupComplexity: 'simple',
  },

  // Payroll
  {
    id: 'deputy',
    name: 'Deputy',
    category: 'payroll',
    logo: '👥',
    description: 'Workforce management - Sync timesheets and payroll data for PAYGW',
    protocol: 'REST',
    status: 'connected',
    lastSync: '2026-01-08T09:15:00',
    features: ['Timesheets', 'Rosters', 'Leave', 'Pay Runs', 'Employee Records'],
    dataFlows: {
      inbound: ['Pay Run Data', 'PAYG Withholding', 'Superannuation', 'Timesheets'],
      outbound: ['Tax Obligations', 'Compliance Status', 'Payment Confirmations'],
    },
    requiredAuth: 'oauth',
    setupComplexity: 'moderate',
  },
  {
    id: 'employment-hero',
    name: 'Employment Hero',
    category: 'payroll',
    logo: '🦸',
    description: 'HR & Payroll platform - Automated PAYGW and SG calculations',
    protocol: 'REST',
    status: 'disconnected',
    features: ['Payroll', 'Single Touch Payroll', 'Super', 'HR', 'Onboarding'],
    dataFlows: {
      inbound: ['STP Data', 'PAYGW Amounts', 'SG Contributions', 'Employee Changes'],
      outbound: ['Lodgment Status', 'Compliance Alerts', 'Payment Tracking'],
    },
    requiredAuth: 'oauth',
    setupComplexity: 'moderate',
  },

  // Banking
  {
    id: 'nab',
    name: 'NAB Connect',
    category: 'banking',
    logo: '🏦',
    description: 'National Australia Bank - Direct bank feed and payment initiation',
    protocol: 'REST',
    status: 'connected',
    lastSync: '2026-01-08T11:00:00',
    features: ['Bank Feeds', 'Balance Inquiry', 'Payment Initiation', 'Transaction History'],
    dataFlows: {
      inbound: ['Bank Transactions', 'Account Balances', 'Payment Status'],
      outbound: ['Payment Instructions', 'Reconciliation Requests'],
    },
    requiredAuth: 'oauth',
    setupComplexity: 'complex',
  },
  {
    id: 'commbank',
    name: 'CommBank API',
    category: 'banking',
    logo: '🟡',
    description: 'Commonwealth Bank - Real-time transaction feeds and payments',
    protocol: 'REST',
    status: 'disconnected',
    features: ['NetBank Feed', 'BPAY', 'Direct Debits', 'Statements'],
    dataFlows: {
      inbound: ['Transaction Feed', 'Account Info', 'Payment Confirmations'],
      outbound: ['BPAY Payments', 'Tax Payments', 'Bulk Transfers'],
    },
    requiredAuth: 'oauth',
    setupComplexity: 'complex',
  },

  // Point of Sale
  {
    id: 'square',
    name: 'Square',
    category: 'pos',
    logo: '⬛',
    description: 'POS & Payments - Sync sales data for GST calculations',
    protocol: 'REST',
    status: 'disconnected',
    features: ['Sales', 'Payments', 'Inventory', 'Customers', 'Tax Reports'],
    dataFlows: {
      inbound: ['Sales Transactions', 'GST Collected', 'Payment Methods', 'Refunds'],
      outbound: ['Tax Summaries', 'Reconciliation Status'],
    },
    requiredAuth: 'oauth',
    setupComplexity: 'simple',
  },
  {
    id: 'lightspeed',
    name: 'Lightspeed Retail',
    category: 'pos',
    logo: '⚡',
    description: 'Retail POS - Comprehensive sales and inventory integration',
    protocol: 'REST',
    status: 'disconnected',
    features: ['Transactions', 'Inventory', 'Customers', 'Reports', 'Tax'],
    dataFlows: {
      inbound: ['Sales Data', 'GST by Rate', 'Customer Info', 'Payment Types'],
      outbound: ['Tax Compliance Reports', 'Period Summaries'],
    },
    requiredAuth: 'api-key',
    setupComplexity: 'moderate',
  },

  // ATO
  {
    id: 'ato-sbr',
    name: 'ATO Standard Business Reporting',
    category: 'ato',
    logo: '🇦🇺',
    description: 'Official ATO gateway - Direct BAS/IAS lodgment via SBR protocol',
    protocol: 'SBR',
    status: 'connected',
    lastSync: '2026-01-08T08:00:00',
    features: ['BAS Lodgment', 'IAS', 'Prefill Data', 'Lodgment History', 'ATO Notices'],
    dataFlows: {
      inbound: ['Prefill Data', 'Obligation Dates', 'ATO Notices', 'Lodgment Receipts'],
      outbound: ['BAS Returns', 'IAS Returns', 'STP Reports', 'Amendment Requests'],
    },
    requiredAuth: 'certificate',
    setupComplexity: 'complex',
  },
  {
    id: 'ato-stp',
    name: 'ATO Single Touch Payroll',
    category: 'ato',
    logo: '📋',
    description: 'STP Phase 2 - Real-time payroll reporting to ATO',
    protocol: 'REST',
    status: 'connected',
    lastSync: '2026-01-08T07:30:00',
    features: ['Pay Events', 'Update Events', 'Finalisation', 'Employee Commencements'],
    dataFlows: {
      inbound: ['STP Status', 'Error Reports', 'ATO Feedback'],
      outbound: ['Pay Event Data', 'PAYGW Withholding', 'Super Liability', 'YTD Amounts'],
    },
    requiredAuth: 'certificate',
    setupComplexity: 'complex',
  },
];

export const Connectors = () => {
  const { setCurrentHelpContent } = useApp();
  const { canCreate, isReadOnly } = useAuth();
  const { currentOrganizationId } = useAppStore();

  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [connectors, setConnectors] = useState(AVAILABLE_CONNECTORS);
  const [configForm, setConfigForm] = useState({
    apiKey: '',
    clientId: '',
    clientSecret: '',
    environment: 'production' as 'production' | 'sandbox',
    autoSync: true,
    syncFrequency: '15' as '5' | '15' | '30' | '60',
  });

  useEffect(() => {
    setCurrentHelpContent({
      title: 'External Connectors',
      purpose: 'Integration framework for external stakeholders using MCP (Model Context Protocol) and industry-standard APIs. Connect to accounting systems, payroll platforms, banks, POS systems, and the ATO for automated data synchronization.',
      requiredInputs: ['Connector selection', 'Authentication credentials', 'Data mapping configuration', 'Sync preferences'],
      definitions: {
        'MCP': 'Model Context Protocol - A standardized protocol for AI-driven data integration and transformation',
        'OAuth2': 'Industry-standard authorization protocol for secure API access',
        'SBR': 'Standard Business Reporting - ATO\'s official protocol for government lodgments',
        'Data Flow': 'Directional data exchange - inbound (into APGMS) and outbound (to external systems)',
        'Auto-Sync': 'Automated periodic data synchronization without manual intervention',
      },
      commonMistakes: [
        'Using production credentials in test environments',
        'Not mapping all required tax codes from accounting systems',
        'Forgetting to enable auto-sync after initial connection',
        'Not validating data mapping before going live',
      ],
      outputs: ['Connected integrations', 'Synchronized data', 'Automated obligation creation', 'Real-time compliance status'],
      nextStep: 'Connect your accounting system first, then add payroll and banking integrations. Configure data mapping to ensure accurate tax calculations.',
      atoReferences: [
        {
          title: 'Standard Business Reporting',
          url: 'https://www.ato.gov.au/business/reports-and-returns/standard-business-reporting/',
          description: 'Official ATO documentation for SBR protocol and requirements'
        },
        {
          title: 'Single Touch Payroll',
          url: 'https://www.ato.gov.au/businesses-and-organisations/hiring-and-paying-your-workers/single-touch-payroll',
          description: 'STP reporting requirements and specifications'
        },
      ],
    });
  }, [setCurrentHelpContent]);

  const connectedCount = connectors.filter(c => c.status === 'connected').length;
  const activeCategories = new Set(connectors.filter(c => c.status === 'connected').map(c => c.category));

  const handleConnect = (connector: Connector) => {
    setSelectedConnector(connector);
    setShowConfigDialog(true);
  };

  const handleDisconnect = (connectorId: string) => {
    setConnectors(prev => 
      prev.map(c => c.id === connectorId ? { ...c, status: 'disconnected' as const, lastSync: undefined } : c)
    );
    toast.success('Connector disconnected');
  };

  const handleSync = (connectorId: string) => {
    const connector = connectors.find(c => c.id === connectorId);
    if (!connector) return;

    // Update status to syncing
    setConnectors(prev => 
      prev.map(c => c.id === connectorId ? { ...c, status: 'syncing' as const } : c)
    );

    toast.info(`Syncing ${connector.name}...`);

    // Simulate sync
    setTimeout(() => {
      setConnectors(prev => 
        prev.map(c => c.id === connectorId ? { 
          ...c, 
          status: 'connected' as const,
          lastSync: new Date().toISOString()
        } : c)
      );
      toast.success(`${connector.name} synced successfully`);
    }, 2000);
  };

  const handleSaveConfig = () => {
    if (!selectedConnector) return;

    if (selectedConnector.requiredAuth === 'oauth') {
      toast.info('Redirecting to OAuth authorization...');
      setTimeout(() => {
        setConnectors(prev => 
          prev.map(c => c.id === selectedConnector.id ? { 
            ...c, 
            status: 'connected' as const,
            lastSync: new Date().toISOString()
          } : c)
        );
        toast.success(`${selectedConnector.name} connected successfully`);
        setShowConfigDialog(false);
      }, 1500);
    } else if (selectedConnector.requiredAuth === 'api-key') {
      if (!configForm.apiKey) {
        toast.error('API key is required');
        return;
      }
      setConnectors(prev => 
        prev.map(c => c.id === selectedConnector.id ? { 
          ...c, 
          status: 'connected' as const,
          lastSync: new Date().toISOString()
        } : c)
      );
      toast.success(`${selectedConnector.name} connected successfully`);
      setShowConfigDialog(false);
    } else {
      toast.info('Certificate-based authentication requires additional setup. Contact your administrator.');
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'accounting': return Building2;
      case 'payroll': return Users;
      case 'banking': return Landmark;
      case 'pos': return ShoppingCart;
      case 'ato': return FileText;
      default: return Link2;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'accounting': return 'text-blue-600 bg-blue-50';
      case 'payroll': return 'text-purple-600 bg-purple-50';
      case 'banking': return 'text-green-600 bg-green-50';
      case 'pos': return 'text-orange-600 bg-orange-50';
      case 'ato': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const categories = [
    { id: 'all', label: 'All Connectors', icon: Link2 },
    { id: 'accounting', label: 'Accounting', icon: Building2 },
    { id: 'payroll', label: 'Payroll', icon: Users },
    { id: 'banking', label: 'Banking', icon: Landmark },
    { id: 'pos', label: 'Point of Sale', icon: ShoppingCart },
    { id: 'ato', label: 'ATO', icon: FileText },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">External Connectors</h1>
          <p className="text-sm text-muted-foreground mt-1">
            MCP-powered integrations with external stakeholders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-base px-3 py-1">
            <Zap className="h-4 w-4 mr-1" />
            {connectedCount} Connected
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Connectors</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectors.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {connectedCount} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Categories</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCategories.size}</div>
            <p className="text-xs text-muted-foreground mt-1">
              of {categories.length - 1} categories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Protocol Types</CardTitle>
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(connectors.map(c => c.protocol)).size}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              OAuth2, REST, SBR, SOAP
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {connectors.filter(c => c.lastSync).length > 0 ? 'Today' : 'None'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Auto-sync enabled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connectors by Category */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="grid grid-cols-7 w-full">
          {categories.map(cat => {
            const Icon = cat.icon;
            return (
              <TabsTrigger key={cat.id} value={cat.id}>
                <Icon className="h-4 w-4 mr-1" />
                {cat.label}
              </TabsTrigger>
            );
          })}
          <TabsTrigger value="docs">
            <Info className="h-4 w-4 mr-1" />
            Architecture
          </TabsTrigger>
        </TabsList>

        {categories.map(category => (
          <TabsContent key={category.id} value={category.id} className="space-y-3">
            {connectors
              .filter(c => category.id === 'all' || c.category === category.id)
              .map(connector => {
                const CategoryIcon = getCategoryIcon(connector.category);
                return (
                  <Card key={connector.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="text-4xl">{connector.logo}</div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold">{connector.name}</h3>
                            {connector.status === 'connected' && (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Connected
                              </Badge>
                            )}
                            {connector.status === 'syncing' && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                                Syncing
                              </Badge>
                            )}
                            {connector.status === 'error' && (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Error
                              </Badge>
                            )}
                            <Badge className={getCategoryColor(connector.category)}>
                              <CategoryIcon className="h-3 w-3 mr-1" />
                              {connector.category}
                            </Badge>
                            <Badge variant="secondary">
                              {connector.protocol}
                            </Badge>
                          </div>

                          <p className="text-sm text-muted-foreground mb-4">{connector.description}</p>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                <ArrowRight className="h-3 w-3 rotate-180" />
                                Inbound Data
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {connector.dataFlows.inbound.map((flow, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {flow}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                                <ArrowRight className="h-3 w-3" />
                                Outbound Data
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {connector.dataFlows.outbound.map((flow, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs">
                                    {flow}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>

                          {connector.lastSync && (
                            <p className="text-xs text-muted-foreground">
                              Last synced: {new Date(connector.lastSync).toLocaleString()}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          {connector.status === 'connected' ? (
                            <>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleSync(connector.id)}
                                disabled={isReadOnly || connector.status === 'syncing'}
                              >
                                <RefreshCw className="h-3 w-3" />
                                Sync Now
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleConnect(connector)}
                                disabled={isReadOnly}
                              >
                                <Settings2 className="h-3 w-3" />
                                Configure
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleDisconnect(connector.id)}
                                disabled={isReadOnly}
                              >
                                Disconnect
                              </Button>
                            </>
                          ) : (
                            <Button 
                              size="sm"
                              onClick={() => handleConnect(connector)}
                              disabled={isReadOnly}
                            >
                              <Plus className="h-3 w-3" />
                              Connect
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>
        ))}

        <TabsContent value="docs">
          <IntegrationArchitecture />
        </TabsContent>
      </Tabs>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedConnector && <span className="text-2xl">{selectedConnector.logo}</span>}
              Configure {selectedConnector?.name}
            </DialogTitle>
            <DialogDescription>
              Set up integration credentials and data sync preferences
            </DialogDescription>
          </DialogHeader>

          {selectedConnector && (
            <div className="space-y-4">
              {/* Protocol Info */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold mb-1">
                      Protocol: {selectedConnector.protocol}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Authentication: {selectedConnector.requiredAuth.toUpperCase()} • 
                      Setup: {selectedConnector.setupComplexity}
                    </p>
                  </div>
                </div>
              </div>

              {/* OAuth Flow */}
              {selectedConnector.requiredAuth === 'oauth' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Click "Authorize" to securely connect via OAuth 2.0. You'll be redirected to {selectedConnector.name} to grant permissions.
                  </p>
                  <div className="p-4 border border-dashed rounded-lg">
                    <p className="text-xs font-mono text-muted-foreground">
                      Scopes: accounting.transactions, accounting.contacts, accounting.settings
                    </p>
                  </div>
                </div>
              )}

              {/* API Key Flow */}
              {selectedConnector.requiredAuth === 'api-key' && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="apiKey">API Key *</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      value={configForm.apiKey}
                      onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                      placeholder="Enter your API key..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="environment">Environment</Label>
                    <select
                      id="environment"
                      className="w-full h-9 px-3 rounded-md border border-input bg-background"
                      value={configForm.environment}
                      onChange={(e) => setConfigForm({ ...configForm, environment: e.target.value as any })}
                    >
                      <option value="production">Production</option>
                      <option value="sandbox">Sandbox (Testing)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Certificate Flow */}
              {selectedConnector.requiredAuth === 'certificate' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    This connector requires digital certificate authentication. Contact your system administrator to upload your certificate.
                  </p>
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-xs text-orange-900">
                      ⚠️ Certificate-based authentication requires additional setup and ATO credentials.
                    </p>
                  </div>
                </div>
              )}

              {/* Sync Settings */}
              <div className="space-y-3 pt-4 border-t">
                <h4 className="font-semibold text-sm">Sync Settings</h4>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoSync">Automatic Sync</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable periodic background synchronization
                    </p>
                  </div>
                  <Switch
                    id="autoSync"
                    checked={configForm.autoSync}
                    onCheckedChange={(checked) => setConfigForm({ ...configForm, autoSync: checked })}
                  />
                </div>

                {configForm.autoSync && (
                  <div>
                    <Label htmlFor="syncFrequency">Sync Frequency</Label>
                    <select
                      id="syncFrequency"
                      className="w-full h-9 px-3 rounded-md border border-input bg-background"
                      value={configForm.syncFrequency}
                      onChange={(e) => setConfigForm({ ...configForm, syncFrequency: e.target.value as any })}
                    >
                      <option value="5">Every 5 minutes</option>
                      <option value="15">Every 15 minutes</option>
                      <option value="30">Every 30 minutes</option>
                      <option value="60">Every hour</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Data Mapping Preview */}
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs font-semibold mb-2">Data Mapping</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-muted-foreground">External Field</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">APGMS Field</p>
                  </div>
                  {selectedConnector.dataFlows.inbound.slice(0, 3).map((flow, idx) => (
                    <div key={idx} className="col-span-2 grid grid-cols-2 gap-2">
                      <Badge variant="outline" className="text-xs justify-center">
                        {flow}
                      </Badge>
                      <Badge variant="secondary" className="text-xs justify-center">
                        {flow.replace('Data', '').trim()}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig}>
              {selectedConnector?.requiredAuth === 'oauth' ? 'Authorize' : 'Save Configuration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};