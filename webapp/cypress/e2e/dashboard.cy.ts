describe("Dashboard", () => {
  const session = {
    token: "test-token",
    user: {
      id: "user_1",
      orgId: "org_123",
      role: "admin",
      mfaEnabled: false,
    },
  };

  beforeEach(() => {
    const apiBase = Cypress.env("apiBaseUrl") as string;
    cy.intercept("GET", `${apiBase}/org/obligations/current`, {
      basCycleId: "bas_1",
      basPeriodStart: new Date().toISOString(),
      basPeriodEnd: new Date().toISOString(),
      nextBasDue: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      paygw: { required: 50000, secured: 42000, shortfall: 8000, status: "SHORTFALL" },
      gst: { required: 30000, secured: 32000, shortfall: 0, status: "READY" },
    }).as("obligations");
    cy.intercept("GET", `${apiBase}/bank-lines`, {
      lines: [
        {
          id: "line_1",
          postedAt: new Date().toISOString(),
          amount: 12345.67,
          description: "Payroll reserve",
          createdAt: new Date().toISOString(),
        },
      ],
    }).as("bankLines");
    cy.intercept("GET", `${apiBase}/org/virtual-balance`, {
      actualBalance: 125000,
      taxReserved: 90000,
      discretionaryBalance: 35000,
    }).as("virtualBalance");
    cy.intercept("GET", `${apiBase}/org/prediction*`, {
      tier: "Reserve",
      daysAhead: 45,
      prediction: {
        gstEstimate: 15000,
        paygwEstimate: 22000,
        confidence: 0.81,
      },
    }).as("prediction");
    cy.intercept("GET", `${apiBase}/alerts`, {
      alerts: [
        {
          id: "alert_1",
          type: "DESIGNATED_BAS_SHORTFALL",
          severity: "HIGH",
          message: "Designated accounts short",
          createdAt: new Date().toISOString(),
          resolved: false,
          resolvedAt: null,
          resolutionNote: null,
        },
      ],
    }).as("alerts");
    cy.intercept("GET", `${apiBase}/org/designated-accounts`, {
      totals: { paygw: 42000, gst: 32000 },
      accounts: [
        {
          id: "acct_paygw",
          type: "PAYGW",
          balance: 42000,
          updatedAt: new Date().toISOString(),
          transfers: [],
        },
        {
          id: "acct_gst",
          type: "GST",
          balance: 32000,
          updatedAt: new Date().toISOString(),
          transfers: [],
        },
      ],
    }).as("designated");

    cy.visit("/dashboard", {
      onBeforeLoad(win) {
        win.localStorage.setItem("apgms_session", JSON.stringify(session));
      },
    });
  });

  it("renders balances from the virtual balance engine", () => {
    cy.wait(["@obligations", "@bankLines", "@virtualBalance", "@prediction", "@alerts", "@designated"]);
    cy.get("[data-testid=balance-actual]").should("contain", "$125,000.00");
    cy.get("[data-testid=balance-tax]").should("contain", "$90,000.00");
    cy.get("[data-testid=balance-discretionary]").should("contain", "$35,000.00");
  });
});
