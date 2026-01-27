import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { Dialog, DialogContent } from './ui/dialog';
import { Input } from './ui/input';
import { Search, FileText, Archive, AlertTriangle, Bell, Shield, Zap } from 'lucide-react';
import { cn } from './ui/utils';

interface SearchResult {
  id: string;
  type: 'obligation' | 'evidence-pack' | 'incident' | 'alert' | 'policy' | 'transaction';
  title: string;
  subtitle: string;
  path: string;
  icon: React.ElementType;
}

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ open, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  const {
    obligations,
    evidencePacks,
    incidents,
    alerts,
    policies,
    transactions,
    currentOrganizationId,
  } = useAppStore();

  // Build search index
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    // Search obligations
    obligations
      .filter(o => o.organizationId === currentOrganizationId)
      .forEach(o => {
        const matches = 
          o.title.toLowerCase().includes(lowerQuery) ||
          o.type.toLowerCase().includes(lowerQuery) ||
          o.status.toLowerCase().includes(lowerQuery) ||
          o.id.toLowerCase().includes(lowerQuery);
        
        if (matches) {
          results.push({
            id: o.id,
            type: 'obligation',
            title: o.title,
            subtitle: `${o.type} • ${o.status} • $${o.amount.toLocaleString()}`,
            path: `/obligations/${o.id}`,
            icon: FileText,
          });
        }
      });

    // Search evidence packs
    evidencePacks
      .filter(p => p.organizationId === currentOrganizationId)
      .forEach(p => {
        const matches = 
          p.name.toLowerCase().includes(lowerQuery) ||
          p.status.toLowerCase().includes(lowerQuery) ||
          p.id.toLowerCase().includes(lowerQuery);
        
        if (matches) {
          results.push({
            id: p.id,
            type: 'evidence-pack',
            title: p.name,
            subtitle: `${p.status} • ${p.items.length} items`,
            path: '/evidence-packs',
            icon: Archive,
          });
        }
      });

    // Search incidents
    incidents
      .filter(i => i.organizationId === currentOrganizationId)
      .forEach(i => {
        const matches = 
          i.title.toLowerCase().includes(lowerQuery) ||
          i.description.toLowerCase().includes(lowerQuery) ||
          i.status.toLowerCase().includes(lowerQuery) ||
          i.severity.toLowerCase().includes(lowerQuery);
        
        if (matches) {
          results.push({
            id: i.id,
            type: 'incident',
            title: i.title,
            subtitle: `${i.severity} • ${i.status}`,
            path: '/incidents',
            icon: AlertTriangle,
          });
        }
      });

    // Search alerts
    alerts
      .filter(a => a.organizationId === currentOrganizationId)
      .forEach(a => {
        const matches = 
          a.title.toLowerCase().includes(lowerQuery) ||
          a.description.toLowerCase().includes(lowerQuery) ||
          a.status.toLowerCase().includes(lowerQuery) ||
          a.severity.toLowerCase().includes(lowerQuery);
        
        if (matches) {
          results.push({
            id: a.id,
            type: 'alert',
            title: a.title,
            subtitle: `${a.severity} • ${a.status}`,
            path: '/alerts',
            icon: Bell,
          });
        }
      });

    // Search policies
    policies
      .filter(p => p.organizationId === currentOrganizationId)
      .forEach(p => {
        const matches = 
          p.name.toLowerCase().includes(lowerQuery) ||
          p.type.toLowerCase().includes(lowerQuery) ||
          p.description.toLowerCase().includes(lowerQuery);
        
        if (matches) {
          results.push({
            id: p.id,
            type: 'policy',
            title: p.name,
            subtitle: `${p.type} • v${p.version}`,
            path: '/controls',
            icon: Shield,
          });
        }
      });

    // Search transactions
    transactions
      .filter(t => t.organizationId === currentOrganizationId)
      .forEach(t => {
        const matches = 
          t.description.toLowerCase().includes(lowerQuery) ||
          t.category.toLowerCase().includes(lowerQuery) ||
          t.id.toLowerCase().includes(lowerQuery);
        
        if (matches) {
          results.push({
            id: t.id,
            type: 'transaction',
            title: t.description,
            subtitle: `${t.type} • $${Math.abs(t.amount).toLocaleString()}`,
            path: '/ledger',
            icon: Zap,
          });
        }
      });

    return results.slice(0, 20); // Limit to 20 results
  }, [query, obligations, evidencePacks, incidents, alerts, policies, transactions, currentOrganizationId]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchResults]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, searchResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && searchResults[selectedIndex]) {
        e.preventDefault();
        handleSelect(searchResults[selectedIndex]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, searchResults, selectedIndex]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.path);
    handleClose();
  };

  const handleClose = () => {
    setQuery('');
    setSelectedIndex(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl p-0">
        <div className="flex items-center border-b border-border px-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search obligations, packs, incidents, alerts..."
            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
            autoFocus
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {query.trim() === '' ? (
            <div className="p-8 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Start typing to search across obligations, evidence packs, incidents, alerts, and more...
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No results found for "{query}"
              </p>
            </div>
          ) : (
            <div className="py-2">
              {searchResults.map((result, index) => {
                const Icon = result.icon;
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                      index === selectedIndex ? 'bg-accent' : 'hover:bg-accent/50'
                    )}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {result.type.replace('-', ' ')}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {searchResults.length > 0 && (
          <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground flex items-center justify-between">
            <div>
              Use ↑↓ to navigate, Enter to select, Esc to close
            </div>
            <div>
              {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
