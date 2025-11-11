import { randomUUID } from "node:crypto";

import {
  SecureConnectorAdapter,
  type ConnectorAdapterOptions,
  type ConnectorWebhookEnvelope,
} from "./base.js";

export type BankingSettlementEvent = {
  eventType: "settlement.completed";
  settlementId: string;
  accountExternalId: string;
  amount: number;
  currency: string;
  occurredAt: string;
};

export type BankingDisputeEvent = {
  eventType: "dispute.opened" | "dispute.resolved";
  disputeId: string;
  accountExternalId: string;
  amount: number;
  currency: string;
  occurredAt: string;
};

export type BankingWebhookPayload =
  | BankingSettlementEvent
  | BankingDisputeEvent
  | ({ eventType: string } & Record<string, unknown>);

export interface BankingConnectorOptions extends ConnectorAdapterOptions {
  onSettlement?: (event: BankingSettlementEvent) => Promise<void>;
  onDispute?: (event: BankingDisputeEvent) => Promise<void>;
}

export class BankingConnector extends SecureConnectorAdapter<BankingWebhookPayload> {
  constructor(private readonly bankingOptions: BankingConnectorOptions) {
    super(bankingOptions);
  }

  public async fetchTransactions(
    accountExternalId: string,
    sinceIso: string,
  ): Promise<unknown[]> {
    const response = await this.authenticatedRequest({
      path: `/accounts/${encodeURIComponent(accountExternalId)}/transactions?since=${encodeURIComponent(sinceIso)}`,
    });

    if (response.status >= 400) {
      throw new Error(`banking_api_error:${response.status}`);
    }

    return JSON.parse(response.body) as unknown[];
  }

  public async requestSettlement(accountExternalId: string, amount: number): Promise<{ settlementId: string }> {
    const response = await this.authenticatedRequest({
      path: `/accounts/${encodeURIComponent(accountExternalId)}/settlements`,
      method: "POST",
      body: JSON.stringify({ amount }),
      retryAttempts: 3,
    });

    if (response.status >= 400) {
      throw new Error(`banking_settlement_failed:${response.status}`);
    }

    const payload = response.body ? JSON.parse(response.body) : null;
    return {
      settlementId: payload?.settlementId ?? randomUUID(),
    };
  }

  protected async onWebhook(
    envelope: ConnectorWebhookEnvelope<BankingWebhookPayload>,
  ): Promise<void> {
    const payload = envelope.parsedBody;

    if (!payload || typeof payload !== "object") {
      throw new Error("banking_webhook_unparseable");
    }

    switch (payload.eventType) {
      case "settlement.completed": {
        if (this.bankingOptions.onSettlement) {
          await this.bankingOptions.onSettlement(payload as BankingSettlementEvent);
        }
        break;
      }
      case "dispute.opened":
      case "dispute.resolved": {
        if (this.bankingOptions.onDispute) {
          await this.bankingOptions.onDispute(payload as BankingDisputeEvent);
        }
        break;
      }
      default: {
        // no-op for unrecognised events
      }
    }
  }
}
