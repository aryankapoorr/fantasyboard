import { Info } from "lucide-react";

const ENTRIES: { label: string; description: string }[] = [
  { label: "Rank", description: "Your custom draft order — drag rows or use the arrows in edit mode." },
  { label: "FP", description: "FantasyPros expert consensus rank (ECR)." },
  { label: "ADP", description: "Average draft position (ESPN aggregate, FFC as fallback)." },
  { label: "ER", description: "ESPN's own expert/analyst consensus rank." },
  { label: "Δ7d", description: "Change in ADP vs. ~a week ago. ▲ rising (drafted earlier), ▼ falling." },
  { label: "Drafted", description: "Mark a player drafted by you (me) or an opponent (opp)." },
];

export function ColumnLegend() {
  return (
    <span className="group/legend relative inline-flex items-center">
      <button
        type="button"
        aria-label="Column meanings"
        className="flex h-4 w-4 items-center justify-center rounded-full text-ink-faint hover:text-ink"
      >
        <Info size={12} />
      </button>
      <div
        role="tooltip"
        className="invisible absolute right-0 top-full z-30 mt-2 w-64 rounded border border-hairline bg-panel-raised p-3 text-left normal-case opacity-0 shadow-lg shadow-black/40 transition-opacity group-hover/legend:visible group-hover/legend:opacity-100 group-focus-within/legend:visible group-focus-within/legend:opacity-100"
      >
        <dl className="flex flex-col gap-1.5">
          {ENTRIES.map(({ label, description }) => (
            <div key={label} className="flex gap-2">
              <dt className="w-11 shrink-0 font-mono text-[11px] font-semibold text-accent">{label}</dt>
              <dd className="font-mono text-[11px] leading-snug text-ink-muted">{description}</dd>
            </div>
          ))}
        </dl>
      </div>
    </span>
  );
}
