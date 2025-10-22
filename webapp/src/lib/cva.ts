type VariantMap = Record<string, Record<string, string | undefined>>;

type DefaultVariants<V extends VariantMap> = {
  [K in keyof V]?: keyof V[K];
};

type VariantSelection<V extends VariantMap> = {
  [K in keyof V]?: keyof V[K];
};

type CvaOptions<V extends VariantMap> = {
  variants?: V;
  defaultVariants?: DefaultVariants<V>;
};

export function cva<V extends VariantMap>(
  base: string,
  options: CvaOptions<V> = {}
): (selection?: VariantSelection<V>) => string {
  const { variants = {} as V, defaultVariants = {} as DefaultVariants<V> } = options;

  return (selection: VariantSelection<V> = {}) => {
    const classes: Array<string> = [base];
    const resolved = { ...defaultVariants, ...selection } as VariantSelection<V>;

    (Object.keys(variants) as Array<keyof V>).forEach((variantKey) => {
      const variantDefinition = variants[variantKey];
      const value = resolved[variantKey];
      if (value && variantDefinition[value]) {
        classes.push(variantDefinition[value] as string);
      }
    });

    return classes.filter(Boolean).join(' ');
  };
}
