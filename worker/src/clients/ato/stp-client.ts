import { AtoHttpClient, type HttpClientOptions } from "./http.js";

export interface StpSubmissionRequest {
  payRunId: string;
  lodgementReference: string;
  payload: unknown;
}

export interface StpSubmissionResponse {
  submissionId: string;
  receivedAt: string;
}

export class AtoStpClient extends AtoHttpClient {
  constructor(options: HttpClientOptions) {
    super(options);
  }

  public async submit(request: StpSubmissionRequest): Promise<StpSubmissionResponse> {
    const response = await this.post("/stp/submissions", request);

    if (response.status >= 400) {
      throw new Error(`ato_stp_submission_failed:${response.status}`);
    }

    return JSON.parse(response.body) as StpSubmissionResponse;
  }

  public async fetchStatus(submissionId: string): Promise<unknown> {
    const response = await this.get(`/stp/submissions/${encodeURIComponent(submissionId)}`);

    if (response.status >= 400) {
      throw new Error(`ato_stp_status_failed:${response.status}`);
    }

    return JSON.parse(response.body) as unknown;
  }
}
