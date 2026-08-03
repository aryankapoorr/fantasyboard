"use client";

import type { RankingFormat } from "@/lib/types";

interface FormatChoiceProps {
  onChoose: (format: RankingFormat) => void;
  disabled?: boolean;
}

const OPTIONS: { format: RankingFormat; label: string; description: string }[] = [
  { format: "ppr", label: "PPR", description: "Point per reception scoring" },
  { format: "standard", label: "Standard", description: "Non-PPR scoring" },
];

export function FormatChoice({ onChoose, disabled = false }: FormatChoiceProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {OPTIONS.map((opt) => (
        <button
          key={opt.format}
          type="button"
          disabled={disabled}
          onClick={() => onChoose(opt.format)}
          className="rounded-md border border-hairline px-3 py-2.5 text-left transition-colors hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hairline disabled:hover:bg-transparent"
        >
          <div className="font-display text-sm font-medium tracking-wide text-ink">{opt.label}</div>
          <div className="mt-0.5 font-mono text-[10px] text-ink-faint">{opt.description}</div>
        </button>
      ))}
    </div>
  );
}
