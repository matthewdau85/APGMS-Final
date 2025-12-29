export * from "./prototype-admin.js";

// service-mode currently exports a default guard (your tests already pass),
// but some modules expect a named export "serviceModeGuard" from guards/index.ts.
export * from "./service-mode.js";
