import { requestJson } from "./http.js";
import { OAuthSession, type OAuthConfig } from "./oauth.js";

export type StpSubmissionEmployee = {
  identifier: string;
  grossCents: number;
  paygWithheldCents: number;
  superannuationCents: number;
};

export type StpSubmissionPayload = {
  payRunId: string;
  periodStart: string;
  periodEnd: string;
  paymentDate: string;
  softwareId: string;
  employees: StpSubmissionEmployee[];
};

export type StpSubmissionResponse = {
  lodgementId: string;
  status: "submitted" | "accepted" | "rejected";
  receivedAt: string;
};

export type StpStatusResponse = {
  lodgementId: string;
  status: "submitted" | "accepted" | "rejected";
  updatedAt: string;
  errors?: Array<{ code: string; message: string }>;
};

export class AtoStpClient {
  private readonly oauth: OAuthSession;

  constructor(private readonly baseUrl: string, oauth: OAuthConfig) {
    this.oauth = new OAuthSession(oauth);
  }

  async submit(payload: StpSubmissionPayload): Promise<StpSubmissionResponse> {
    const token = await this.oauth.getToken();
    return requestJson<StpSubmissionResponse>({
      method: "POST",
      url: `${this.baseUrl.replace(/\/$/, "")}/stp/pay-events`,
      headers: { Authorization: token },
      body: payload,
    });
  }

  async status(lodgementId: string): Promise<StpStatusResponse> {
    const token = await this.oauth.getToken();
    return requestJson<StpStatusResponse>({
      method: "GET",
      url: `${this.baseUrl.replace(/\/$/, "")}/stp/pay-events/${encodeURIComponent(lodgementId)}`,
      headers: { Authorization: token },
    });
  }
}
