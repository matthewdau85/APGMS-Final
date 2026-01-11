import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import Ajv from "ajv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_PATH = path.resolve("specs", "ato", "ato-ruleset.v1.json");
const SCHEMA_PATH = path.resolve("specs", "ato", "ato-ruleset.schema.v1.json");
const DEFAULT_DATA_DIR = path.resolve("data", "ato", "v1");

export async function loadJson(filePath) {
  const contents = await readFile(path.resolve(filePath), "utf8");
  return JSON.parse(contents);
}

export function validateSpecAgainstSchema(spec, schema) {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(spec)) {
    const message = validate.errors
      ?.map((err) => `${err.instancePath || "/"} ${err.message}`.trim())
      .join("; ");
    throw new Error(`Spec schema validation failed: ${message}`);
  }
}

export function selectEffectiveDate(spec, taxYear) {
  const candidates = Array.isArray(spec.effective_dates) ? spec.effective_dates : [];
  if (!candidates.length) {
    throw new Error("No effective_dates defined in ATO ruleset");
  }
  if (taxYear) {
    const match = candidates.find((entry) => entry.tax_year === taxYear);
    if (match) return match;
    throw new Error(`Tax year ${taxYear} not defined in ATO ruleset`);
  }
  return candidates[candidates.length - 1];
}

function normalizeBasRule(rule) {
  const entity = String(rule?.applies_to?.entity_type ?? "").toLowerCase();
  const frequency = String(rule?.applies_to?.frequency ?? "").toLowerCase();
  const dueDay = String(rule?.due_day ?? "");
  const dueMonthOffset = String(rule?.due_month_offset ?? "");
  return `${entity}|${frequency}|${dueDay}|${dueMonthOffset}`;
}

export class MemoryConfigStore {
  constructor({
    paygwTables = [],
    gstCategories = [],
    basRules = [],
  } = {}) {
    this.paygwTables = new Set(paygwTables);
    this.gstCategories = new Set(gstCategories);
    this.basRules = new Set(basRules.map(normalizeBasRule));
  }

  async init() {
    return;
  }

  async hasPaygwTable(key) {
    return this.paygwTables.has(key);
  }

  async hasGstMap() {
    return this.gstCategories.size > 0;
  }

  async hasGstCategory(category) {
    return this.gstCategories.has(category);
  }

  async hasBasRules() {
    return this.basRules.size > 0;
  }

  async hasBasRule(rule) {
    return this.basRules.has(normalizeBasRule(rule));
  }
}

export class FileConfigStore {
  constructor(baseDir = DEFAULT_DATA_DIR) {
    this.baseDir = baseDir;
    this.paygwTables = new Set();
    this.gstCategories = new Set();
    this.basRules = new Set();
    this.initialized = false;
  }

  static async create(baseDir) {
    const store = new FileConfigStore(baseDir);
    await store.init();
    return store;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    await this.loadPaygwTables();
    await this.loadGstCategories();
    await this.loadBasRules();
  }

  async loadPaygwTables() {
    const paygwDir = path.join(this.baseDir, "paygw");
    let files = [];
    try {
      files = await readdir(paygwDir);
    } catch {
      return;
    }
    await Promise.all(
      files.map(async (file) => {
        try {
          const contents = await readFile(path.join(paygwDir, file), "utf8");
          const parsed = JSON.parse(contents);
          if (parsed?.table_key) {
            this.paygwTables.add(parsed.table_key);
          }
        } catch {
          // ignore
        }
      })
    );
  }

  async loadGstCategories() {
    const gstPath = path.join(this.baseDir, "gst", "category-map.json");
    try {
      const contents = await readFile(gstPath, "utf8");
      const parsed = JSON.parse(contents);
      Object.keys(parsed ?? {}).forEach((key) => this.gstCategories.add(key));
    } catch {
      // missing gst map
    }
  }

  async loadBasRules() {
    const basPath = path.join(this.baseDir, "bas", "due-dates.json");
    try {
      const contents = await readFile(basPath, "utf8");
      const parsed = JSON.parse(contents);
      if (Array.isArray(parsed)) {
        parsed.forEach((rule) => this.basRules.add(normalizeBasRule(rule)));
      }
    } catch {
      // missing bases
    }
  }

  async hasPaygwTable(key) {
    await this.init();
    return this.paygwTables.has(key);
  }

  async hasGstMap() {
    await this.init();
    return this.gstCategories.size > 0;
  }

  async hasGstCategory(category) {
    await this.init();
    return this.gstCategories.has(category);
  }

  async hasBasRules() {
    await this.init();
    return this.basRules.size > 0;
  }

  async hasBasRule(rule) {
    await this.init();
    return this.basRules.has(normalizeBasRule(rule));
  }
}

export function categorizeTableKey(key) {
  const normalized = String(key).toLowerCase();
  if (normalized.includes("paygw")) return "paygw";
  if (normalized.includes("gst")) return "gst";
  if (normalized.includes("bas")) return "bas";
  return "other";
}

export async function validateConfigCompleteness({ spec, effective, store }) {
  const errors = [];
  const required = Array.isArray(effective.required_tables) ? effective.required_tables : [];
  for (const tableKey of required) {
    const category = categorizeTableKey(tableKey);
    if (category === "paygw") {
      if (!(await store.hasPaygwTable(tableKey))) {
        errors.push(`Missing PAYGW table ${tableKey}`);
      }
    } else if (category === "gst") {
      if (!(await store.hasGstMap())) {
        errors.push(`Missing GST config ${tableKey}`);
      }
    } else if (category === "bas") {
      if (!(await store.hasBasRules())) {
        errors.push(`Missing BAS config ${tableKey}`);
      }
    }
  }
  const gstCategories = Object.keys(spec?.gst?.category_map ?? {});
  for (const category of gstCategories) {
    if (!(await store.hasGstCategory(category))) {
      errors.push(`Missing GST category ${category} in map`);
    }
  }
  const basRules = Array.isArray(spec?.bas?.due_date_rules) ? spec.bas.due_date_rules : [];
  for (const rule of basRules) {
    if (!(await store.hasBasRule(rule))) {
      errors.push(
        `Missing BAS rule for ${rule?.applies_to?.entity_type ?? "unknown"} / ${rule?.applies_to?.frequency ?? "unknown"}`
      );
    }
  }
  return errors;
}

export async function selectConfigStore({ store, dataDir } = {}) {
  if (store) return store;
  if (process.env.DATABASE_URL) {
    throw new Error("Prisma backend not implemented yet; please rely on the file-backed config store");
  }
  return FileConfigStore.create(dataDir);
}

export async function runValidation({ spec, schema, taxYear, store, dataDir } = {}) {
  const specDoc = spec ?? (await loadJson(SPEC_PATH));
  const schemaDoc = schema ?? (await loadJson(SCHEMA_PATH));
  validateSpecAgainstSchema(specDoc, schemaDoc);
  const effective = selectEffectiveDate(specDoc, taxYear ?? process.env.ATO_TAX_YEAR);
  const configStore = await selectConfigStore({ store, dataDir });
  const errors = await validateConfigCompleteness({ spec: specDoc, effective, store: configStore });
  if (errors.length) {
    throw new Error(`ATO ruleset validation failed:\n${errors.join("\n")}`);
  }
  console.log(`ATO ruleset validation OK for ${effective.tax_year}`);
  return { effective, spec: specDoc };
}

async function main() {
  try {
    const result = await runValidation();
    process.exitCode = 0;
    return result;
  } catch (err) {
    console.error("ATO ruleset validation failed:", err.message);
    process.exitCode = 1;
    return null;
  }
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
