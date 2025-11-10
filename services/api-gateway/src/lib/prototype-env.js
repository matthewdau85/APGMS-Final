const readPrototypeEnv = () => {
  const value = process.env.PROTOTYPE_ENV?.trim();
  return value && value.length > 0 ? value : undefined;
};
const hasAdminRole = (roleInput) => {
  if (!roleInput) {
    return false;
  }
  const roles = Array.isArray(roleInput) ? roleInput : [roleInput];
  return roles.some((role) => role?.toLowerCase() === "admin");
};
export function includePrototypeEnv(reply, payload, roleInput) {
  const prototypeEnv = readPrototypeEnv();
  if (!prototypeEnv || !hasAdminRole(roleInput)) {
    return payload;
  }
  reply.header("x-prototype-env", prototypeEnv);
  return { ...payload, prototypeEnv };
}
export function currentPrototypeEnv() {
  return readPrototypeEnv();
}
