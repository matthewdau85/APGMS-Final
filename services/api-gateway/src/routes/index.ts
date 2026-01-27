// services/api-gateway/src/routes/index.ts
import type { FastifyInstance } from "fastify";

type RoutePack = "core" | "prototype" | "admin" | "regulator";

export type RouteWiringOptions = {
  enablePrototype: boolean;
  enableRegulator: boolean;
};

function envFlag(name: string): boolean {
  const v = process.env[name];
  if (!v) return false;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes";
}

function pickExport(mod: any, names: string[]): any | null {
  for (const n of names) {
    const v = mod?.[n];
    if (typeof v === "function") return v;
  }
  return null;
}

/**
 * Wires a route module regardless of whether it exports:
 * - default Fastify plugin (app, opts)
 * - named Fastify plugin (app, opts)
 * - named register function (app)
 */
async function wireModule(
  app: FastifyInstance,
  pack: RoutePack,
  name: string,
  mod: any,
  exportNameCandidates: string[]
): Promise<void> {
  const fn = pickExport(mod, exportNameCandidates);

  if (!fn) {
    // Fail closed for core/admin; fail open for optional packs
    const msg = `[routes] missing export for ${pack}:${name}. Tried: ${exportNameCandidates.join(", ")}`;
    if (pack === "core" || pack === "admin") {
      throw new Error(msg);
    }
    app.log.warn(msg);
    return;
  }

  // If it looks like a Fastify plugin (expects opts), register it.
  // Otherwise call it as a "registerX(app)" helper.
  if (fn.length >= 2) {
    await app.register(fn, {});
    app.log.info({ pack, route: name }, "registered (plugin)");
    return;
  }

  await fn(app);
  app.log.info({ pack, route: name }, "registered (function)");
}

/**
 * Route inventory: keep this list aligned to ROUTES_POLICY.md
 * Only list what you intend to be reachable.
 */
export async function registerCoreRoutes(app: FastifyInstance): Promise<void> {
  // Always-on safety
  const health = await import("./health.js");
  await wireModule(app, "core", "health", health, ["default", "healthRoutes", "registerHealthRoutes"]);

  const version = await import("./version.js");
  await wireModule(app, "core", "version", version, ["default", "versionRoutes", "registerVersionRoutes"]);

  // Core platform
  const schemas = await import("./schemas.js");
  await wireModule(app, "core", "schemas", schemas, ["default", "registerSchemasRoutes", "schemasRoutes"]);

  const auth = await import("./auth.js");
  await wireModule(app, "core", "auth", auth, ["default", "registerAuthRoutes", "authRoutes"]);

  const authMfa = await import("./auth-mfa.js");
  await wireModule(app, "core", "auth-mfa", authMfa, ["default", "registerAuthMfaRoutes", "authMfaRoutes"]);

  const orgSetup = await import("./org-setup.js");
  await wireModule(app, "core", "org-setup", orgSetup, ["default", "registerOrgSetupRoutes", "orgSetupRoutes"]);

  const orgSettings = await import("./org-settings.js");
  await wireModule(app, "core", "org-settings", orgSettings, ["default", "registerOrgSettingsRoutes", "orgSettingsRoutes"]);

  const setup = await import("./setup.js");
  await wireModule(app, "core", "setup", setup, ["default", "registerSetupRoutes", "setupRoutes"]);

  const onboarding = await import("./onboarding.js");
  await wireModule(app, "core", "onboarding", onboarding, ["default", "onboardingRoutes", "registerOnboardingRoutes"]);

  // Integrations surface (your /integrations/* endpoints)
  const integrationEvents = await import("./integration-events.js");
  await wireModule(app, "core", "integration-events", integrationEvents, [
    "default",
    "registerIntegrationEventRoutes",
    "registerIntegrationEventsRoutes",
    "integrationEventsRoutes",
  ]);

  // Core business routes (wire as the UI starts depending on them)
  // Keep commented until you explicitly want them reachable.
  //
  // const evidencePack = await import("./evidence-pack.js");
  // await wireModule(app, "core", "evidence-pack", evidencePack, ["default", "registerEvidencePackRoutes", "evidencePackRoutes"]);
  //
  // const exportMod = await import("./export.js");
  // await wireModule(app, "core", "export", exportMod, ["default", "exportRoutes", "registerExportRoutes"]);
}

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  const admin = await import("./admin.js");
  await wireModule(app, "admin", "admin", admin, ["default", "registerAdminRoutes", "adminRoutes"]);

  const adminAgent = await import("./admin-agent.js");
  await wireModule(app, "admin", "admin-agent", adminAgent, ["default", "registerAdminAgentRoutes", "registerAdminAgentRoute", "adminAgentRoutes"]);

  const adminRegwatcher = await import("./admin-regwatcher.js");
  await wireModule(app, "admin", "admin-regwatcher", adminRegwatcher, [
    "default",
    "registerAdminRegWatcherRoutes",
    "registerAdminRegwatcherRoutes",
    "adminRegwatcherRoutes",
  ]);

  const adminDemoOrchestrator = await import("./admin-demo-orchestrator.js");
  await wireModule(app, "admin", "admin-demo-orchestrator", adminDemoOrchestrator, [
    "default",
    "registerAdminDemoOrchestratorRoutes",
    "adminDemoOrchestratorRoutes",
  ]);

  // Wire these once they exist and are correct:
  // const adminUsers = await import("./admin-users.js");
  // await wireModule(app, "admin", "admin-users", adminUsers, ["default", "registerAdminUsersRoutes", "adminUsersRoutes"]);
  //
  // const adminServiceMode = await import("./admin-service-mode.js");
  // await wireModule(app, "admin", "admin-service-mode", adminServiceMode, ["default", "registerAdminServiceModeRoutes", "adminServiceModeRoutes"]);
  //
  // const adminData = await import("./admin.data.js");
  // await wireModule(app, "admin", "admin.data", adminData, ["default", "registerAdminDataRoutes", "adminDataRoutes"]);
}

