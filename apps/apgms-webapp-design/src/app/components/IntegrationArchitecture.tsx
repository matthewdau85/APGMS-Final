import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ArrowRight, Database, Zap, Shield, Bot, Cpu } from 'lucide-react';

export const IntegrationArchitecture = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            MCP Integration Architecture
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            APGMS uses <strong>Model Context Protocol (MCP)</strong> as the foundation for intelligent data integration. 
            MCP enables AI-driven data transformation, semantic mapping, and real-time synchronization across diverse external systems.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                Protocol Layer
              </h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• <strong>OAuth2:</strong> Secure authorization (Xero, MYOB, Deputy)</li>
                <li>• <strong>REST API:</strong> Modern web services</li>
                <li>• <strong>SBR:</strong> ATO Standard Business Reporting</li>
                <li>• <strong>SOAP:</strong> Legacy enterprise systems</li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Database className="h-4 w-4 text-green-600" />
                Data Transformation
              </h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Semantic field mapping</li>
                <li>• Tax code normalization</li>
                <li>• Currency conversion</li>
                <li>• Duplicate detection</li>
                <li>• Data validation</li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-purple-600" />
                Security
              </h4>
              <ul className="text-xs space-y-1 text-muted-foreground">
                <li>• Encrypted credential storage</li>
                <li>• Token refresh automation</li>
                <li>• Audit trail for all syncs</li>
                <li>• RBAC enforcement</li>
                <li>• Secure key management</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold text-sm mb-3">Data Flow Architecture</h4>
            <div className="flex items-center justify-between text-xs">
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-2">
                  <span className="text-2xl">📊</span>
                </div>
                <p className="font-medium">External System</p>
                <p className="text-muted-foreground">Xero, MYOB, etc.</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-2">
                  <Zap className="h-8 w-8 text-purple-600" />
                </div>
                <p className="font-medium">MCP Layer</p>
                <p className="text-muted-foreground">Protocol Handler</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-2">
                  <Bot className="h-8 w-8 text-orange-600" />
                </div>
                <p className="font-medium">AI Engine</p>
                <p className="text-muted-foreground">Transformation</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-2">
                  <Database className="h-8 w-8 text-green-600" />
                </div>
                <p className="font-medium">APGMS</p>
                <p className="text-muted-foreground">Obligations</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Technology Implementation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            APGMS leverages advanced AI capabilities for intelligent compliance automation, anomaly detection, 
            and predictive analytics to reduce manual effort and improve accuracy.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-600" />
                Machine Learning Features
              </h4>
              <ul className="text-xs space-y-2 text-muted-foreground">
                <li>
                  <strong>Smart Reconciliation:</strong> AI matches bank transactions to obligations with 
                  confidence scoring based on amount, date, and entity patterns.
                </li>
                <li>
                  <strong>Anomaly Detection:</strong> Statistical models identify unusual patterns (outliers, 
                  duplicates, timing anomalies) that may indicate errors or fraud.
                </li>
                <li>
                  <strong>Predictive Analytics:</strong> Time-series forecasting predicts future obligation 
                  amounts and cash flow needs based on historical data.
                </li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Bot className="h-4 w-4 text-purple-600" />
                Natural Language Processing
              </h4>
              <ul className="text-xs space-y-2 text-muted-foreground">
                <li>
                  <strong>Conversational AI:</strong> Ask questions in plain English about obligations, 
                  compliance status, and tax calculations.
                </li>
                <li>
                  <strong>Context-Aware Responses:</strong> AI understands Australian tax terminology 
                  (PAYGW, GST, BAS, STP) and provides relevant answers.
                </li>
                <li>
                  <strong>Intelligent Search:</strong> Semantic search finds relevant entities even with 
                  partial or fuzzy queries.
                </li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-600" />
                Compliance Intelligence
              </h4>
              <ul className="text-xs space-y-2 text-muted-foreground">
                <li>
                  <strong>Rule Engine:</strong> Automated validation of tax calculations against ATO 
                  requirements and business rules.
                </li>
                <li>
                  <strong>Regulatory Updates:</strong> AI monitors ATO website for lodgment date changes 
                  and regulatory updates (simulated).
                </li>
                <li>
                  <strong>Risk Scoring:</strong> Calculate compliance risk scores based on multiple factors 
                  (overdue items, anomalies, coverage gaps).
                </li>
              </ul>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4 text-orange-600" />
                Automation Capabilities
              </h4>
              <ul className="text-xs space-y-2 text-muted-foreground">
                <li>
                  <strong>Auto-categorization:</strong> ML classifies transactions by tax type, GST rate, 
                  and deductibility.
                </li>
                <li>
                  <strong>Smart Suggestions:</strong> AI recommends next actions based on workflow state 
                  and historical patterns.
                </li>
                <li>
                  <strong>Workflow Optimization:</strong> Identifies bottlenecks and suggests process 
                  improvements.
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-blue-900">
              <Bot className="h-4 w-4" />
              How to Use AI in APGMS
            </h4>
            <ol className="text-xs space-y-1 text-blue-900 list-decimal list-inside">
              <li>Navigate to <strong>AI Assistant</strong> in the sidebar</li>
              <li>Ask questions like: "What obligations are due this month?" or "Analyze my PAYGW trends"</li>
              <li>Review AI-detected <strong>Insights</strong> for anomalies and optimization opportunities</li>
              <li>Use <strong>Smart Reconciliation</strong> to auto-match transactions with high confidence</li>
              <li>Check <strong>Predictive Forecasts</strong> for cash flow planning</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connector Implementation Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <h4 className="font-semibold text-sm">Recommended Integration Sequence:</h4>
          <ol className="text-sm space-y-3 list-decimal list-inside text-muted-foreground">
            <li>
              <strong>Start with Accounting:</strong> Connect Xero or MYOB first to import chart of accounts, 
              tax codes, and historical transactions.
            </li>
            <li>
              <strong>Add Payroll:</strong> Connect Deputy or Employment Hero to sync PAYGW withholding and 
              superannuation contributions.
            </li>
            <li>
              <strong>Enable Banking:</strong> Add NAB/CommBank for real-time bank feeds and payment initiation. 
              This enables automatic reconciliation.
            </li>
            <li>
              <strong>Connect POS (if applicable):</strong> For retail businesses, sync Square or Lightspeed 
              to track GST on sales transactions.
            </li>
            <li>
              <strong>Configure ATO SBR:</strong> Final step - set up ATO Standard Business Reporting with 
              digital certificates for direct lodgment.
            </li>
          </ol>

          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg mt-4">
            <p className="text-xs text-orange-900">
              <strong>⚠️ Note:</strong> This is a functional prototype. Real implementations require:
            </p>
            <ul className="text-xs text-orange-900 mt-2 space-y-1 list-disc list-inside">
              <li>Valid OAuth credentials from each provider</li>
              <li>ATO-issued digital certificates for SBR</li>
              <li>Proper data mapping and testing in sandbox environments</li>
              <li>Compliance review before production use</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
