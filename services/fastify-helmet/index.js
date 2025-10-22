const SKIP_OVERRIDE = Symbol.for("skip-override");

function toKebabCase(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

function buildContentSecurityPolicy(directives = {}) {
  return Object.entries(directives)
    .map(([directive, value]) => {
      if (value === undefined || value === null) {
        return null;
      }
      const normalized = Array.isArray(value) ? value.join(" ") : String(value);
      return `${toKebabCase(directive)} ${normalized}`.trim();
    })
    .filter(Boolean)
    .join("; ");
}

function normalizeHsts(options) {
  if (!options || options === false) {
    return null;
  }
  const { maxAge = 15552000, includeSubDomains = true, preload = false } = options;
  const parts = [`max-age=${Number(maxAge)}`];
  if (includeSubDomains) {
    parts.push("includeSubDomains");
  }
  if (preload) {
    parts.push("preload");
  }
  return parts.join("; ");
}

function normalizeFrameguard(options) {
  if (!options) {
    return null;
  }
  const action = typeof options === "string" ? options : options.action;
  if (!action) {
    return null;
  }
  if (action.toLowerCase() === "deny") {
    return "DENY";
  }
  if (action.toLowerCase() === "sameorigin") {
    return "SAMEORIGIN";
  }
  return null;
}

function normalizeXssFilter(option) {
  if (!option) {
    return null;
  }
  if (typeof option === "string") {
    return option;
  }
  if (typeof option === "object" && option !== null && option.value) {
    return option.value;
  }
  return "1; mode=block";
}

async function helmet(instance, options = {}) {
  const cspHeader = options.contentSecurityPolicy?.directives
    ? buildContentSecurityPolicy(options.contentSecurityPolicy.directives)
    : null;
  const hstsHeader = normalizeHsts(options.hsts);
  const frameguardHeader = normalizeFrameguard(options.frameguard);
  const xssHeader = normalizeXssFilter(options.xssFilter);

  instance.addHook("onSend", async (_request, reply, payload) => {
    reply.header("X-Content-Type-Options", "nosniff");
    if (cspHeader) {
      reply.header("Content-Security-Policy", cspHeader);
    }
    if (frameguardHeader) {
      reply.header("X-Frame-Options", frameguardHeader);
    }
    if (hstsHeader) {
      reply.header("Strict-Transport-Security", hstsHeader);
    }
    if (xssHeader) {
      reply.header("X-XSS-Protection", xssHeader);
    }
    return payload;
  });
}

helmet[SKIP_OVERRIDE] = true;

export default helmet;
