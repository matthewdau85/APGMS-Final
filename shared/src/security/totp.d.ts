export declare function generateTotpSecret(): string;
export declare function generateTotpToken(secret: string): string;
export declare function verifyTotpToken(secret: string, token: string): boolean;
export declare function buildTotpUri(secret: string, label: string, issuer: string): string;
//# sourceMappingURL=totp.d.ts.map