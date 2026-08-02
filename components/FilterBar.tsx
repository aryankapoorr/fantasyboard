"use client";

import { Search, RotateCcw } from "lucide-react";
import type { Position } from "@/lib/types";
import type { FilterState } from "@/lib/derive";

const POSITIONS: (Position | "ALL")[] = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (next: FilterState) => void;
  editMode: boolean;
  onEditModeChange: (next: boolean) => void;
  onReset: () => void;
}

export function FilterBar({ filters, onFiltersChange, editMode, onEditModeChange, onReset }: FilterBarProps) {
  return (
    <div className="sticky top-0 z-20 flex flex-col gap-3 border-b border-hairline bg-panel/95 px-3 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            placeholder="Search player…"
            aria-label="Search players"
            className="w-40 rounded border border-hairline bg-board py-1.5 pl-8 pr-2.5 font-body text-sm text-ink placeholder:text-ink-faint focus:border-accent sm:w-52"
          />
        </div>

        <div className="flex items-center gap-1" role="group" aria-label="Filter by position">
          {POSITIONS.map((pos) => (
            <button
              key={pos}
              onClick={() => onFiltersChange({ ...filters, position: pos })}
              aria-pressed={filters.position === pos}
              className={`rounded border px-2 py-1 font-mono text-[11px] font-medium tracking-wide transition-colors ${
                filters.position === pos
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-hairline text-ink-muted hover:border-ink-faint hover:text-ink"
              }`}
            >
              {pos}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 font-mono text-[11px] text-ink-muted">
          <input
            type="checkbox"
            checked={filters.hideDrafted}
            onChange={(e) => onFiltersChange({ ...filters, hideDrafted: e.target.checked })}
            className="h-3.5 w-3.5 accent-[var(--accent)]"
          />
          hide drafted
        </label>

        <button
          onClick={onReset}
          className="flex items-center gap-1 font-mono text-[11px] text-ink-muted hover:text-ink"
        >
          <RotateCcw size={12} /> reset to consensus
        </button>

        <button
          onClick={() => onEditModeChange(!editMode)}
          role="switch"
          aria-checked={editMode}
          className={`flex items-center gap-2 rounded border px-2.5 py-1.5 font-mono text-[11px] font-medium tracking-wide transition-colors ${
            editMode ? "border-accent bg-accent text-accent-ink" : "border-hairline text-ink-muted hover:border-ink-faint hover:text-ink"
          }`}
        >
          <span
            className={`relative inline-block h-3 w-5 rounded-full transition-colors ${editMode ? "bg-accent-ink/30" : "bg-hairline"}`}
          >
            <span
              className={`absolute top-0.5 h-2 w-2 rounded-full bg-current transition-transform ${
                editMode ? "translate-x-2.5" : "translate-x-0.5"
              }`}
            />
          </span>
          edit mode
        </button>
      </div>
    </div>
  );
}
