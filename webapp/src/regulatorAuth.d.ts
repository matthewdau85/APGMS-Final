export type RegulatorSession = {
    token: string;
    orgId: string;
    session: {
        id: string;
        issuedAt: string;
        expiresAt: string;
        sessionToken: string;
    };
};
export declare function saveRegulatorSession(session: RegulatorSession): void;
export declare function getRegulatorSession(): RegulatorSession | null;
export declare function getRegulatorToken(): string | null;
export declare function clearRegulatorSession(): void;
//# sourceMappingURL=regulatorAuth.d.ts.map