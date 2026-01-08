import React, { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  ChevronDown
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { HelpDrawer } from './HelpDrawer';
import { cn } from './ui/utils';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Obligations', href: '/obligations', icon: FileText },
  { name: 'Ledger', href: '/ledger', icon: BookOpen },
  { name: 'Reconciliation', href: '/reconciliation', icon: GitMerge },
  { name: 'Evidence Packs', href: '/evidence-packs', icon: Archive },
  { name: 'Controls & Policies', href: '/controls', icon: Shield },
  { name: 'Incidents', href: '/incidents', icon: AlertTriangle },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { setHelpOpen } = useApp();

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0">
        <div className="p-6">
          <h1 className="text-xl font-semibold text-sidebar-foreground">APGMS</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Australian Tax Compliance
          </p>
        </div>

        <nav className="px-3 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-md transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-card flex-shrink-0">
          <div className="h-full px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              {/* Organization Selector */}
              <Select defaultValue="acme-corp">
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acme-corp">Acme Corporation</SelectItem>
                  <SelectItem value="demo-co">Demo Company</SelectItem>
                </SelectContent>
              </Select>

              {/* Period Selector */}
              <Select defaultValue="q4-2025">
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="q4-2025">Q4 2025</SelectItem>
                  <SelectItem value="q3-2025">Q3 2025</SelectItem>
                  <SelectItem value="q2-2025">Q2 2025</SelectItem>
                  <SelectItem value="q1-2025">Q1 2025</SelectItem>
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search obligations, packs, incidents..."
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* System Status */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--success)]/10 rounded-md">
                <div className="w-2 h-2 rounded-full bg-[var(--success)]" />
                <span className="text-xs font-medium text-[var(--success)]">All Systems Operational</span>
              </div>

              {/* Notifications */}
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
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
              <Button variant="ghost" className="gap-2">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  OP
                </div>
                <ChevronDown className="h-4 w-4" />
              </Button>
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
    </div>
  );
};
