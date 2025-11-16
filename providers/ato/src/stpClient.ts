import { AtoHttpClient } from "./httpClient.js";
import { HttpConfig, MachineCredential, SubmitResult, SubmissionStatus, StpSubmissionPayload } from "./types.js";

export class AtoStpClient {
  private readonly http: AtoHttpClient;

  constructor(private readonly credential: MachineCredential, httpConfig: HttpConfig) {
    this.http = new AtoHttpClient(httpConfig);
  }

  async submitSingleTouchPayroll(payload: StpSubmissionPayload): Promise<SubmitResult> {
    const body = {
      ...payload,
      softwareId: this.credential.softwareId,
      signing: this.createSigningEnvelope(),
    };
    return this.http.postJson<SubmitResult>("/stp/v2/payevents", body);
  }

  async getSubmissionStatus(submissionId: string): Promise<SubmissionStatus> {
    return this.http.getJson<SubmissionStatus>(`/stp/v2/payevents/${submissionId}`);
  }

  private createSigningEnvelope() {
    return {
      keystorePath: this.credential.keystorePath,
      keystoreAlias: this.credential.keystoreAlias,
      keystorePassword: "***", // never log the plaintext password
    };
  }
}
