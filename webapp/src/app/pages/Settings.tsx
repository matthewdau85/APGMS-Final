import React, { useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group';
import { Separator } from '../components/ui/separator';

export const Settings: React.FC = () => {
  const { theme, setTheme, density, setDensity, setCurrentHelpContent } = useApp();

  useEffect(() => {
    setCurrentHelpContent({
      title: 'Application Settings',
      purpose: 'Customize your APGMS experience including visual theme, information density, and user preferences. Changes are applied immediately and persisted across sessions.',
      requiredInputs: [],
      definitions: {
        'Theme': 'Visual appearance including colors and contrast levels',
        'Density': 'Amount of information displayed and spacing between elements',
        'Compliance Light': 'Default light theme optimized for compliance work',
        'Ops Dark': 'Dark theme for extended use and reduced eye strain',
        'Calm Neutral': 'Soft neutral colors for a calming work environment',
        'High Contrast': 'Maximum contrast for accessibility (WCAG AAA)',
      },
      commonMistakes: [
        'Not testing accessibility settings if you have vision requirements',
        'Using compact mode for extended periods may cause fatigue',
      ],
      outputs: [
        'Personalized user interface',
        'Saved preferences',
        'Improved accessibility',
      ],
      nextStep: 'Select your preferred theme and density, then continue working. Settings are automatically saved.',
    });
  }, [setCurrentHelpContent]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize your APGMS experience
        </p>
      </div>

      {/* Appearance Settings */}
      <Card className="p-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Appearance</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Customize the visual appearance of the application
            </p>
          </div>

          <Separator />

          {/* Theme Selection */}
          <div className="space-y-4">
            <Label className="text-base">Theme</Label>
            <RadioGroup value={theme} onValueChange={(value: any) => setTheme(value)}>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="compliance-light" id="theme-compliance-light" />
                  <div className="flex-1">
                    <Label htmlFor="theme-compliance-light" className="cursor-pointer">
                      Compliance Light
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Default light theme optimized for compliance and audit work
                    </p>
                  </div>
                  <div className="w-20 h-10 rounded border border-border bg-[#fafafa] flex items-center justify-center">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-[#2563eb]" />
                      <div className="w-2 h-2 rounded-full bg-[#f5f5f5]" />
                      <div className="w-2 h-2 rounded-full bg-[#171717]" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="ops-dark" id="theme-ops-dark" />
                  <div className="flex-1">
                    <Label htmlFor="theme-ops-dark" className="cursor-pointer">
                      Ops Dark
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Dark theme for operations and extended use
                    </p>
                  </div>
                  <div className="w-20 h-10 rounded border border-border bg-[#0a0a0a] flex items-center justify-center">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                      <div className="w-2 h-2 rounded-full bg-[#262626]" />
                      <div className="w-2 h-2 rounded-full bg-[#fafafa]" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="calm-neutral" id="theme-calm-neutral" />
                  <div className="flex-1">
                    <Label htmlFor="theme-calm-neutral" className="cursor-pointer">
                      Calm Neutral
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Soft neutral colors for a calm, focused environment
                    </p>
                  </div>
                  <div className="w-20 h-10 rounded border border-border bg-[#f8f8f7] flex items-center justify-center">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-[#6366f1]" />
                      <div className="w-2 h-2 rounded-full bg-[#f3f4f6]" />
                      <div className="w-2 h-2 rounded-full bg-[#3c3c3b]" />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="high-contrast" id="theme-high-contrast" />
                  <div className="flex-1">
                    <Label htmlFor="theme-high-contrast" className="cursor-pointer">
                      High Contrast
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Maximum contrast for accessibility (WCAG AAA compliant)
                    </p>
                  </div>
                  <div className="w-20 h-10 rounded border border-[#000000] bg-[#ffffff] flex items-center justify-center">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-[#0000ff]" />
                      <div className="w-2 h-2 rounded-full bg-[#f0f0f0]" />
                      <div className="w-2 h-2 rounded-full bg-[#000000]" />
                    </div>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>

          <Separator />

          {/* Density Selection */}
          <div className="space-y-4">
            <Label className="text-base">Information Density</Label>
            <RadioGroup value={density} onValueChange={(value: any) => setDensity(value)}>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="comfortable" id="density-comfortable" />
                  <div className="flex-1">
                    <Label htmlFor="density-comfortable" className="cursor-pointer">
                      Comfortable
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      More spacing between elements for easier reading (recommended)
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <RadioGroupItem value="compact" id="density-compact" />
                  <div className="flex-1">
                    <Label htmlFor="density-compact" className="cursor-pointer">
                      Compact
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      More information visible at once, less spacing
                    </p>
                  </div>
                </div>
              </div>
            </RadioGroup>
          </div>
        </div>
      </Card>

      {/* User Preferences */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">User Preferences</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Additional application preferences
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label className="text-sm">Default View</Label>
              <p className="text-sm text-muted-foreground mt-1">Dashboard</p>
            </div>
            <div>
              <Label className="text-sm">Date Format</Label>
              <p className="text-sm text-muted-foreground mt-1">YYYY-MM-DD (ISO)</p>
            </div>
            <div>
              <Label className="text-sm">Currency Format</Label>
              <p className="text-sm text-muted-foreground mt-1">AUD ($)</p>
            </div>
            <div>
              <Label className="text-sm">Time Zone</Label>
              <p className="text-sm text-muted-foreground mt-1">Australia/Sydney (AEDT)</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Account Info */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Account Information</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Your account details and role
            </p>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-6">
            <div>
              <Label className="text-sm">User Name</Label>
              <p className="text-sm text-muted-foreground mt-1">Operator</p>
            </div>
            <div>
              <Label className="text-sm">Role</Label>
              <p className="text-sm text-muted-foreground mt-1">Operator</p>
            </div>
            <div>
              <Label className="text-sm">Email</Label>
              <p className="text-sm text-muted-foreground mt-1">operator@acme.com.au</p>
            </div>
            <div>
              <Label className="text-sm">Last Login</Label>
              <p className="text-sm text-muted-foreground mt-1">2026-01-04 09:15 AEDT</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
