export declare function requireRecentVerification(userId: string): boolean;
export declare function clearVerification(userId: string): void;
export declare function grantStepUpSession(userId: string, ttlMs?: number): Date;
export type VerifyChallengeResult = {
    success: boolean;
    method?: "totp" | "recovery";
    expiresAt?: Date;
    remainingRecoveryCodes?: number;
};
export declare function verifyChallenge(userId: string, code: string): Promise<VerifyChallengeResult>;
//# sourceMappingURL=mfa.d.ts.map