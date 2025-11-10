import { requireRecentVerification } from "./mfa.js";
export function enforceAdminStepUp(request, reply, action) {
    const user = request && typeof request === "object" ? request.user : undefined;
    if (!(user === null || user === void 0 ? void 0 : user.id)) {
        reply.code(401).send({ error: { code: "unauthorized", message: "User context missing" } });
        return false;
    }
    if (!user.mfaEnabled) {
        reply.code(403).send({
            error: {
                code: "mfa_not_enrolled",
                message: "MFA enrollment is required for administrative actions",
            },
        });
        return false;
    }
    if (!requireRecentVerification(user.id)) {
        reply.code(428).send({
            error: {
                code: "mfa_step_up_required",
                message: `Recent MFA verification required before performing ${action}`,
                action,
            },
        });
        return false;
    }
    return true;
}
