import { AppError } from "../../shared/src/errors.js";

import type {
  PartnerBankingApi,
  PartnerDesignatedCreditRequest,
  PartnerDesignatedCreditResponse,
} from "./types.js";

export type PartnerBankingApiOptions = {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

type PartnerResponsePayload = {
  status?: string;
  partnerReference?: string;
  settledAmountCents?: number;
  raw?: unknown;
};

export function createPartnerBankingApi(
  options: PartnerBankingApiOptions,
): PartnerBankingApi {
  const baseUrl = options.baseUrl.replace(/\/$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeout = Math.max(0, options.timeoutMs ?? 5000);

  return {
    async creditDesignatedAccount(
      request: PartnerDesignatedCreditRequest,
    ): Promise<PartnerDesignatedCreditResponse> {
      const target = `${baseUrl}/designated-accounts/credit`;
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetchImpl(target, {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            ...(options.apiKey ? { authorization: `Bearer ${options.apiKey}` } : {}),
          },
          body: JSON.stringify({
            orgId: request.orgId,
            accountId: request.accountId,
            amountCents: request.amountCents,
            source: request.source,
            actorId: request.actorId,
            clientReference: request.clientReference,
            metadata: request.metadata ?? {},
          }),
        });

        if (!response.ok) {
          const text = await safeText(response);
          const detail = text ? ` (${text})` : "";
          throw new AppError(
            502,
            "banking_partner_http_error",
            `Partner banking API responded with status ${response.status}${detail}`,
          );
        }

        const payload = (await safeJson(response)) as PartnerResponsePayload;
        const normalized = normalizePartnerResponse(payload);

        return {
          status: normalized.status,
          partnerReference: normalized.partnerReference,
          settledAmountCents: normalized.settledAmountCents,
          raw: payload.raw ?? payload,
        };
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        if (error instanceof Error && error.name === "AbortError") {
          throw new AppError(
            504,
            "banking_partner_timeout",
            "Partner banking API timed out",
          );
        }

        const detail = error instanceof Error ? error.message : String(error);
        throw new AppError(
          502,
          "banking_partner_request_failed",
          `Partner banking API request failed: ${detail}`,
        );
      } finally {
        clearTimeout(timeoutHandle);
      }
    },
  };
}

function normalizePartnerResponse(payload: PartnerResponsePayload): {
  status: "ACCEPTED" | "SETTLED" | "PENDING" | "REJECTED";
  partnerReference: string;
  settledAmountCents?: number;
} {
  const status = typeof payload.status === "string" ? payload.status.toUpperCase() : "";
  const partnerReference = payload.partnerReference ?? "";
  const settledAmountCents =
    typeof payload.settledAmountCents === "number"
      ? Math.trunc(payload.settledAmountCents)
      : undefined;

  if (!partnerReference || partnerReference.trim().length === 0) {
    throw new AppError(
      502,
      "banking_partner_invalid_response",
      "Partner banking API response missing partnerReference",
    );
  }

  switch (status) {
    case "ACCEPTED":
    case "SETTLED":
    case "PENDING":
    case "REJECTED":
      return { status, partnerReference, settledAmountCents };
    default:
      throw new AppError(
        502,
        "banking_partner_invalid_status",
        `Partner banking API returned unknown status '${payload.status}'`,
      );
  }
}

async function safeText(response: Response): Promise<string | undefined> {
  try {
    return await response.text();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
