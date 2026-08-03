const INJURY_LABELS: Record<string, string> = {
  QUESTIONABLE: "Q",
  DOUBTFUL: "D",
  OUT: "O",
  IR: "IR",
  PUP: "PUP",
  SUSPENSION: "SUS",
};

export function InjuryBadge({ status }: { status: string }) {
  const label = INJURY_LABELS[status] ?? status.slice(0, 3);
  return (
    <span
      className="inline-flex items-center justify-center rounded border border-reach/40 bg-reach/10 px-1 py-0.5 font-mono text-[10px] font-medium tracking-wide text-reach"
      title={status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ")}
    >
      {label}
    </span>
  );
}
