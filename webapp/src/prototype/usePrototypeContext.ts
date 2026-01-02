import { useOutletContext } from "react-router-dom";

export type PrototypeCtx = { orgId: string; period: string };

export function usePrototypeContext() {
  return useOutletContext<PrototypeCtx>();
}
