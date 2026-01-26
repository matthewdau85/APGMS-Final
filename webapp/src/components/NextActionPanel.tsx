export default function NextActionPanel({ state }: { state: string }) {
  if (state === "HAS_ALERTS") return <div>Resolve alerts.</div>;
  if (state === "BLOCKED_BAS") return <div>Fix BAS blockers.</div>;
  if (state === "READY") return <div>Lodge BAS.</div>;
  if (state === "LODGED") return <div>Generate evidence.</div>;
  return null;
}
