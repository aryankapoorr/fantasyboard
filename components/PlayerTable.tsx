"use client";

import { Fragment, useMemo } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { PlayerRow } from "./PlayerRow";
import { TierRow } from "./TierRow";
import {
  buildDisplayItems,
  groupRowsByPosition,
  interleaveTiers,
  resolveInterleavedDragEnd,
  type BoardRow,
  type SortDir,
  type SortKey,
} from "@/lib/derive";
import type { RankingFormat, Tier, TierScope } from "@/lib/types";

interface PlayerTableProps {
  rows: BoardRow[];
  editMode: boolean;
  canDragPlayers: boolean;
  canEditTiers: boolean;
  sortKey: SortKey;
  sortDir: SortDir;
  format: RankingFormat;
  groupByPosition?: boolean;
  tierScope: TierScope;
  scopeTiers: Tier[];
  onSortChange: (key: SortKey) => void;
  onReorder: (activeId: string, overId: string) => void;
  onDraftMe: (id: string) => void;
  onDraftOther: (id: string) => void;
  onUndraft: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onOpenDetail: (id: string) => void;
  onAddTier: (scope: TierScope, beforePlayerId: string | null) => void;
  onRemoveTier: (tierId: string) => void;
  onRenameTier: (tierId: string, label: string) => void;
  onReorderTiers: (scope: TierScope, ordered: { id: string; beforePlayerId: string | null }[]) => void;
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

// Insert point between two rows — clicking drops a new tier immediately above the player at
// `gapBeforePlayerId` (or at the very bottom of the scope, if null). Kept faintly visible at rest
// (not fully hidden) so it reads as a real control to find, not a hover easter egg — brightens on
// hover for emphasis. On a coarse pointer, where hover can't happen at all, it's shown at a higher
// resting opacity with a properly tappable hit area instead.
function AddTierGap({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="group/gap relative h-3 pointer-coarse:h-6 transition-[height] hover:h-5">
      <button
        type="button"
        onClick={onAdd}
        aria-label="Add tier here"
        className="absolute inset-0 flex w-full items-center px-3 opacity-40 pointer-coarse:opacity-70 transition-opacity hover:opacity-100 group-hover/gap:opacity-100"
      >
        <span className="h-px flex-1 bg-accent/50" />
        <span className="mx-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-panel pointer-coarse:h-5 pointer-coarse:w-5">
          <Plus size={10} />
        </span>
        <span className="h-px flex-1 bg-accent/50" />
      </button>
    </div>
  );
}

export function PlayerTable({
  rows,
  editMode,
  canDragPlayers,
  canEditTiers,
  sortKey,
  sortDir,
  format,
  groupByPosition = false,
  tierScope,
  scopeTiers,
  onSortChange,
  onReorder,
  onDraftMe,
  onDraftOther,
  onUndraft,
  onToggleFavorite,
  onOpenDetail,
  onAddTier,
  onRemoveTier,
  onRenameTier,
  onReorderTiers,
}: PlayerTableProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const formatLabel = format === "ppr" ? "PPR" : "STD";
  const groups = groupByPosition ? groupRowsByPosition(rows) : null;

  const interleaved = useMemo(() => interleaveTiers(rows, scopeTiers), [rows, scopeTiers]);
  const displayItems = useMemo(() => buildDisplayItems(rows, scopeTiers), [rows, scopeTiers]);
  const indexById = new Map(rows.map((r, i) => [r.id, i]));

  // Chevrons only ever move a player past its nearest player neighbor — any tier line between
  // them just follows its anchor player wherever it goes, so there's nothing extra to resolve
  // here (unlike pointer drag, which can drop a player directly onto a tier's row).
  function handleMoveUp(id: string) {
    const index = indexById.get(id);
    if (index === undefined || index === 0) return;
    onReorder(id, rows[index - 1].id);
  }

  function handleMoveDown(id: string) {
    const index = indexById.get(id);
    if (index === undefined || index === rows.length - 1) return;
    onReorder(id, rows[index + 1].id);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const result = resolveInterleavedDragEnd(interleaved, String(active.id), String(over.id));
    if (!result) return;
    if (result.type === "tier") {
      onReorderTiers(tierScope, result.ordered);
    } else {
      onReorder(result.activeId, result.overId);
    }
  }

  function renderPlayerRow(row: BoardRow) {
    return (
      <PlayerRow
        key={row.id}
        row={row}
        editMode={editMode}
        canDrag={canDragPlayers}
        canMoveUp={canDragPlayers && (indexById.get(row.id) ?? 0) > 0}
        canMoveDown={canDragPlayers && (indexById.get(row.id) ?? 0) < rows.length - 1}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onDraftMe={onDraftMe}
        onDraftOther={onDraftOther}
        onUndraft={onUndraft}
        onToggleFavorite={onToggleFavorite}
        onOpenDetail={onOpenDetail}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-hairline">
      <div
        className={`hidden items-start gap-3 border-b border-hairline bg-panel-raised px-3 py-2 sm:grid ${
          editMode
            ? "grid-cols-[5rem_2.5rem_minmax(0,1fr)_1.5rem_4.5rem_4.5rem_4.5rem_4.5rem_9rem]"
            : "grid-cols-[auto_2.5rem_minmax(0,1fr)_1.5rem_4.5rem_4.5rem_4.5rem_4.5rem_9rem]"
        }`}
      >
        <div className="w-6" />
        <HeaderCell label="Rank" sortKey="mine" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <div className="text-left font-mono text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Player
        </div>
        <div className="w-6" />
        <HeaderCell label={`FP (${formatLabel})`} sortKey="fantasyPros" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <HeaderCell label={`ADP (${formatLabel})`} sortKey="adp" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <HeaderCell label={`ER (${formatLabel})`} sortKey="consensus" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <HeaderCell label="Δ7d" sortKey="delta" activeKey={sortKey} activeDir={sortDir} onClick={onSortChange} />
        <div className="text-right font-mono text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Drafted
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={interleaved.map((item) => (item.type === "tier" ? item.tier.id : item.row.id))}
          strategy={verticalListSortingStrategy}
        >
          {groups
            ? groups.map((group) => (
                <Fragment key={group.position}>
                  <div className="border-b border-hairline bg-panel-raised px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider text-ink-faint">
                    {group.position} · {group.rows.length}
                  </div>
                  {interleaveTiers(group.rows, scopeTiers).map((item) =>
                    item.type === "tier" ? (
                      <TierRow
                        key={item.tier.id}
                        tier={item.tier}
                        number={item.number}
                        canDrag={false}
                        onRename={onRenameTier}
                        onRemove={onRemoveTier}
                      />
                    ) : (
                      renderPlayerRow(item.row)
                    )
                  )}
                </Fragment>
              ))
            : displayItems.map((item) =>
                item.type === "gap" ? (
                  <Fragment key={`gap-${item.gapBeforePlayerId ?? "end"}`}>
                    {item.tiers.map(({ tier, number }) => (
                      <TierRow
                        key={tier.id}
                        tier={tier}
                        number={number}
                        canDrag={canEditTiers}
                        onRename={onRenameTier}
                        onRemove={onRemoveTier}
                      />
                    ))}
                    {canEditTiers && <AddTierGap onAdd={() => onAddTier(tierScope, item.gapBeforePlayerId)} />}
                  </Fragment>
                ) : (
                  renderPlayerRow(item.row)
                )
              )}
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
