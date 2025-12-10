import { authenticator } from "otplib";
authenticator.options = {
    step: 30,
    window: 1,
};
export function generateTotpSecret() {
    return authenticator.generateSecret();
}
export function generateTotpToken(secret) {
    return authenticator.generate(secret);
}
export function verifyTotpToken(secret, token) {
    return authenticator.verify({ token, secret });
}
export function buildTotpUri(secret, label, issuer) {
    return authenticator.keyuri(label, issuer, secret);
}
//# sourceMappingURL=totp.js.map