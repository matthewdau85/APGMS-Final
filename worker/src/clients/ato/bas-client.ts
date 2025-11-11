import { AtoHttpClient, type HttpClientOptions } from "./http.js";

export interface BasLodgementRequest {
  basId: string;
  periodStart: string;
  periodEnd: string;
  paygw: number;
  gst: number;
  declaration: {
    signer: string;
    position: string;
  };
}

export interface BasLodgementResponse {
  receiptReference: string;
  lodgedAt: string;
}

export class AtoBasClient extends AtoHttpClient {
  constructor(options: HttpClientOptions) {
    super(options);
  }

  public async lodge(request: BasLodgementRequest): Promise<BasLodgementResponse> {
    const response = await this.post("/bas/lodgements", request);

    if (response.status >= 400) {
      throw new Error(`ato_bas_lodgement_failed:${response.status}`);
    }

    return JSON.parse(response.body) as BasLodgementResponse;
  }
}
