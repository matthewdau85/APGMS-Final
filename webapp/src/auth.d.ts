export type SessionUser = {
    id: string;
    orgId: string;
    role: string;
    mfaEnabled: boolean;
};
export type Session = {
    token: string;
    user: SessionUser;
};
export declare function saveSession(session: Session): void;
export declare function updateSession(update: Partial<Session> & {
    user?: Partial<SessionUser>;
}): Session | null;
export declare function getSession(): Session | null;
export declare function getSessionUser(): SessionUser | null;
export declare function getToken(): string | null;
export declare function clearSession(): void;
export declare function clearToken(): void;
//# sourceMappingURL=auth.d.ts.map