import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

const SETUP_KEY = "apgms_demo_setup_v1";

export default function SetupWizard() {
  const navigate = useNavigate();

  function startDemo() {
    // Mark setup complete (simple + deterministic)
    localStorage.setItem(SETUP_KEY, new Date().toISOString());

    // Optional: set initial role/org/period defaults if you want
    // localStorage.setItem("apgms_role_v1", "operator");
    // localStorage.setItem("apgms_org_v1", "acme-corp");
    // localStorage.setItem("apgms_period_v1", "q4-2025");

    navigate("/", { replace: true });
  }

  function resetDemo() {
    localStorage.removeItem(SETUP_KEY);
    navigate("/setup", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>APGMS Demo Setup</CardTitle>
            <CardDescription>
              This wizard is a prototype entry gate. It exists so the demo behaves like
              production onboarding, even when all data is stubbed.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-md border p-4 bg-card">
              <div className="text-sm font-medium">What this enables</div>
              <ul className="mt-2 text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Route map parity (no dead links)</li>
                <li>Consistent demo state (org and period selection)</li>
                <li>RBAC boundary (operator vs regulator) later</li>
                <li>Evidence pack generation workflow later</li>
              </ul>
            </div>

            <div className="rounded-md border p-4 bg-card">
              <div className="text-sm font-medium">Demo note</div>
              <div className="mt-2 text-sm text-muted-foreground">
                This does not create real data yet. It only sets a local flag so the UI
                can enforce a first-run experience consistently.
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex items-center justify-between gap-3">
            <Button variant="outline" onClick={resetDemo}>
              Reset
            </Button>

            <Button onClick={startDemo}>
              Start demo
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
