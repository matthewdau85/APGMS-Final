export type BasLodgmentStatus = "queued" | "in_progress" | "success" | "failed";
export declare function recordBasLodgment(params: {
    orgId: string;
    initiatedBy?: string;
    taxTypes: string[];
    status?: BasLodgmentStatus;
    result?: Record<string, unknown>;
}): Promise<any>;
export declare function finalizeBasLodgment(id: string, result: Record<string, unknown>, status: BasLodgmentStatus): Promise<any>;
//# sourceMappingURL=bas.d.ts.map