export type Target = {
  id: string;           // short, filesystem-safe key
  url: string;          // https://...
  frequencyHours: number; // suggested interval
  ttlSeconds?: number;  // optional cache TTL, default 0
};

export type SnapshotMeta = {
  id: string;           // ISO timestamp or monotonic
  targetId: string;
  url: string;
  sha256: string;
  bytesHtml: number;
  bytesText: number;
  createdAt: string;    // ISO
};

export type ChangeEvent = {
  id: string;           // ISO timestamp
  targetId: string;
  url: string;
  previousSha: string | null;
  currentSha: string;
  createdAt: string;
  diffSummary: {
    added: number;
    removed: number;
    changed: number;
    sample?: string;    // small excerpt of unified diff (first ~120 lines)
  };
};

export type Manifest = {
  target: Target;
  snapshots: SnapshotMeta[]; // newest last
  changes: ChangeEvent[];    // newest last
};
