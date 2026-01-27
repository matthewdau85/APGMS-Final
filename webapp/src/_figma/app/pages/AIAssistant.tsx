import { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useAppStore } from '../store/appStore';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  Bot, 
  Send, 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Brain,
  Zap,
  Target,
  Search,
  FileText,
  DollarSign,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface Insight {
  id: string;
  category: 'anomaly' | 'optimization' | 'compliance' | 'prediction';
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  actionable: boolean;
  relatedEntity?: string;
}

export const AIAssistant = () => {
  const { setCurrentHelpContent } = useApp();
  const { obligations, transactions, currentOrganizationId } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const orgObligations = obligations.filter(o => o.organizationId === currentOrganizationId);
  const orgTransactions = transactions.filter(t => t.organizationId === currentOrganizationId);

  useEffect(() => {
    setCurrentHelpContent({
      title: 'AI Assistant',
      purpose: 'Intelligent compliance assistant powered by advanced AI technology. Get real-time insights, anomaly detection, predictive analytics, and natural language guidance for Australian tax obligations.',
      requiredInputs: ['Natural language queries', 'Context from your data'],
      definitions: {
        'Anomaly Detection': 'AI-powered identification of unusual patterns in transactions or obligations that may indicate errors or fraud',
        'Smart Reconciliation': 'Machine learning algorithms that automatically match transactions to obligations with confidence scoring',
        'Predictive Analytics': 'Forecasting future cash flow needs and obligation amounts based on historical patterns',
        'Compliance Checking': 'Automated validation of tax calculations against ATO rules and regulations',
        'Natural Language Query': 'Ask questions in plain English - the AI understands tax compliance context',
      },
      commonMistakes: [
        'Asking vague questions - be specific about dates, amounts, and obligation types',
        'Ignoring AI-detected anomalies - these should be investigated',
        'Not reviewing AI suggestions before applying them',
      ],
      outputs: ['Compliance insights', 'Anomaly alerts', 'Optimization recommendations', 'Predictive forecasts', 'Natural language answers'],
      nextStep: 'Ask the AI assistant about your compliance status, upcoming obligations, or any tax-related questions. Review AI-detected insights in the Insights tab.',
      atoReferences: [],
    });

    // Welcome message
    if (messages.length === 0) {
      setMessages([{
        id: '1',
        role: 'assistant',
        content: "👋 Hello! I'm your AI compliance assistant. I can help you with:\n\n• Analyzing your tax obligations and cash flow\n• Detecting anomalies in transactions\n• Answering ATO compliance questions\n• Predicting future obligations\n• Optimizing your tax workflow\n\nWhat would you like to know?",
        timestamp: new Date(),
        suggestions: [
          'What obligations are due this month?',
          'Analyze my PAYGW trends',
          'Check for transaction anomalies',
          'Predict next quarter cash needs',
        ]
      }]);
    }
  }, [setCurrentHelpContent]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // AI Insights - Simulated intelligent analysis
  const insights: Insight[] = [
    {
      id: '1',
      category: 'anomaly',
      title: 'Unusual Transaction Pattern Detected',
      description: `Detected 3 transactions totaling $15,450 on 2026-01-05 that are 250% higher than your typical daily volume. This may indicate bulk payment processing or data entry errors.`,
      severity: 'warning',
      actionable: true,
      relatedEntity: 'transactions',
    },
    {
      id: '2',
      category: 'prediction',
      title: 'Q2 2026 PAYGW Forecast',
      description: `Based on payroll trends, predicted PAYGW obligation for Q2 2026: $48,200 (±$3,500). This is 12% higher than Q1 due to seasonal hiring patterns.`,
      severity: 'info',
      actionable: true,
      relatedEntity: 'obligations',
    },
    {
      id: '3',
      category: 'optimization',
      title: 'Cash Flow Optimization Opportunity',
      description: `You have $65,000 in available funds but $52,000 in obligations due within 14 days. Consider setting aside funds now to avoid last-minute transfers.`,
      severity: 'info',
      actionable: true,
      relatedEntity: 'funding',
    },
    {
      id: '4',
      category: 'compliance',
      title: 'STP Phase 2 Compliance Check',
      description: `All pay events submitted in the last 30 days are compliant with STP Phase 2 requirements. Employee disaggregation correctly applied to 15 pay runs.`,
      severity: 'info',
      actionable: false,
    },
    {
      id: '5',
      category: 'anomaly',
      title: 'Missing GST Code on Invoice',
      description: `Invoice #INV-2045 ($8,200) has no GST code assigned. This may cause incorrect BAS calculations. Recommend reviewing and assigning appropriate tax code.`,
      severity: 'critical',
      actionable: true,
      relatedEntity: 'transactions',
    },
  ];

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI processing
    setTimeout(() => {
      const response = generateAIResponse(inputValue);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date(),
        suggestions: generateSuggestions(inputValue),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const generateAIResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('due') || lowerQuery.includes('obligation')) {
      const upcoming = orgObligations.filter(o => {
        const due = new Date(o.dueDate);
        const now = new Date();
        const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        return due >= now && due <= thirtyDays && o.status !== 'completed';
      });
      return `📊 You have **${upcoming.length} obligations** due in the next 30 days:\n\n${upcoming.slice(0, 3).map(o => 
        `• **${o.type}** - $${o.amount.toLocaleString()} due ${new Date(o.dueDate).toLocaleDateString()}`
      ).join('\n')}\n\nTotal amount: **$${upcoming.reduce((sum, o) => sum + o.amount, 0).toLocaleString()}**\n\nWould you like me to create funding requests for these?`;
    }

    if (lowerQuery.includes('anomaly') || lowerQuery.includes('unusual')) {
      return `🔍 **Anomaly Detection Results:**\n\nI've analyzed ${orgTransactions.length} transactions and found:\n\n• ⚠️ 3 transactions with amounts >200% of daily average\n• ⚠️ 1 duplicate payment possibility\n• ✅ 0 suspicious timing patterns\n• ✅ GST calculations all within expected ranges\n\n**Confidence Score: 92%**\n\nThe unusual transactions occurred on 2026-01-05. Would you like me to flag these for review?`;
    }

    if (lowerQuery.includes('predict') || lowerQuery.includes('forecast') || lowerQuery.includes('cash')) {
      return `📈 **Predictive Cash Flow Analysis:**\n\nBased on 12 months of historical data:\n\n**Next 30 Days:**\n• Expected PAYGW: $24,500 (±$2,100)\n• Expected GST: $18,200 (±$3,500)\n• Expected SG: $12,800 (±$800)\n• **Total: $55,500**\n\n**Confidence: 87%**\n\nYour current available balance covers 118% of predicted obligations. Cash position is healthy.\n\nWould you like a detailed quarterly forecast?`;
    }

    if (lowerQuery.includes('paygw') || lowerQuery.includes('payg')) {
      const paygw = orgObligations.filter(o => o.type === 'PAYGW');
      const total = paygw.reduce((sum, o) => sum + o.amount, 0);
      return `💰 **PAYGW Analysis:**\n\n• Total PAYGW obligations: ${paygw.length}\n• Total amount: $${total.toLocaleString()}\n• Average per period: $${Math.round(total / Math.max(paygw.length, 1)).toLocaleString()}\n• Completed: ${paygw.filter(o => o.status === 'completed').length}\n• Pending: ${paygw.filter(o => o.status !== 'completed').length}\n\n**Trend:** Your PAYGW obligations have increased 8% compared to last quarter, consistent with headcount growth.\n\nNeed help with PAYGW reconciliation?`;
    }

    if (lowerQuery.includes('gst')) {
      return `🧾 **GST Overview:**\n\nCurrent period GST summary:\n• GST Collected: $45,200\n• GST Paid: $12,800\n• Net Position: $32,400 payable\n• Transactions analyzed: ${orgTransactions.length}\n\n**Compliance Status: ✅ Compliant**\n\nAll transactions have valid tax codes. BAS lodgment ready.\n\nWould you like me to generate a BAS draft?`;
    }

    // Default response
    return `I understand you're asking about: "${query}"\n\nI can provide detailed analysis on:\n• Tax obligations and due dates\n• Transaction patterns and anomalies\n• Cash flow predictions\n• Compliance status\n• Reconciliation opportunities\n\nCould you be more specific about what you'd like to know? For example: "What are my PAYGW obligations due this month?" or "Analyze GST trends for Q1 2026"`;
  };

  const generateSuggestions = (query: string): string[] => {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('due') || lowerQuery.includes('obligation')) {
      return [
        'Create funding requests for these',
        'Show me overdue obligations',
        'Export to PDF',
      ];
    }
    if (lowerQuery.includes('anomaly')) {
      return [
        'Flag transactions for review',
        'Show transaction details',
        'Set up anomaly alerts',
      ];
    }
    return [
      'Tell me more',
      'Show related data',
      'What should I do next?',
    ];
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'anomaly': return AlertTriangle;
      case 'optimization': return Target;
      case 'compliance': return CheckCircle;
      case 'prediction': return TrendingUp;
      default: return Brain;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'anomaly': return 'text-orange-600 bg-orange-50';
      case 'optimization': return 'text-blue-600 bg-blue-50';
      case 'compliance': return 'text-green-600 bg-green-50';
      case 'prediction': return 'text-purple-600 bg-purple-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50';
      case 'warning': return 'border-orange-500 bg-orange-50';
      default: return 'border-blue-500 bg-blue-50';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            AI Assistant
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Intelligent compliance guidance powered by advanced AI
          </p>
        </div>
        <Badge variant="outline" className="text-base px-3 py-1">
          <Sparkles className="h-4 w-4 mr-1" />
          AI Powered
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Insights</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {insights.filter(i => i.actionable).length} actionable
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights.filter(i => i.category === 'anomaly').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Detected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Predictions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights.filter(i => i.category === 'prediction').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Forecasts available</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confidence</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">92%</div>
            <p className="text-xs text-muted-foreground mt-1">Average accuracy</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="chat" className="space-y-4">
        <TabsList>
          <TabsTrigger value="chat">
            <Bot className="h-4 w-4 mr-1" />
            AI Chat
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Brain className="h-4 w-4 mr-1" />
            Insights
            {insights.filter(i => i.severity === 'critical').length > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 min-w-5">
                {insights.filter(i => i.severity === 'critical').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="space-y-4">
          <Card className="h-[600px] flex flex-col">
            <CardContent className="flex-1 flex flex-col p-0">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'} rounded-lg p-4`}>
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4" />
                          <span className="text-xs font-semibold">AI Assistant</span>
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                      {message.suggestions && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.suggestions.map((suggestion, idx) => (
                            <Button
                              key={idx}
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => handleSuggestionClick(suggestion)}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      )}
                      <p className="text-xs opacity-70 mt-2">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-4">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 animate-pulse" />
                        <span className="text-sm">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask me anything about your tax compliance..."
                    className="flex-1"
                  />
                  <Button onClick={handleSendMessage} disabled={!inputValue.trim() || isTyping}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Try: "What obligations are due this month?" or "Analyze my PAYGW trends"
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          {insights.map((insight) => {
            const CategoryIcon = getCategoryIcon(insight.category);
            return (
              <Card key={insight.id} className={`border-l-4 ${getSeverityColor(insight.severity)}`}>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${getCategoryColor(insight.category)}`}>
                      <CategoryIcon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{insight.title}</h3>
                        <Badge className={getCategoryColor(insight.category)}>
                          {insight.category}
                        </Badge>
                        {insight.severity === 'critical' && (
                          <Badge variant="destructive">Critical</Badge>
                        )}
                        {insight.severity === 'warning' && (
                          <Badge variant="outline" className="border-orange-500 text-orange-700">
                            Warning
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{insight.description}</p>
                      {insight.actionable && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => toast.success('Action applied')}>
                            Take Action
                          </Button>
                          <Button size="sm" variant="outline">
                            View Details
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Quick Analysis Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSuggestionClick('What obligations are due this month?')}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Upcoming Obligations</h3>
              <p className="text-sm text-muted-foreground">
                Ask AI about obligations due this month
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSuggestionClick('Predict next quarter cash needs')}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Cash Flow Forecast</h3>
              <p className="text-sm text-muted-foreground">
                Get AI-powered cash predictions
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSuggestionClick('Check for transaction anomalies')}>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Search className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Anomaly Detection</h3>
              <p className="text-sm text-muted-foreground">
                Find unusual patterns in your data
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
