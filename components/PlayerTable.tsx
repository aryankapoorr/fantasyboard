"use client";

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlayerRow } from "./PlayerRow";
import type { BoardRow, SortDir, SortKey } from "@/lib/derive";

interface PlayerTableProps {
  rows: BoardRow[];
  editMode: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  onSortChange: (key: SortKey) => void;
  onReorder: (activeId: string, overId: string) => void;
  onDraftMe: (id: string) => void;
  onDraftOther: (id: string) => void;
  onUndraft: (id: string) => void;
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
      className={`text-right font-mono text-[11px] font-medium uppercase tracking-wider transition-colors ${
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
  onSortChange,
  onReorder,
  onDraftMe,
  onDraftOther,
  onUndraft,
}: PlayerTableProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-hairline">
      <div className="hidden grid-cols-[auto_minmax(0,1fr)_4.5rem_4.5rem_2.5rem_4.5rem_9rem] gap-3 border-b border-hairline bg-panel-raised px-3 py-2 sm:grid">
        <div className="w-6" />
        <div className="text-left font-mono text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Player
        </div>
        <HeaderCell label="ADP" sortKey="adp" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <HeaderCell label="Rank" sortKey="consensus" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <HeaderCell label="Mine" sortKey="mine" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <HeaderCell label="Δ7d" sortKey="delta" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <div />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {rows.map((row) => (
            <PlayerRow
              key={row.id}
              row={row}
              editMode={editMode}
              onDraftMe={onDraftMe}
              onDraftOther={onDraftOther}
              onUndraft={onUndraft}
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