export async function registerPrototypeRoutes(app: FastifyInstance): Promise<void> {
  const enable = envFlag("APGMS_ENABLE_PROTOTYPE");
  if (!enable) return;

  const prototype = await import("./prototype.js");
  await wireModule(app, "prototype", "prototype", prototype, ["default", "registerPrototypeRoutes", "prototypeRoutes"]);

  const prototypeMonitor = await import("./prototype-monitor.js");
  await wireModule(app, "prototype", "prototype-monitor", prototypeMonitor, [
    "default",
    "prototypeMonitorRoutes",
    "registerPrototypeMonitorRoutes",
  ]);

  const demo = await import("./demo.js");
  await wireModule(app, "prototype", "demo", demo, ["default", "demoRoutes", "registerDemoRoutes"]);

  const ingestCsv = await import("./ingest-csv.js");
  await wireModule(app, "prototype", "ingest-csv", ingestCsv, ["default", "csvIngestRoutes", "ingestCsvRoutes", "registerIngestCsvRoutes"]);

  const forecast = await import("./forecast.js");
  await wireModule(app, "prototype", "forecast", forecast, ["default", "forecastRoutes", "registerForecastRoutes"]);
}

export async function registerRegulatorRoutes(app: FastifyInstance): Promise<void> {
  const enable = envFlag("APGMS_ENABLE_REGULATOR");
  if (!enable) return;

  const regulatorAuth = await import("./regulator-auth.js");
  await wireModule(app, "regulator", "regulator-auth", regulatorAuth, ["default", "regulatorAuthRoutes", "registerRegulatorAuthRoutes"]);

  const regulator = await import("./regulator.js");
  await wireModule(app, "regulator", "regulator", regulator, ["default", "regulatorRoutes", "registerRegulatorRoutes"]);

  const regEvidencePack = await import("./regulator-compliance-evidence-pack.js");
  await wireModule(app, "regulator", "regulator-compliance-evidence-pack", regEvidencePack, [
    "default",
    "registerRegulatorComplianceEvidencePackRoute",
    "registerRegulatorComplianceEvidencePackRoutes",
  ]);

  const regSummary = await import("./regulator-compliance-summary.js");
  await wireModule(app, "regulator", "regulator-compliance-summary", regSummary, [
    "default",
    "registerRegulatorComplianceSummaryRoutes",
    "regulatorComplianceSummaryRoutes",
  ]);

  const regSummarySvc = await import("./regulator-compliance-summary.service.js");
  await wireModule(app, "regulator", "regulator-compliance-summary.service", regSummarySvc, [
    "default",
    "registerRegulatorComplianceSummaryServiceRoutes",
    "regulatorComplianceSummaryServiceRoutes",
  ]);

  const regSummaryDemo = await import("./regulator-compliance-summary.demo.js");
  await wireModule(app, "regulator", "regulator-compliance-summary.demo", regSummaryDemo, [
    "default",
    "registerRegulatorComplianceSummaryDemoRoutes",
    "regulatorComplianceSummaryDemoRoutes",
  ]);
}

export async function registerAllRoutes(app: FastifyInstance): Promise<void> {
  // Always on
  await registerCoreRoutes(app);
  await registerAdminRoutes(app);

  // Opt-in
  await registerPrototypeRoutes(app);
  await registerRegulatorRoutes(app);
}

export function resolveWiringOptions(): RouteWiringOptions {
  return {
    enablePrototype: envFlag("APGMS_ENABLE_PROTOTYPE"),
    enableRegulator: envFlag("APGMS_ENABLE_REGULATOR"),
  };
}
