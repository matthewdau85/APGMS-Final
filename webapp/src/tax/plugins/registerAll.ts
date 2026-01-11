import { registerPlugin } from "../registry";
import { auPaygwPlugin } from "./auPaygw";
import { auGstPlugin } from "./auGst";

export function registerAllTaxPlugins(): void {
  registerPlugin(auPaygwPlugin);
  registerPlugin(auGstPlugin);
}
