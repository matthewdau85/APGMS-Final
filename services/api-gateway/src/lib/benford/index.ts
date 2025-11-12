import type { MonitoringSnapshot } from "@prisma/client";

import {
  mapMonitoringSnapshotToBenford,
  fetchBenfordRawSamples,
  type BenfordDigitBin,
  type BenfordSuggestedFilter,
  type BenfordMetadata,
  type BenfordSpike,
  type BenfordAdvisoryCopy,
  type BenfordRawSample,
  type RawSampleRequestOptions,
  type MonitoringSnapshotRecord,
} from "@apgms/detector-number-patterns";

export type BenfordSnapshotPublicMetadata = Omit<BenfordMetadata, "sampleReference">;

export interface BenfordSnapshotPayload {
  generatedAt: string;
  bins: BenfordDigitBin[];
  metadata: BenfordSnapshotPublicMetadata;
  suggestedFilters: BenfordSuggestedFilter[];
  spikes: BenfordSpike[];
  advisoryCopy: BenfordAdvisoryCopy;
}

export interface BenfordSnapshotApiShape {
  id: string;
  type: string;
  createdAt: string;
  payload: BenfordSnapshotPayload;
}

export interface BenfordSnapshotView {
  api: BenfordSnapshotApiShape;
  internal: {
    sampleReference: string | null;
  };
}

export type { BenfordRawSample };

export function mapBenfordSnapshot(
  snapshot: MonitoringSnapshot,
): BenfordSnapshotView | null {
  const detectorSnapshot = mapMonitoringSnapshotToBenford(toDetectorSnapshotRecord(snapshot));
  if (!detectorSnapshot) {
    return null;
  }

  const { metadata } = detectorSnapshot;
  const { sampleReference, ...publicMetadata } = metadata;

  return {
    api: {
      id: snapshot.id,
      type: snapshot.type,
      createdAt: snapshot.createdAt.toISOString(),
      payload: {
        generatedAt: detectorSnapshot.metadata.generatedAt,
        bins: detectorSnapshot.bins,
        metadata: publicMetadata,
        suggestedFilters: detectorSnapshot.suggestedFilters,
        spikes: detectorSnapshot.spikes,
        advisoryCopy: detectorSnapshot.advisoryCopy,
      },
    },
    internal: {
      sampleReference: sampleReference ?? null,
    },
  };
}

export async function fetchBenfordSamplesForSnapshot(
  snapshot: MonitoringSnapshot,
  options: RawSampleRequestOptions = {},
): Promise<BenfordRawSample[]> {
  const view = mapBenfordSnapshot(snapshot);
  if (!view) {
    return [];
  }
  return fetchBenfordRawSamples(view.internal.sampleReference, options);
}

export function isBenfordSnapshot(snapshot: MonitoringSnapshot): boolean {
  return snapshot.type.startsWith("number-patterns");
}

function toDetectorSnapshotRecord(snapshot: MonitoringSnapshot): MonitoringSnapshotRecord {
  const candidate = snapshot as MonitoringSnapshot & {
    computeVersion?: string | null;
    populationNote?: string | null;
    consecutivePeriods?: number | null;
    isMuted?: boolean | null;
    mutedReason?: string | null;
    spikes?: unknown | null;
  };

  return {
    id: candidate.id,
    orgId: candidate.orgId,
    type: candidate.type,
    createdAt: candidate.createdAt,
    payload: candidate.payload,
    computeVersion: candidate.computeVersion ?? null,
    populationNote: candidate.populationNote ?? null,
    consecutivePeriods: candidate.consecutivePeriods ?? null,
    isMuted: candidate.isMuted ?? false,
    mutedReason: candidate.mutedReason ?? null,
    spikes: candidate.spikes ?? null,
  } satisfies MonitoringSnapshotRecord;
}
