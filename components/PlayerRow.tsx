"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Star, Undo2 } from "lucide-react";
import { InjuryBadge } from "./InjuryBadge";
import { PlayerAvatar } from "./PlayerAvatar";
import { PositionBadge, positionEdgeColor } from "./PositionBadge";
import { StatDelta } from "./StatDelta";
import type { BoardRow } from "@/lib/derive";

export function adpTooltip(row: BoardRow): string | undefined {
  const formatLabel = row.format === "ppr" ? "PPR" : "standard";
  const parts: string[] = ["ESPN aggregate ADP (format unspecified)"];
  if (row.ffcAdp !== null) {
    const stdevPart =
      row.adpStdev !== null && row.adpSampleSize !== null ? ` (σ${row.adpStdev.toFixed(1)}, n=${row.adpSampleSize})` : "";
    parts.push(`FantasyFootballCalculator ${formatLabel} ADP: ${row.ffcAdp.toFixed(1)}${stdevPart}`);
  }
  return parts.join(" · ");
}

export function rankTooltip(row: BoardRow): string {
  const formatLabel = row.format === "ppr" ? "PPR" : "standard";
  const overall =
    row.consensusSource === "espn"
      ? `Overall #${row.consensusRank} (${formatLabel}): ESPN's cross-position ${formatLabel} consensus`
      : `Overall #${row.consensusRank} (${formatLabel}): editorial fallback (data/seed/expert-rankings.json)`;
  const positionLabel = `${row.position}${row.positionRank}`;
  if (row.positionRankSource === "espn-analysts" && row.positionRankAnalystCount !== null) {
    const range =
      row.positionRankLow !== null && row.positionRankHigh !== null
        ? ` (range ${row.positionRankLow}–${row.positionRankHigh})`
        : "";
    return `${overall}. Position ${positionLabel}: blended from ${row.positionRankAnalystCount} ${formatLabel}-labeled ESPN analysts${range}`;
  }
  return `${overall}. Position ${positionLabel}: editorial order (no ${formatLabel}-labeled analyst data for this player)`;
}

function rankSourceLabel(row: BoardRow): string {
  const positionLabel = `${row.position}${row.positionRank}`;
  if (row.positionRankSource === "espn-analysts" && row.positionRankAnalystCount) {
    return `${positionLabel} ·${row.positionRankAnalystCount}`;
  }
  return `${positionLabel} ·edit`;
}

