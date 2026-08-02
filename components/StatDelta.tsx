export function StatDelta({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="font-mono text-xs text-ink-faint">—</span>;
  }

  const rounded = Math.round(delta * 10) / 10;
  if (Math.abs(rounded) < 0.1) {
    return <span className="font-mono text-xs text-ink-muted">0.0</span>;
  }

  const isValue = rounded > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-xs font-medium ${
        isValue ? "bg-value/10 text-value" : "bg-reach/10 text-reach"
      }`}
      title={isValue ? "Falls later than consensus — potential value" : "Goes earlier than consensus — market reach"}
    >
      {isValue ? "▲" : "▼"} {Math.abs(rounded).toFixed(1)}
    </span>
  );
}
