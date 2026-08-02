"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Check, Undo2 } from "lucide-react";
import { PositionBadge, positionEdgeColor } from "./PositionBadge";
import { StatDelta } from "./StatDelta";
import type { BoardRow } from "@/lib/derive";

interface PlayerRowProps {
  row: BoardRow;
  editMode: boolean;
  onDraftMe: (id: string) => void;
  onDraftOther: (id: string) => void;
  onUndraft: (id: string) => void;
}

export function PlayerRow({ row, editMode, onDraftMe, onDraftOther, onUndraft }: PlayerRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: !editMode,
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
      className={`group grid grid-cols-[auto_2.5rem_1fr_auto_auto_auto_auto] items-center gap-3 border-b border-hairline px-3 py-2.5 transition-colors sm:grid-cols-[auto_2.5rem_minmax(0,1fr)_4.5rem_4.5rem_4.5rem_9rem] ${
        isDragging ? "z-10 bg-panel-raised shadow-lg shadow-black/40" : "bg-panel"
      } ${isDrafted ? "opacity-40" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${row.name}`}
        disabled={!editMode}
        className={`flex h-6 w-6 items-center justify-center rounded text-ink-faint ${
          editMode ? "cursor-grab touch-none hover:bg-panel-raised hover:text-ink-muted active:cursor-grabbing" : "invisible"
        }`}
      >
        <GripVertical size={15} />
      </button>

      <div className="font-mono text-sm font-medium tabular-nums text-ink">{row.mineRank}</div>

      <div className="flex min-w-0 items-center gap-2.5 border-l-2 pl-2.5" style={{ borderColor: positionEdgeColor(row.position) }}>
        <div className="min-w-0">
          <div className="truncate font-display text-[15px] font-medium leading-tight tracking-wide text-ink">
            {row.name}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <PositionBadge position={row.position} />
            <span className="font-mono">{row.team}</span>
            {row.byeWeek !== null && <span className="font-mono text-ink-faint">bye {row.byeWeek}</span>}
          </div>
        </div>
      </div>

      <div className="hidden text-right font-mono text-sm tabular-nums text-ink-muted sm:block">
        #{row.consensusRank}
      </div>
      <div className="hidden text-right font-mono text-sm tabular-nums text-ink-muted sm:block">
        {row.adp !== null ? row.adp.toFixed(1) : "—"}
      </div>
      <div className="hidden justify-self-end sm:block">
        <StatDelta delta={row.adpDelta} />
      </div>

      <div className="col-span-4 flex items-center justify-end gap-1.5 sm:col-span-1">
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
              className="flex items-center gap-1 rounded border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[11px] font-medium text-accent hover:bg-accent/20"
            >
              <Check size={12} /> me
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
  );
}
