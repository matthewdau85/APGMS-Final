import React, { createContext, useContext, useState, ReactNode } from 'react';

type Theme = 'compliance-light' | 'ops-dark' | 'calm-neutral' | 'high-contrast';
type Density = 'comfortable' | 'compact';

interface AppContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  density: Density;
  setDensity: (density: Density) => void;
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  currentHelpContent: HelpContent | null;
  setCurrentHelpContent: (content: HelpContent | null) => void;
}

export interface HelpContent {
  title: string;
  purpose: string;
  requiredInputs: string[];
  definitions: Record<string, string>;
  commonMistakes: string[];
  outputs: string[];
  nextStep: string;
  atoReferences?: {
    title: string;
    url: string;
    description: string;
  }[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('compliance-light');
  const [density, setDensity] = useState<Density>('comfortable');
  const [helpOpen, setHelpOpen] = useState(false);
  const [currentHelpContent, setCurrentHelpContent] = useState<HelpContent | null>(null);

  React.useEffect(() => {
    const root = document.documentElement;
    root.className = '';
    
    if (theme === 'ops-dark') {
      root.classList.add('theme-ops-dark');
    } else if (theme === 'calm-neutral') {
      root.classList.add('theme-calm-neutral');
    } else if (theme === 'high-contrast') {
      root.classList.add('theme-high-contrast');
    }
    
    if (density === 'compact') {
      root.classList.add('density-compact');
    }
  }, [theme, density]);

  return (
    <AppContext.Provider
      value={{
        theme,
        setTheme,
        density,
        setDensity,
        helpOpen,
        setHelpOpen,
        currentHelpContent,
        setCurrentHelpContent,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};