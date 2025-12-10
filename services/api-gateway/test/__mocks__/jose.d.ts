export declare class SignJWT {
    private payload;
    constructor(payload: any);
    setProtectedHeader(_header: Record<string, unknown>): this;
    setIssuedAt(_iat?: number | Date): this;
    setExpirationTime(_exp: number | string | Date): this;
    sign(_key: unknown): Promise<string>;
}
export declare function importJWK(_jwk: unknown, _alg?: string): Promise<unknown>;
export type JWK = any;
//# sourceMappingURL=jose.d.ts.map