import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

import {
  compileDemoBas,
  generateDemoBankLines,
  runDemoPayroll,
} from "./api";
import { getToken } from "./auth";

type BankFeedState = {
  busy: boolean;
  summary?: string;
  rows?: Array<{ id: string; amount: number; date: string }>;
  error?: string;
};

type PayrollState = {
  busy: boolean;
  summary?: string;
  error?: string;
};

type BasState = {
  busy: boolean;
  summary?: string;
  error?: string;
};

export default function DemoPage() {
  const token = getToken();
  const [bankState, setBankState] = useState<BankFeedState>({ busy: false });
  const [demoDays, setDemoDays] = useState(7);
  const [demoIntensity, setDemoIntensity] = useState<"low" | "high">("low");
  const [bankFormError, setBankFormError] = useState<string | null>(null);

  const [payrollState, setPayrollState] = useState<PayrollState>({ busy: false });
  const [includeBank, setIncludeBank] = useState(true);

  const [basState, setBasState] = useState<BasState>({ busy: false });
  const [basFormError, setBasFormError] = useState<string | null>(null);
  const [basPeriod, setBasPeriod] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
  });

  const renderSummary = (label: string, text?: string) => {
    if (!text) return null;
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {label}
        </Typography>
        <Box
          component="pre"
          sx={{
            mt: 1,
            fontFamily: "Roboto Mono, monospace",
            fontSize: 13,
            bgcolor: "background.paper",
            borderRadius: 1,
            p: 2,
            border: "1px solid",
            borderColor: "divider",
            overflowX: "auto",
          }}
        >
          {text}
        </Box>
      </Box>
    );
  };

  const validateBankInputs = () => {
    if (demoDays < 1 || demoDays > 30) {
      setBankFormError("Days back must be between 1 and 30.");
      return false;
    }
    setBankFormError(null);
    return true;
  };

  const validateBasInputs = () => {
    if (basPeriod.year < 2020 || basPeriod.year > 2100) {
      setBasFormError("Year must be between 2020 and 2100.");
      return false;
    }
    if (basPeriod.month < 1 || basPeriod.month > 12) {
      setBasFormError("Month must be between 1 and 12.");
      return false;
    }
    setBasFormError(null);
    return true;
  };

  const handleGenerateBankFeed = async () => {
    if (!token || !validateBankInputs()) return;
    setBankState({ busy: true });
    try {
      const response = await generateDemoBankLines(token, {
        daysBack: demoDays,
        intensity: demoIntensity,
      });
      setBankState({
        busy: false,
        summary: `${response.note}\nGenerated ${response.generated} entries (${response.intensity})\nRange: ${response.range}`,
        rows: response.rows,
      });
    } catch (error) {
      setBankState({ busy: false, error: "Unable to generate demo bank feed" });
    }
  };

  const handleRunPayroll = async () => {
    if (!token) return;
    setPayrollState({ busy: true });
    try {
      const response = await runDemoPayroll(token, { includeBankLines: includeBank });
      setPayrollState({
        busy: false,
        summary: `${response.note}\nPAYGW secured: ${response.totalPaygWithheld.toFixed(2)}\nPayslips: ${response.payslips}\npayRunId: ${response.payRunId}`,
      });
    } catch (error) {
      setPayrollState({ busy: false, error: "Unable to run demo payroll" });
    }
  };

  const handleCompileBas = async () => {
    if (!token || !validateBasInputs()) return;
    setBasState({ busy: true });
    try {
      const response = await compileDemoBas(token, {
        year: basPeriod.year,
        month: basPeriod.month,
      });
      setBasState({
        busy: false,
        summary: `${response.note}\nPeriod: ${response.period.year}-${response.period.month}\nGST Collected ${response.gstCollected}\nGST Credits ${response.gstCredits}\nNet GST ${response.netGst}\nPAYGW ${response.paygWithheld}\nBank lines: ${response.bankLines}\nPayslips: ${response.payslips}`,
      });
    } catch (error) {
      setBasState({ busy: false, error: "Unable to compile demo BAS" });
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 } }}>
      <Stack spacing={3}>
        <Card>
          <CardHeader
            title="Demo bank feed"
            subheader="Replay a position/day feed that locks PAYGW & GST capture for the demo organisation."
          />
          <CardContent>
            <Stack spacing={2} direction={{ xs: "column", md: "row" }}>
              <TextField
                type="number"
                label="Days back"
                value={demoDays}
                onChange={(event) => setDemoDays(Number(event.target.value))}
                inputProps={{ min: 1, max: 30 }}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="demo-intensity-label">Intensity</InputLabel>
                <Select
                  labelId="demo-intensity-label"
                  value={demoIntensity}
                  label="Intensity"
                  onChange={(event) =>
                    setDemoIntensity(event.target.value as "low" | "high")
                  }
                >
                  <MenuItem value="low">Low</MenuItem>
                  <MenuItem value="high">High</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            {bankFormError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {bankFormError}
              </Alert>
            )}
            {bankState.error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {bankState.error}
              </Alert>
            )}
            <Button
              sx={{ mt: 3 }}
              variant="contained"
              onClick={handleGenerateBankFeed}
              disabled={bankState.busy}
            >
              {bankState.busy ? "Generating…" : "Generate demo bank feed"}
            </Button>
            {renderSummary("Bank feed", bankState.summary)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Demo payroll run"
            subheader="Create a payroll run and optionally mirror it in the bank feed."
          />
          <CardContent>
            <FormControlLabel
              control={
                <Checkbox
                  checked={includeBank}
                  onChange={(event) => setIncludeBank(event.target.checked)}
                />
              }
              label="Create linked bank line"
            />
            {payrollState.error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {payrollState.error}
              </Alert>
            )}
            <Button
              sx={{ mt: 2 }}
              variant="contained"
              onClick={handleRunPayroll}
              disabled={payrollState.busy}
            >
              {payrollState.busy ? "Running…" : "Run demo payroll"}
            </Button>
            {renderSummary("Payroll", payrollState.summary)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title="Demo BAS compile"
            subheader="Compile a mock BAS report for the chosen period."
          />
          <CardContent>
            <Stack spacing={2} direction={{ xs: "column", md: "row" }}>
              <TextField
                type="number"
                label="Year"
                value={basPeriod.year}
                onChange={(event) =>
                  setBasPeriod((prev) => ({ ...prev, year: Number(event.target.value) || prev.year }))
                }
                inputProps={{ min: 2020, max: 2100 }}
                fullWidth
              />
              <TextField
                type="number"
                label="Month"
                value={basPeriod.month}
                onChange={(event) =>
                  setBasPeriod((prev) => ({ ...prev, month: Number(event.target.value) || prev.month }))
                }
                inputProps={{ min: 1, max: 12 }}
                fullWidth
              />
            </Stack>
            {basFormError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {basFormError}
              </Alert>
            )}
            {basState.error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {basState.error}
              </Alert>
            )}
            <Button
              sx={{ mt: 3 }}
              variant="contained"
              onClick={handleCompileBas}
              disabled={basState.busy}
            >
              {basState.busy ? "Compiling…" : "Compile demo BAS"}
            </Button>
            {renderSummary("BAS", basState.summary)}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
