import { useEffect, useState } from "react";
import { protoApi } from "./protoApi";

export function useProtoLive() {
  const [checked, setChecked] = useState(false);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await protoApi.health();
        if (!cancelled) setIsLive(true);
      } catch {
        if (!cancelled) setIsLive(false);
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { checked, isLive };
}
