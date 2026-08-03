"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { InjuryBadge } from "./InjuryBadge";
import { PositionBadge } from "./PositionBadge";
import { adpTooltip, rankTooltip } from "./PlayerRow";
import { formatStatLine } from "@/lib/statLine";
import type { BoardRow } from "@/lib/derive";
import type { RankingBundle } from "@/lib/types";

interface PlayerDetailModalProps {
  row: BoardRow;
  otherFormatBundle: RankingBundle;
  note: string;
  onNoteChange: (text: string) => void;
  onToggleFavorite: () => void;
  onClose: () => void;
}

function formatPoints(points: number | null): string {
  return points !== null ? points.toFixed(1) : "—";
}

export function PlayerDetailModal({
  row,
  otherFormatBundle,
  note,
  onNoteChange,
  onToggleFavorite,
  onClose,
}: PlayerDetailModalProps) {
  const [noteDraft, setNoteDraft] = useState(note);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const currentFormatLabel = row.format === "ppr" ? "PPR" : "Standard";
  const otherFormatLabel = row.format === "ppr" ? "Standard" : "PPR";
  const statLineEntries = formatStatLine(row.position, row.projectedStatLine);
  const lastSeasonStatLineEntries = formatStatLine(row.position, row.lastSeasonStatLine);

  function commitNote() {
    if (noteDraft !== note) onNoteChange(noteDraft);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-md border border-hairline bg-panel p-5 shadow-lg shadow-black/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display text-lg font-medium tracking-wide text-ink">{row.name}</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
              <PositionBadge position={row.position} />
              <span className="font-mono">{row.team}</span>
              {row.byeWeek !== null && <span className="font-mono text-ink-faint">bye {row.byeWeek}</span>}
              {row.injuryStatus && row.injuryStatus !== "ACTIVE" && <InjuryBadge status={row.injuryStatus} />}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              onClick={onToggleFavorite}
              aria-label={row.isFavorite ? `Unfavorite ${row.name}` : `Favorite ${row.name}`}
              aria-pressed={row.isFavorite}
              className={`flex h-7 w-7 items-center justify-center rounded hover:bg-panel-raised ${
                row.isFavorite ? "text-accent" : "text-ink-faint hover:text-ink-muted"
              }`}
            >
              <Star size={16} fill={row.isFavorite ? "currentColor" : "none"} />
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="flex h-7 w-7 items-center justify-center rounded text-ink-faint hover:bg-panel-raised hover:text-ink-muted"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded border border-hairline bg-board px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{currentFormatLabel} projected</div>
            <div className="mt-0.5 font-display text-2xl font-semibold text-ink">{formatPoints(row.projectedPoints)}</div>
            <div className="mt-1 font-mono text-[10px] text-ink-faint">last season: {formatPoints(row.lastSeasonPoints)}</div>
          </div>
          <div className="rounded border border-hairline bg-board px-3 py-2.5">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">{otherFormatLabel} projected</div>
            <div className="mt-0.5 font-display text-2xl font-semibold text-ink-muted">
              {formatPoints(otherFormatBundle.projectedPoints)}
            </div>
            <div className="mt-1 font-mono text-[10px] text-ink-faint">
              last season: {formatPoints(otherFormatBundle.lastSeasonPoints)}
            </div>
          </div>
        </div>

        {statLineEntries.length > 0 && (
          <div className="mt-4">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">2026 projected stat line</div>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {statLineEntries.map((s) => (
                <div key={s.label} className="rounded border border-hairline px-2 py-1.5 text-center">
                  <div className="font-mono text-sm tabular-nums text-ink">{s.value}</div>
                  <div className="font-mono text-[9px] uppercase tracking-wide text-ink-faint">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {lastSeasonStatLineEntries.length > 0 && (
          <div className="mt-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Last season actual</div>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {lastSeasonStatLineEntries.map((s) => (
                <div key={s.label} className="rounded border border-hairline px-2 py-1.5 text-center">
                  <div className="font-mono text-sm tabular-nums text-ink-muted">{s.value}</div>
                  <div className="font-mono text-[9px] uppercase tracking-wide text-ink-faint">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-1 rounded border border-hairline bg-board px-3 py-2.5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">Draft signal</div>
          <p className="font-mono text-[11px] leading-relaxed text-ink-muted">{rankTooltip(row)}</p>
          {adpTooltip(row) && <p className="font-mono text-[11px] leading-relaxed text-ink-muted">{adpTooltip(row)}</p>}
          {(row.percentOwned !== null || row.auctionValue !== null) && (
            <p className="font-mono text-[11px] text-ink-faint">
              {row.percentOwned !== null && `Owned ${row.percentOwned.toFixed(1)}%`}
              {row.percentOwned !== null && row.auctionValue !== null && " · "}
              {row.auctionValue !== null && `Auction $${row.auctionValue}`}
            </p>
          )}
        </div>

        <div className="mt-4">
          <label className="font-mono text-[10px] uppercase tracking-wider text-ink-faint" htmlFor="player-note">
            Notes
          </label>
          <textarea
            id="player-note"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={commitNote}
            placeholder="Add a note about this player…"
            rows={3}
            className="mt-1.5 w-full resize-none rounded border border-hairline bg-board px-3 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus:border-accent"
          />
        </div>
      </div>
    </div>
  );
}
