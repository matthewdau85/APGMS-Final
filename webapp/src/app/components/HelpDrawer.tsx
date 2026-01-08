import React from 'react';
import { X } from 'lucide-react';
import { useApp, HelpContent } from '../context/AppContext';
import { Button } from './ui/button';

export const HelpDrawer: React.FC = () => {
  const { helpOpen, setHelpOpen, currentHelpContent } = useApp();

  if (!helpOpen || !currentHelpContent) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={() => setHelpOpen(false)}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-card border-l border-border z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Help & Guidance</h2>
              <p className="text-sm text-muted-foreground mt-1">{currentHelpContent.title}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setHelpOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="space-y-6">
            {/* Purpose */}
            <section>
              <h3 className="text-sm font-semibold text-foreground mb-2">Purpose</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {currentHelpContent.purpose}
              </p>
            </section>

            {/* Required Inputs */}
            {currentHelpContent.requiredInputs.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">Required Inputs</h3>
                <ul className="space-y-1">
                  {currentHelpContent.requiredInputs.map((input, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start">
                      <span className="mr-2">•</span>
                      <span>{input}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Definitions */}
            {Object.keys(currentHelpContent.definitions).length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">Definitions</h3>
                <dl className="space-y-2">
                  {Object.entries(currentHelpContent.definitions).map(([term, definition]) => (
                    <div key={term}>
                      <dt className="text-sm font-medium text-foreground">{term}</dt>
                      <dd className="text-sm text-muted-foreground mt-0.5 ml-4">{definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {/* Common Mistakes */}
            {currentHelpContent.commonMistakes.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-destructive mb-2">Common Mistakes</h3>
                <ul className="space-y-1">
                  {currentHelpContent.commonMistakes.map((mistake, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start">
                      <span className="mr-2">⚠</span>
                      <span>{mistake}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Outputs */}
            {currentHelpContent.outputs.length > 0 && (
              <section>
                <h3 className="text-sm font-semibold text-foreground mb-2">Outputs</h3>
                <ul className="space-y-1">
                  {currentHelpContent.outputs.map((output, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground flex items-start">
                      <span className="mr-2">→</span>
                      <span>{output}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Next Step */}
            <section className="pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground mb-2">Next Step</h3>
              <p className="text-sm text-muted-foreground">{currentHelpContent.nextStep}</p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
};
