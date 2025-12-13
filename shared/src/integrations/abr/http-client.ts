import type { AbrLookupClient, AbnDetails } from "./types.js";

export function createHttpAbrClient(opts: {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
}): AbrLookupClient {
  const base = opts.baseUrl.replace(/\/+$/, "");

  return {
    async lookupAbn(abn: string): Promise<AbnDetails> {
      const digits = String(abn).replace(/\D+/g, "");

      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), opts.timeoutMs);
      (t as any).unref?.();

      try {
        const res = await fetch(`${base}/v1/abn/${encodeURIComponent(digits)}`, {
          method: "GET",
          headers: {
            accept: "application/json",
            ...(opts.apiKey ? { "x-api-key": opts.apiKey } : {}),
          },
          signal: ac.signal,
        });

        const text = await res.text();
        let json: any = undefined;
        try {
          json = text ? JSON.parse(text) : undefined;
        } catch {
          // ignore parse failure; keep raw text
        }

        if (!res.ok) {
          return {
            abn: digits,
            isValid: false,
            raw: { status: res.status, body: json ?? text },
          };
        }

        const entityName = json?.entityName ?? json?.name;
        const entityStatus = json?.entityStatus ?? json?.status;
        const isValid = json?.isValid ?? json?.valid ?? true;

        return {
          abn: String(json?.abn ?? digits).replace(/\D+/g, ""),
          isValid: Boolean(isValid),
          entityName: entityName != null ? String(entityName) : undefined,
          entityStatus: entityStatus != null ? String(entityStatus) : undefined,
          raw: json ?? text,
        };
      } catch (err: any) {
        return {
          abn: digits,
          isValid: false,
          raw: { error: String(err?.message ?? err) },
        };
      } finally {
        clearTimeout(t);
      }
    },
  };
}
