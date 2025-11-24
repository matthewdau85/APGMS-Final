import {
  detectRisk as sharedDetectRisk,
  listRiskEvents as sharedListRiskEvents,
} from "@apgms/shared";

export type DetectRisk = typeof sharedDetectRisk;
export type ListRiskEvents = typeof sharedListRiskEvents;

let currentDetectRisk: DetectRisk = sharedDetectRisk;
let currentListRiskEvents: ListRiskEvents = sharedListRiskEvents;

export function setRiskOperations(ops: { detectRisk?: DetectRisk; listRiskEvents?: ListRiskEvents }) {
  if (ops.detectRisk) currentDetectRisk = ops.detectRisk;
  if (ops.listRiskEvents) currentListRiskEvents = ops.listRiskEvents;
}

export function resetRiskOperations() {
  currentDetectRisk = sharedDetectRisk;
  currentListRiskEvents = sharedListRiskEvents;
}

export function detectRisk(orgId: string, taxType: string) {
  return currentDetectRisk(orgId, taxType);
}

export function listRiskEvents(orgId: string) {
  return currentListRiskEvents(orgId);
}
