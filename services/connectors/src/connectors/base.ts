import type {
  ConnectorFetchOptions,
  ConnectorSubmissionResult,
  SignedPayload,
} from "../types.js";
import { OAuth2TokenManager } from "../utils/oauth2.js";
import { ReplayProtector } from "../security/replay-protector.js";
import { SignatureVerifier } from "../security/signature-verifier.js";

export interface BaseConnectorDependencies {
  oauthManager: OAuth2TokenManager;
  signatureVerifier: SignatureVerifier;
  replayProtector: ReplayProtector;
  fetchImpl?: typeof fetch;
}

export abstract class BaseConnector<Submission, Result = ConnectorSubmissionResult> {
  protected readonly deps: BaseConnectorDependencies;

  protected constructor(deps: BaseConnectorDependencies) {
    this.deps = {
      fetchImpl: fetch,
      ...deps,
    };
  }

  protected async authorisedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const token = await this.deps.oauthManager.getAccessToken();
    const fetchImpl = this.deps.fetchImpl ?? fetch;
    const headers = new Headers(init?.headers);
    headers.set("authorization", `Bearer ${token}`);
    headers.set("user-agent", "apgms-connectors/1.0");

    const response = await fetchImpl(input, {
      ...init,
      headers,
    });

    if (response.status === 401) {
      // force a refresh and retry once
      await this.deps.oauthManager.waitForRefresh();
      const retryToken = await this.deps.oauthManager.getAccessToken();
      headers.set("authorization", `Bearer ${retryToken}`);

      return fetchImpl(input, {
        ...init,
        headers,
      });
    }

    return response;
  }

  protected async validateInbound(message: SignedPayload): Promise<void> {
    const valid = this.deps.signatureVerifier.verify(message);
    if (!valid) {
      throw new Error("Connector signature validation failed");
    }

    await this.deps.replayProtector.assertNotReplayed(message);
  }

  abstract submit(payload: Submission): Promise<Result>;
  abstract fetch(options?: ConnectorFetchOptions): Promise<unknown[]>;
}

