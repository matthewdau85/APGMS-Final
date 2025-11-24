import { useState } from "react";
import { Box, Button, TextField, Stepper, Step, StepLabel } from "@mui/material";

export default function OnboardingWizard() {
  const [step, setStep] = useState(0);
  const [abn, setAbn] = useState("");
  const [tfn, setTfn] = useState("");
  // other state: bank, accounts, schedule…

  async function handleValidate() {
    const res = await fetch(`/onboarding/validate?abn=${abn}&tfn=${tfn}`, { credentials: "include" });
    await res.json();
    // use obligations response to populate subsequent steps, e.g. ["PAYGW", "GST"]
    setStep(1);
  }

  // … handlers for schedule & bank selection …

  return (
    <Box>
      <Stepper activeStep={step}>
        <Step><StepLabel>Verify ABN/TFN</StepLabel></Step>
        <Step><StepLabel>Bank & Schedules</StepLabel></Step>
        <Step><StepLabel>Summary</StepLabel></Step>
      </Stepper>
      {step === 0 && (
        <Box>
          <TextField label="ABN" value={abn} onChange={e => setAbn(e.target.value)} />
          <TextField label="TFN" value={tfn} onChange={e => setTfn(e.target.value)} />
          <Button onClick={handleValidate}>Next</Button>
        </Box>
      )}
      {/* Implement other steps similarly */}
    </Box>
  );
}
