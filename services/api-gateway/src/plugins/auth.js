import { authenticateRequest as coreAuthenticateRequest } from "@apgms/auth";
export function buildAuthPreHandler(app, roles = []) {
    return async function authenticate(request, reply) {
        return authenticateRequest(app, request, reply, roles);
    };
}
export async function authenticateRequest(app, request, reply, roles = []) {
    const principal = await coreAuthenticateRequest(app, request, reply, roles);
    if (principal) {
        request.user = principal;
    }
    else {
        delete request.user;
    }
    return principal;
}
export default authenticateRequest;
