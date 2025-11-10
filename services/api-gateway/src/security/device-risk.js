import { createHash } from "node:crypto";
const knownDevices = new Map();
function resolveIp(request) {
    const header = request.headers["x-forwarded-for"];
    if (typeof header === "string" && header.trim().length > 0) {
        return header.split(",")[0].trim();
    }
    return request.ip;
}
function buildFingerprint(userId, request) {
    const ua = (request.headers["user-agent"] ?? "unknown");
    const ip = resolveIp(request);
    const raw = `${userId}|${ua}|${ip}`;
    return createHash("sha256").update(raw).digest("hex");
}
export function scoreDeviceRisk(userId, request, options) {
    const signals = [];
    const fingerprint = buildFingerprint(userId, request);
    const ua = (request.headers["user-agent"] ?? "unknown");
    const ip = resolveIp(request);
    if (!ua || ua === "unknown") {
        signals.push("missing_user_agent");
    }
    if (!options.mfaEnabled) {
        signals.push("mfa_disabled");
    }
    if (ip.startsWith("10.") || ip.startsWith("192.168.")) {
        signals.push("private_ip");
    }
    let level = "low";
    if (!knownDevices.get(userId)?.has(fingerprint)) {
        signals.push("new_device");
        level = "medium";
    }
    if (signals.includes("mfa_disabled") && signals.includes("new_device")) {
        level = "high";
    }
    if (!knownDevices.has(userId)) {
        knownDevices.set(userId, new Set([fingerprint]));
    }
    else {
        knownDevices.get(userId).add(fingerprint);
    }
    return { level, fingerprint, signals };
}
export function clearKnownDevices(userId) {
    knownDevices.delete(userId);
}
