import React from "react";
import { Card } from "../../shared/components/ui/card";
import { Button } from "../../shared/components/ui/button";
import { Input } from "../../shared/components/ui/input";
import { Label } from "../../shared/components/ui/label";
import { Separator } from "../../shared/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "../../shared/components/ui/radio-group";
import { ClearComplianceTrainingAddonToggle } from "../addons/clearcompliance-training";

export const Settings: React.FC = () => {
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");
  const [companyName, setCompanyName] = React.useState("");
  const [contactEmail, setContactEmail] = React.useState("");

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Customize your APGMS experience including visual preferences, organization details, and add-ons.
        </p>
      </div>

      <Separator />

      {/* Visual Preferences */}
      <Card className="border border-border bg-card p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Visual Preferences</h3>
            <p className="text-sm text-muted-foreground">
              Choose how the console appears for your user profile.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Theme</Label>
            <RadioGroup
              value={theme}
              onValueChange={(v) => setTheme(v as "dark" | "light")}
              className="flex flex-col gap-2"
            >
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <RadioGroupItem value="dark" />
                Dark
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <RadioGroupItem value="light" />
                Light
              </label>
            </RadioGroup>
          </div>

          <div className="pt-2">
            <Button type="button" variant="secondary">
              Save preferences
            </Button>
          </div>
        </div>
      </Card>

      {/* Organization */}
      <Card className="border border-border bg-card p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Organization</h3>
            <p className="text-sm text-muted-foreground">
              Basic organization details used across evidence packs and reports.
            </p>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName" className="text-sm font-medium text-foreground">
                Company name
              </Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Example Pty Ltd"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactEmail" className="text-sm font-medium text-foreground">
                Contact email
              </Label>
              <Input
                id="contactEmail"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="compliance@example.com"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button type="button" variant="secondary">
              Save organization
            </Button>
          </div>
        </div>
      </Card>

      {/* User Preferences */}
      <Card className="border border-border bg-card p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">User Preferences</h3>
            <p className="text-sm text-muted-foreground">
              Optional behavior settings (prototype placeholders).
            </p>
          </div>

          <Separator />

          <div className="text-sm text-muted-foreground">
            This section is reserved for future user-level preferences (notifications, dashboard widgets, and workflow
            defaults).
          </div>
        </div>
      </Card>

      {/* Add-ons */}
      <Card className="border border-border bg-card p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Add-ons</h3>
            <p className="text-sm text-muted-foreground">
              Optional modules you can enable for this organization.
            </p>
          </div>
          <Separator />
          <ClearComplianceTrainingAddonToggle />
        </div>
      </Card>

      {/* Account Info */}
      <Card className="border border-border bg-card p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Account</h3>
            <p className="text-sm text-muted-foreground">Session and account actions (prototype placeholders).</p>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary">
              Change password
            </Button>
            <Button type="button" variant="secondary">
              Sign out
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
