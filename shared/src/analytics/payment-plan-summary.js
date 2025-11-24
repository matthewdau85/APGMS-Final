const describeDetails = (details) => {
    if (details === null) {
        return "no details provided";
    }
    if (typeof details === "string" || typeof details === "number" || typeof details === "boolean") {
        return details.toString();
    }
    try {
        return JSON.stringify(details);
    }
    catch {
        return "complex details";
    }
};
export function buildPaymentPlanNarrative(plan) {
    const formattedDate = plan.requestedAt instanceof Date ? plan.requestedAt.toISOString() : String(plan.requestedAt);
    const detailsDescription = describeDetails(plan.detailsJson);
    return `Payment plan ${plan.id} for cycle ${plan.basCycleId} is ${plan.status}. Reason: ${plan.reason}. Details: ${detailsDescription}. Requested at ${formattedDate}; org ${plan.orgId}.`;
}