function abbreviateName(row: BoardRow): string {
  if (row.position === "DST") return row.name;
  const parts = row.name.trim().split(" ");
  if (parts.length < 2) return row.name;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

interface PlayerRowProps {
  row: BoardRow;
  editMode: boolean;
  canDrag: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDraftMe: (id: string) => void;
  onDraftOther: (id: string) => void;
  onUndraft: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onOpenDetail: (id: string) => void;
}

export function PlayerRow({
  row,
  editMode,
  canDrag,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDraftMe,
  onDraftOther,
  onUndraft,
  onToggleFavorite,
  onOpenDetail,
}: PlayerRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: !canDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isDrafted = row.draftStatus !== "available";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? attributes : {})}
      {...(canDrag ? listeners : {})}
      aria-label={canDrag ? `Drag to reorder ${row.name}` : undefined}
      className={`border-b border-hairline transition-colors ${canDrag ? "cursor-grab active:cursor-grabbing" : ""} ${
        isDragging ? "z-10 bg-panel-raised shadow-lg shadow-black/40" : "bg-panel"
      } ${isDrafted ? "opacity-40" : ""}`}
    >
      <div
        className={`group grid items-center gap-2 px-3 py-2.5 sm:gap-3 ${
          editMode
            ? "grid-cols-[auto_1.75rem_1fr_1.5rem_2.75rem_auto_auto_auto] sm:grid-cols-[5rem_2.5rem_minmax(0,1fr)_1.5rem_4.5rem_4.5rem_4.5rem_4.5rem_9rem]"
            : "grid-cols-[1fr_1.5rem_2.75rem_auto_auto_auto] sm:grid-cols-[auto_2.5rem_minmax(0,1fr)_1.5rem_4.5rem_4.5rem_4.5rem_4.5rem_9rem]"
        }`}
      >
        {/* This column's grid slot only exists in the layout when editMode's template reserves it
            (see grid-cols above) — so on !canDrag it must stay `flex` and go `invisible` rather
            than `hidden`, or CSS grid drops it entirely and every later column shifts left by one,
            most visibly breaking the compact mobile template while editing a position's tiers. */}
        <div
          className={`items-center gap-1 ${
            editMode ? `flex h-6 ${canDrag ? "" : "invisible"}` : "hidden h-6 w-6 sm:flex sm:invisible"
          }`}
        >
          <div aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-faint">
            <GripVertical size={15} />
          </div>
          {canDrag && (
            <div className="hidden items-center gap-1 sm:flex">
              <button
                onClick={() => onMoveUp(row.id)}
                disabled={!canMoveUp}
                aria-label={`Move ${row.name} up`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel-raised hover:text-ink-muted disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronUp size={15} />
              </button>
              <button
                onClick={() => onMoveDown(row.id)}
                disabled={!canMoveDown}
                aria-label={`Move ${row.name} down`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel-raised hover:text-ink-muted disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <ChevronDown size={15} />
              </button>
            </div>
          )}
        </div>

        <div
          className={`text-right font-mono text-sm font-medium tabular-nums text-ink ${editMode ? "" : "hidden sm:block"}`}
        >
          {row.mineRank}
        </div>

        <div className="flex min-w-0 items-center gap-2.5 border-l-2 pl-2.5" style={{ borderColor: positionEdgeColor(row.position) }}>
          <button type="button" onClick={() => onOpenDetail(row.id)} className="flex min-w-0 items-center gap-2 text-left">
            <PlayerAvatar player={row} size={30} />
            <div className="min-w-0">
              <div className="truncate font-display text-[15px] font-medium leading-tight tracking-wide text-ink hover:text-accent">
                <span className="sm:hidden">{abbreviateName(row)}</span>
                <span className="hidden sm:inline">{row.name}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                <PositionBadge position={row.position} />
                <span className="font-mono">{row.team}</span>
                {row.byeWeek !== null && (
                  <span className={`font-mono text-ink-faint ${editMode ? "hidden sm:inline" : ""}`}>
                    bye {row.byeWeek}
                  </span>
                )}
                {row.injuryStatus && row.injuryStatus !== "ACTIVE" && (
                  <span className={editMode ? "hidden sm:inline" : ""}>
                    <InjuryBadge status={row.injuryStatus} />
                  </span>
                )}
              </div>
            </div>
          </button>
        </div>

        <button
          onClick={() => onToggleFavorite(row.id)}
          aria-label={row.isFavorite ? `Unfavorite ${row.name}` : `Favorite ${row.name}`}
          aria-pressed={row.isFavorite}
          className={`flex h-6 w-6 items-center justify-center rounded hover:bg-panel-raised ${
            row.isFavorite ? "text-accent" : "text-ink-faint hover:text-ink-muted"
          }`}
        >
          <Star size={15} fill={row.isFavorite ? "currentColor" : "none"} />
        </button>

        <div
          className="hidden text-right font-mono text-sm tabular-nums text-ink-muted sm:block"
          title="FantasyPros expert consensus rank (ECR)"
        >
          {row.fantasyProsRank !== null ? `#${row.fantasyProsRank}` : "—"}
        </div>
        <div className="text-right font-mono text-sm tabular-nums text-ink-muted" title={adpTooltip(row)}>
          {row.adp !== null ? row.adp.toFixed(1) : "—"}
        </div>

        <div className="hidden text-right sm:block" title={rankTooltip(row)}>
          <div className="font-mono text-sm tabular-nums text-ink-muted">#{row.consensusRank}</div>
          <div className="font-mono text-[10px] tabular-nums text-ink-faint">{rankSourceLabel(row)}</div>
        </div>
        <div className="hidden justify-self-end sm:block">
          <StatDelta delta={row.adpWeeklyDelta} />
        </div>

        <div className="col-span-3 flex items-center justify-end gap-1.5 sm:col-span-1">
          {isDrafted ? (
            <button
              onClick={() => onUndraft(row.id)}
              className="flex items-center gap-1 rounded border border-hairline px-2 py-1 font-mono text-[11px] text-ink-muted hover:border-ink-faint hover:text-ink"
            >
              <Undo2 size={12} /> undo
            </button>
          ) : (
            <>
              <button
                onClick={() => onDraftMe(row.id)}
                className="rounded border border-hairline px-2 py-1 font-mono text-[11px] text-ink-muted hover:border-ink-faint hover:text-ink"
              >
                me
              </button>
              <button
                onClick={() => onDraftOther(row.id)}
                className="rounded border border-hairline px-2 py-1 font-mono text-[11px] text-ink-muted hover:border-ink-faint hover:text-ink"
              >
                opp
              </button>
            </>
          )}
        </div>
      </div>

      {canDrag && (
        <div className="flex items-center gap-1.5 border-t border-hairline/60 px-3 py-1.5 sm:hidden">
          <button
            onClick={() => onMoveUp(row.id)}
            disabled={!canMoveUp}
            aria-label={`Move ${row.name} up`}
            className="flex h-8 flex-1 items-center justify-center rounded text-ink-faint hover:bg-panel-raised hover:text-ink-muted disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronUp size={15} />
          </button>
          <button
            onClick={() => onMoveDown(row.id)}
            disabled={!canMoveDown}
            aria-label={`Move ${row.name} down`}
            className="flex h-8 flex-1 items-center justify-center rounded text-ink-faint hover:bg-panel-raised hover:text-ink-muted disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronDown size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
