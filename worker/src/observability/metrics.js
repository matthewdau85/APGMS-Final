import { Gauge, Registry } from "prom-client";
export const registry = new Registry();
export const basPaymentRetryBacklog = new Gauge({
    name: "bas_payment_retry_backlog",
    help: "Number of BAS payment attempts waiting for retry",
    registers: [registry],
});
export const basOfflineSubmissionBacklog = new Gauge({
    name: "bas_offline_submission_backlog",
    help: "Offline BAS submissions awaiting manual reconciliation",
    registers: [registry],
});
export function resetMetrics() {
    basPaymentRetryBacklog.set(0);
    basOfflineSubmissionBacklog.set(0);
}
