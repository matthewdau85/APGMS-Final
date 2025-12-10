export declare function createRegulatorSession(orgId: string, ttlMinutes: number): Promise<{
    session: any;
    sessionToken: string;
}>;
export declare function ensureRegulatorSessionActive(sessionId: string): Promise<any>;
export declare function revokeRegulatorSession(sessionId: string): Promise<void>;
//# sourceMappingURL=regulator-session.d.ts.map