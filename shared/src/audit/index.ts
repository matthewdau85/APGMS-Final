import { mkdir, appendFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

export interface AuditLogEntry {
  principal: string;
  action: string;
  scope: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogWriterOptions {
  destination?: string;
}

export interface AuditLogWriter {
  write(entry: AuditLogEntry): Promise<void>;
}

const DEFAULT_AUDIT_LOG_PATH = resolve("artifacts", "audit.log");

export function createAuditLogWriter(options: AuditLogWriterOptions = {}): AuditLogWriter {
  const destination = options.destination ?? process.env.AUDIT_LOG_PATH ?? DEFAULT_AUDIT_LOG_PATH;

  return {
    async write(entry: AuditLogEntry): Promise<void> {
      const timestamp = entry.timestamp ?? new Date().toISOString();
      const payload = { ...entry, timestamp };
      const serialised = `${JSON.stringify(payload)}\n`;
      await mkdir(dirname(destination), { recursive: true });
      await appendFile(destination, serialised, { encoding: "utf8" });
    },
  };
}

export type { AuditLogEntry as AuditEntry };
