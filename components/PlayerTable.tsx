"use client";

import { Fragment } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlayerRow } from "./PlayerRow";
import { groupRowsByPosition, type BoardRow, type SortDir, type SortKey } from "@/lib/derive";
import type { RankingFormat } from "@/lib/types";

interface PlayerTableProps {
  rows: BoardRow[];
  editMode: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  format: RankingFormat;
  groupByPosition?: boolean;
  onSortChange: (key: SortKey) => void;
  onReorder: (activeId: string, overId: string) => void;
  onDraftMe: (id: string) => void;
  onDraftOther: (id: string) => void;
  onUndraft: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onOpenDetail: (id: string) => void;
}

function HeaderCell({
  label,
  sortKey,
  activeKey,
  activeDir,
  onClick,
  className = "",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  activeDir: SortDir;
  onClick: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = sortKey === activeKey;
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={`w-full text-right font-mono text-[11px] font-medium uppercase tracking-wider transition-colors ${
        isActive ? "text-accent" : "text-ink-faint hover:text-ink-muted"
      } ${className}`}
    >
      {label}
      {isActive && <span className="ml-0.5">{activeDir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}

export function PlayerTable({
  rows,
  editMode,
  sortKey,
  sortDir,
  format,
  groupByPosition = false,
  onSortChange,
  onReorder,
  onDraftMe,
  onDraftOther,
  onUndraft,
  onToggleFavorite,
  onOpenDetail,
}: PlayerTableProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const formatLabel = format === "ppr" ? "PPR" : "STD";
  const groups = groupByPosition ? groupRowsByPosition(rows) : null;
  const displayRows = groups ? groups.flatMap((g) => g.rows) : rows;
  const indexById = new Map(displayRows.map((r, i) => [r.id, i]));

  function handleMoveUp(id: string) {
    const index = indexById.get(id);
    if (index === undefined || index === 0) return;
    onReorder(id, displayRows[index - 1].id);
  }

  function handleMoveDown(id: string) {
    const index = indexById.get(id);
    if (index === undefined || index === displayRows.length - 1) return;
    onReorder(id, displayRows[index + 1].id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-hairline">
      <div
        className={`hidden items-start gap-3 border-b border-hairline bg-panel-raised px-3 py-2 sm:grid ${
          editMode
            ? "grid-cols-[5rem_2.5rem_minmax(0,1fr)_1.5rem_4.5rem_4.5rem_4.5rem_9rem]"
            : "grid-cols-[auto_2.5rem_minmax(0,1fr)_1.5rem_4.5rem_4.5rem_4.5rem_9rem]"
        }`}
      >
        <div className="w-6" />
        <HeaderCell label="Rank" sortKey="mine" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <div className="text-left font-mono text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Player
        </div>
        <div className="w-6" />
        <HeaderCell label={`ADP (${formatLabel})`} sortKey="adp" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <HeaderCell label={`Rank (${formatLabel})`} sortKey="consensus" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <HeaderCell label="Δ7d" sortKey="delta" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <div className="text-right font-mono text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Drafted
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayRows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {groups
            ? groups.map((group) => (
                <Fragment key={group.position}>
                  <div className="border-b border-hairline bg-panel-raised px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                    {group.position} · {group.rows.length}
                  </div>
                  {group.rows.map((row) => (
                    <PlayerRow
                      key={row.id}
                      row={row}
                      editMode={editMode}
                      canMoveUp={(indexById.get(row.id) ?? 0) > 0}
                      canMoveDown={(indexById.get(row.id) ?? 0) < displayRows.length - 1}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                      onDraftMe={onDraftMe}
                      onDraftOther={onDraftOther}
                      onUndraft={onUndraft}
                      onToggleFavorite={onToggleFavorite}
                      onOpenDetail={onOpenDetail}
                    />
                  ))}
                </Fragment>
              ))
            : rows.map((row) => (
                <PlayerRow
                  key={row.id}
                  row={row}
                  editMode={editMode}
                  canMoveUp={(indexById.get(row.id) ?? 0) > 0}
                  canMoveDown={(indexById.get(row.id) ?? 0) < displayRows.length - 1}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  onDraftMe={onDraftMe}
                  onDraftOther={onDraftOther}
                  onUndraft={onUndraft}
                  onToggleFavorite={onToggleFavorite}
                  onOpenDetail={onOpenDetail}
                />
              ))}
        </SortableContext>
      </DndContext>

      {rows.length === 0 && (
        <div className="px-4 py-10 text-center font-mono text-sm text-ink-faint">
          No players match the current filters.
        </div>
      )}
    </div>
  );
}
