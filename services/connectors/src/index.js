import { applyDesignatedAccountTransfer, generateDesignatedAccountReconciliationArtifact, } from "../../domain/policy/designated-accounts.js";
const defaultDependencies = {
    applyTransfer: applyDesignatedAccountTransfer,
    generateArtifact: generateDesignatedAccountReconciliationArtifact,
};
const ACCOUNT_TYPE_BY_CAPTURE = {
    payroll: "PAYGW",
    pos: "GST",
};
const SOURCE_BY_CAPTURE = {
    payroll: "PAYROLL_CAPTURE",
    pos: "GST_CAPTURE",
};
function captureError(type, orgId) {
    return new Error(`designated_account_missing:${type}:${orgId}`);
}
async function resolveAccount(context, input, accountType) {
    const account = await context.prisma.designatedAccount.findFirst({
        where: { orgId: input.orgId, type: accountType },
    });
    if (!account) {
        throw captureError(accountType, input.orgId);
    }
    return account;
}
async function captureFunds(context, input, captureType, dependencies) {
    const accountType = ACCOUNT_TYPE_BY_CAPTURE[captureType];
    const source = SOURCE_BY_CAPTURE[captureType];
    const account = await resolveAccount(context, input, accountType);
    const transfer = await dependencies.applyTransfer({
        prisma: context.prisma,
        auditLogger: context.auditLogger,
    }, {
        orgId: input.orgId,
        accountId: account.id,
        amount: input.amount,
        source,
        actorId: input.actorId,
    });
    const artifact = await dependencies.generateArtifact(context, input.orgId, input.actorId);
    return {
        transfer,
        artifact: {
            artifactId: artifact.artifactId,
            sha256: artifact.sha256,
            summary: artifact.summary,
        },
    };
}
export async function capturePayroll(context, input, dependencies = defaultDependencies) {
    return captureFunds(context, input, "payroll", dependencies);
}
export async function capturePos(context, input, dependencies = defaultDependencies) {
    return captureFunds(context, input, "pos", dependencies);
}
//# sourceMappingURL=index.js.map