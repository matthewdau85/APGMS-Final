import { requestJson } from "./http.js";
import { OAuthSession, type OAuthConfig } from "./oauth.ts";

export type BasSubmissionPayload = {
  periodId: string;
  from: string;
  to: string;
  gstPayableCents: number;
  gstReceivableCents: number;
  paygwWithheldCents: number;
  lodgementReference?: string;
};

export type BasSubmissionResponse = {
  lodgementReference: string;
  status: "submitted" | "lodged" | "rejected";
  receivedAt: string;
};

export type BasStatusResponse = {
  lodgementReference: string;
  status: "submitted" | "lodged" | "rejected";
  updatedAt: string;
  errors?: Array<{ code: string; message: string }>;
};

export class AtoBasClient {
  private readonly oauth: OAuthSession;

  constructor(private readonly baseUrl: string, oauth: OAuthConfig) {
    this.oauth = new OAuthSession(oauth);
  }

  async submit(payload: BasSubmissionPayload): Promise<BasSubmissionResponse> {
    const token = await this.oauth.getToken();
    return requestJson<BasSubmissionResponse>({
      method: "POST",
      url: `${this.baseUrl.replace(/\/$/, "")}/bas/lodgements`,
      headers: { Authorization: token },
      body: payload,
    });
  }

  async status(lodgementReference: string): Promise<BasStatusResponse> {
    const token = await this.oauth.getToken();
    return requestJson<BasStatusResponse>({
      method: "GET",
      url: `${this.baseUrl.replace(/\/$/, "")}/bas/lodgements/${encodeURIComponent(lodgementReference)}`,
      headers: { Authorization: token },
    });
  }
}
