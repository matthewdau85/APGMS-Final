import { type RegistrationResponseJSON, type AuthenticationResponseJSON, type WebAuthnCredential } from "@simplewebauthn/server";
export declare function createRegistrationOptions(options: {
    userId: string;
    username: string;
    displayName: string;
    excludeCredentialIds: string[];
}): Promise<import("@simplewebauthn/server").PublicKeyCredentialCreationOptionsJSON>;
export declare function verifyPasskeyRegistration(userId: string, response: RegistrationResponseJSON): Promise<import("@simplewebauthn/server").VerifiedRegistrationResponse>;
export declare function createAuthenticationOptions(options: {
    userId: string;
    allowCredentialIds: string[];
}): Promise<import("@simplewebauthn/server").PublicKeyCredentialRequestOptionsJSON>;
export declare function verifyPasskeyAuthentication(userId: string, response: AuthenticationResponseJSON, credential: WebAuthnCredential): Promise<import("@simplewebauthn/server").VerifiedAuthenticationResponse>;
//# sourceMappingURL=webauthn.d.ts.map