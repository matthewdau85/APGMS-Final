import { redactLogPayload, redactError } from "./redaction.js";
export function safeLogAttributes(payload) {
    return redactLogPayload(payload);
}
export function safeLogError(err) {
    return redactError(err);
}
//# sourceMappingURL=logging.js.map