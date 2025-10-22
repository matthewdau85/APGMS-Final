declare module "bcryptjs" {
  export function hash(data: string, saltRounds: number): Promise<string>;
  export function compare(data: string, hash: string): Promise<boolean>;
  const _default: {
    hash: typeof hash;
    compare: typeof compare;
  };
  export default _default;
}
