export type TaxTypeId = string;

export type TaxObligation = {
  id: string;
  type: TaxTypeId;
  amountCents: number;
  period?: string;
};

export type PluginContext = {
  asAt: string;
  orgId?: string;
  [key: string]: unknown;
};

export type TaxPlugin<TIn, TOut> = {
  id: TaxTypeId;
  compute: (ctx: PluginContext, input: TIn) => Promise<TOut>;
};

const registry = new Map<TaxTypeId, TaxPlugin<any, any>>();

export function registerPlugin<TIn, TOut>(plugin: TaxPlugin<TIn, TOut>): void {
  if (registry.has(plugin.id)) {
    throw new Error(`Plugin already registered: ${plugin.id}`);
  }
  registry.set(plugin.id, plugin);
}

export function getPlugin<TIn, TOut>(id: TaxTypeId): TaxPlugin<TIn, TOut> {
  const plugin = registry.get(id);
  if (!plugin) {
    throw new Error(`Unknown tax type: ${id}`);
  }
  return plugin as TaxPlugin<TIn, TOut>;
}

export function listTaxTypes(): TaxTypeId[] {
  return Array.from(registry.keys()).sort();
}

export async function computeTax<TIn>(
  id: TaxTypeId,
  ctx: PluginContext,
  input: TIn
): Promise<TaxObligation[]> {
  const plugin = getPlugin<TIn, TaxObligation[]>(id);
  return await plugin.compute(ctx, input);
}
