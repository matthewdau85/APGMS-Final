// packages/domain-policy/src/outcomes/expr.ts

export type Scalar = string | number | boolean | null;

export type Expr =
  | { op: "const"; value: Scalar }
  | { op: "path"; path: string }
  | { op: "add"; args: Expr[] }
  | { op: "sub"; a: Expr; b: Expr }
  | { op: "mul"; args: Expr[] }
  | { op: "div"; a: Expr; b: Expr; default?: number }
  | { op: "max"; args: Expr[] }
  | { op: "min"; args: Expr[] }
  | { op: "gte"; a: Expr; b: Expr }
  | { op: "gt"; a: Expr; b: Expr }
  | { op: "lte"; a: Expr; b: Expr }
  | { op: "lt"; a: Expr; b: Expr }
  | { op: "eq"; a: Expr; b: Expr }
  | { op: "and"; args: Expr[] }
  | { op: "or"; args: Expr[] }
  | { op: "not"; value: Expr }
  | { op: "if"; cond: Expr; then: Expr; else: Expr }
  | { op: "clamp"; value: Expr; min: Expr; max: Expr }
  | { op: "round"; value: Expr; decimals?: number };

function isRecord(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function getByPath(ctx: unknown, path: string): unknown {
  if (!path || typeof path !== "string") throw new Error("Invalid path");
  const parts = path.split(".");
  let cur: any = ctx;
  for (const p of parts) {
    if (!isRecord(cur) || !(p in cur)) {
      throw new Error(`Path not found: ${path}`);
    }
    cur = cur[p];
  }
  return cur;
}

function asNumber(v: unknown, where: string): number {
  if (typeof v !== "number" || Number.isNaN(v)) {
    throw new Error(`Expected number at ${where}, got ${typeof v}`);
  }
  return v;
}

function asBool(v: unknown, where: string): boolean {
  if (typeof v !== "boolean") {
    throw new Error(`Expected boolean at ${where}, got ${typeof v}`);
  }
  return v;
}

export function evalExpr(expr: Expr, ctx: unknown): Scalar {
  switch (expr.op) {
    case "const":
      return expr.value;

    case "path":
      return getByPath(ctx, expr.path) as any;

    case "add": {
      const vals = expr.args.map((e, i) => asNumber(evalExpr(e, ctx), `add.args[${i}]`));
      return vals.reduce((a, b) => a + b, 0);
    }

    case "sub": {
      const a = asNumber(evalExpr(expr.a, ctx), "sub.a");
      const b = asNumber(evalExpr(expr.b, ctx), "sub.b");
      return a - b;
    }

    case "mul": {
      const vals = expr.args.map((e, i) => asNumber(evalExpr(e, ctx), `mul.args[${i}]`));
      return vals.reduce((a, b) => a * b, 1);
    }

    case "div": {
      const a = asNumber(evalExpr(expr.a, ctx), "div.a");
      const b = asNumber(evalExpr(expr.b, ctx), "div.b");
      if (b === 0) return (expr.default ?? 0);
      return a / b;
    }

    case "max": {
      const vals = expr.args.map((e, i) => asNumber(evalExpr(e, ctx), `max.args[${i}]`));
      return Math.max(...vals);
    }

    case "min": {
      const vals = expr.args.map((e, i) => asNumber(evalExpr(e, ctx), `min.args[${i}]`));
      return Math.min(...vals);
    }

    case "gte": {
      const a = asNumber(evalExpr(expr.a, ctx), "gte.a");
      const b = asNumber(evalExpr(expr.b, ctx), "gte.b");
      return a >= b;
    }

    case "gt": {
      const a = asNumber(evalExpr(expr.a, ctx), "gt.a");
      const b = asNumber(evalExpr(expr.b, ctx), "gt.b");
      return a > b;
    }

    case "lte": {
      const a = asNumber(evalExpr(expr.a, ctx), "lte.a");
      const b = asNumber(evalExpr(expr.b, ctx), "lte.b");
      return a <= b;
    }

    case "lt": {
      const a = asNumber(evalExpr(expr.a, ctx), "lt.a");
      const b = asNumber(evalExpr(expr.b, ctx), "lt.b");
      return a < b;
    }

    case "eq":
      return evalExpr(expr.a, ctx) === evalExpr(expr.b, ctx);

    case "and": {
      const vals = expr.args.map((e, i) => asBool(evalExpr(e, ctx), `and.args[${i}]`));
      return vals.every(Boolean);
    }

    case "or": {
      const vals = expr.args.map((e, i) => asBool(evalExpr(e, ctx), `or.args[${i}]`));
      return vals.some(Boolean);
    }

    case "not":
      return !asBool(evalExpr(expr.value, ctx), "not.value");

    case "if": {
      const c = asBool(evalExpr(expr.cond, ctx), "if.cond");
      return c ? evalExpr(expr.then, ctx) : evalExpr(expr.else, ctx);
    }

    case "clamp": {
      const v = asNumber(evalExpr(expr.value, ctx), "clamp.value");
      const min = asNumber(evalExpr(expr.min, ctx), "clamp.min");
      const max = asNumber(evalExpr(expr.max, ctx), "clamp.max");
      return Math.min(max, Math.max(min, v));
    }

    case "round": {
      const v = asNumber(evalExpr(expr.value, ctx), "round.value");
      const d = expr.decimals ?? 0;
      const f = Math.pow(10, d);
      return Math.round(v * f) / f;
    }

    default: {
      const neverExpr: never = expr;
      throw new Error(`Unhandled op: ${(neverExpr as any).op}`);
    }
  }
}
