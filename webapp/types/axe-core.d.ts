declare module "axe-core" {
  export interface AxeResults {
    violations: Array<{ id: string; description: string; impact?: string | null }>;
  }

  export interface AxeStatic {
    run(node?: unknown): Promise<AxeResults>;
  }

  const axe: AxeStatic;
  export default axe;
}
