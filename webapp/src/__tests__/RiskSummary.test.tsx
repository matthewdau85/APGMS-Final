import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RiskSummary } from "../features/compliance";

describe("RiskSummary", () => {
  it("renders risk cards with recommended actions", () => {
    render(
      <RiskSummary
        insights={{
          shortfall: {
            orgId: "demo",
            score: 0.72,
            riskLevel: "medium",
            recommendedAction: "Escalate to finance",
            explanations: ["Liquidity gap"],
          },
          fraud: {
            orgId: "demo",
            score: 0.9,
            riskLevel: "high",
            recommendedAction: "Block the transfer",
            explanations: ["Amount spike"],
          },
        }}
      />,
    );

    expect(screen.getByText(/Shortfall risk/i)).toBeInTheDocument();
    expect(screen.getByText(/Escalate to finance/i)).toBeInTheDocument();
    expect(screen.getByText(/Fraud risk/i)).toBeInTheDocument();
    expect(screen.getByText(/Block the transfer/i)).toBeInTheDocument();
  });

  it("returns null when no insights are provided", () => {
    const { container } = render(<RiskSummary insights={null} />);
    expect(container.firstChild).toBeNull();
  });
});
