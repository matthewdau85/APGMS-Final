import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import type { FeedbackInput, FeedbackRecord } from "./types.js";

export class FeedbackStore {
  private readonly filePath: string;
  private records: FeedbackRecord[] = [];
  private initialised = false;

  constructor(dataDir: string) {
    this.filePath = resolve(dataDir, "feedback.json");
  }

  async init(): Promise<void> {
    if (this.initialised) {
      return;
    }
    try {
      const raw = await readFile(this.filePath, "utf8");
      this.records = JSON.parse(raw) as FeedbackRecord[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.records = [];
      } else {
        throw error;
      }
    }
    this.initialised = true;
  }

  async add(entry: FeedbackInput): Promise<FeedbackRecord> {
    await this.init();
    const record: FeedbackRecord = {
      ...entry,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.records.push(record);
    await this.flush();
    return record;
  }

  async listByCase(caseType: string, caseId: string): Promise<FeedbackRecord[]> {
    await this.init();
    return this.records.filter(
      (record) => record.caseType === caseType && record.caseId === caseId,
    );
  }

  private async flush(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(this.records, null, 2), "utf8");
  }
}
