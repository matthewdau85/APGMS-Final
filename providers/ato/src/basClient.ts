import { AtoHttpClient } from "./httpClient.js";
import { BasStatement, HttpConfig, MachineCredential, SubmitResult, SubmissionStatus } from "./types.js";

export class AtoBasClient {
  private readonly http: AtoHttpClient;

  constructor(private readonly credential: MachineCredential, httpConfig: HttpConfig) {
    this.http = new AtoHttpClient(httpConfig);
  }

  async submitBas(statement: BasStatement): Promise<SubmitResult> {
    const body = {
      statement,
      softwareId: this.credential.softwareId,
      signing: this.createSigningEnvelope(),
    };

    return this.http.postJson<SubmitResult>("/bas/v2/lodgements", body);
  }

  async getBasStatus(submissionId: string): Promise<SubmissionStatus> {
    return this.http.getJson<SubmissionStatus>(`/bas/v2/lodgements/${submissionId}`);
  }

  private createSigningEnvelope() {
    return {
      keystorePath: this.credential.keystorePath,
      keystoreAlias: this.credential.keystoreAlias,
      keystorePassword: "***",
    };
  }
}
