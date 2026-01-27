import React, { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  BookOpen, 
  GitMerge, 
  Archive, 
  Shield, 
  AlertTriangle, 
  Settings, 
  HelpCircle,
  Search,
  Bell,
  ChevronDown,
  LogOut,
  FileBarChart,
  Wallet,
  Link2,
  Bot
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useAppStore } from '../store/appStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { HelpDrawer } from './HelpDrawer';
import { GlobalSearch } from './GlobalSearch';
import { cn } from './ui/utils';
import clearComplianceLogo from '@/assets/clearcompliance-logo.svg';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { setHelpOpen } = useApp();
  const { role, logout, isReadOnly } = useAuth();
  const { 
    currentOrganizationId, 
    currentPeriodId, 
    organizations, 
    periods, 
    alerts,
    setCurrentOrganization, 
    setCurrentPeriod 
  } = useAppStore();

  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Count open alerts
  const openAlertsCount = alerts.filter(a => a.status === 'open').length;

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Obligations', href: '/obligations', icon: FileText },
    { name: 'Funding', href: '/funding', icon: Wallet },
    { name: 'Ledger', href: '/ledger', icon: BookOpen },
    { name: 'Reconciliation', href: '/reconciliation', icon: GitMerge },
    { name: 'Evidence Packs', href: '/evidence-packs', icon: Archive },
    { name: 'Connectors', href: '/connectors', icon: Link2 },
    { name: 'AI Assistant', href: '/ai-assistant', icon: Bot },
    { name: 'Controls & Policies', href: '/controls', icon: Shield },
    { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
    { name: 'Alerts', href: '/alerts', icon: Bell, badge: openAlertsCount },
    { name: 'BAS Lodgment', href: '/bas', icon: FileBarChart },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const currentOrg = organizations.find(o => o.id === currentOrganizationId);
  const currentPeriod = periods.find(p => p.id === currentPeriodId);

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0">
        <div className="p-6 pb-4">
          <Link to="/" className="block">
            <img 
              src={clearComplianceLogo} 
              alt="ClearCompliance - Tax obligations. Clearly handled." 
              className="h-20 w-auto"
            />
          </Link>
        </div>

        <nav className="px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md transition-colors relative',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm flex-1">{item.name}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center text-xs px-1">
                    {item.badge}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Regulator Banner */}
        {isReadOnly && (
          <div className="bg-blue-600 text-white px-6 py-2 text-sm font-medium text-center">
            Regulator Review Mode - Read-Only Access
          </div>
        )}

        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card flex-shrink-0">
          <div className="h-full px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              {/* Organization Selector */}
              <Select value={currentOrganizationId} onValueChange={setCurrentOrganization}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Period Selector */}
              <Select value={currentPeriodId} onValueChange={setCurrentPeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map(period => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Search */}
              <button
                onClick={() => setSearchOpen(true)}
                className="relative flex-1 max-w-md text-left"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search obligations, packs, incidents..."
                  className="pl-10 cursor-pointer"
                  readOnly
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Environment Badge */}
              <Badge variant="outline" className="text-xs">
                Demo / Sandbox
              </Badge>

              {/* Role Badge */}
              {role && (
                <Badge variant="secondary" className="text-xs">
                  {role}
                </Badge>
              )}

              {/* Notifications */}
              <Button variant="ghost" size="icon" onClick={() => navigate('/alerts')}>
                <div className="relative">
                  <Bell className="h-5 w-5" />
                  {openAlertsCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-destructive rounded-full flex items-center justify-center text-[10px] text-destructive-foreground">
                      {openAlertsCount}
                    </span>
                  )}
                </div>
              </Button>

              {/* Help Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setHelpOpen(true)}
                aria-label="Open help"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                      {role?.substring(0, 2).toUpperCase() || 'U'}
                    </div>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{role || 'User'}</p>
                    <p className="text-xs text-muted-foreground">{currentOrg?.name}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Help Drawer */}
      <HelpDrawer />

      {/* Global Search */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};