import { HttpConfig } from "./types.js";

type FetchFn = typeof fetch;

export class AtoHttpClient {
  private readonly fetchFn: FetchFn;

  constructor(private readonly config: HttpConfig) {
    this.fetchFn = config.fetch ?? fetch;
  }

  async postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (body["softwareId"]) {
      headers["x-apgms-software-id"] = String(body["softwareId"]);
    }

    const response = await this.fetchFn(new URL(path, this.config.baseUrl), {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ATO request failed (${response.status}): ${text}`);
    }

    return (await response.json()) as T;
  }

  async getJson<T>(path: string): Promise<T> {
    const response = await this.fetchFn(new URL(path, this.config.baseUrl));
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`ATO request failed (${response.status}): ${text}`);
    }
    return (await response.json()) as T;
  }
}
