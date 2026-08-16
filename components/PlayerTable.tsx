"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Plus } from "lucide-react";
import { PlayerRow, PlayerRowOverlay } from "./PlayerRow";
import { TierRow } from "./TierRow";
import {
  buildDisplayItems,
  groupRowsByPosition,
  interleaveTiers,
  type BoardRow,
  type DisplayItem,
  type SortDir,
  type SortKey,
} from "@/lib/derive";
import type { RankingFormat, Tier, TierScope } from "@/lib/types";

// Rough per-item height guesses for the pre-measurement total-scroll-height estimate — must stay
// breakpoint-agnostic (no `window`/`document` access) since this also runs during SSR.
// `measureElement`'s ResizeObserver corrects every item's real height after it first mounts.
const PLAYER_ROW_ESTIMATE = 78;
const TIER_ROW_ESTIMATE = 34;
const ADD_TIER_GAP_ESTIMATE = 16;

function estimateDisplayItemSize(item: DisplayItem, canEditTiers: boolean): number {
  if (item.type === "row") return PLAYER_ROW_ESTIMATE;
  return item.tiers.length * TIER_ROW_ESTIMATE + (canEditTiers ? ADD_TIER_GAP_ESTIMATE : 0);
}

function displayItemKey(item: DisplayItem): string {
  return item.type === "row" ? item.row.id : `gap-${item.gapBeforePlayerId ?? "end"}`;
}

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
  // The player currently matched by a search performed while editing (search doesn't filter the
  // list in that mode — see BoardShell — so this is how a match surfaces instead).
  highlightRowId: string | null;
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
  highlightRowId,
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
}: PlayerTableProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const formatLabel = format === "ppr" ? "PPR" : "STD";
  const groups = groupByPosition ? groupRowsByPosition(rows) : null;

  const displayItems = useMemo(() => buildDisplayItems(rows, scopeTiers), [rows, scopeTiers]);
  const indexById = useMemo(() => new Map(rows.map((r, i) => [r.id, i])), [rows]);
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  // Only players are draggable (tiers are fixed once placed — see TierRow), so the active drag
  // item, if any, is always a row.
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeRow = activeId ? (rowById.get(activeId) ?? null) : null;

  // A `useState`-backed callback ref, not `useRef` — reading `.offsetTop` from a plain state value
  // during render is fine; reading `useRef().current` during render is not (flagged by the
  // react-hooks/refs rule, since it can silently desync from what was actually committed).
  const [listElement, setListElement] = useState<HTMLDivElement | null>(null);
  const rowVirtualizer = useWindowVirtualizer({
    count: displayItems.length,
    estimateSize: (index) => estimateDisplayItemSize(displayItems[index], canEditTiers),
    overscan: 12,
    scrollMargin: listElement?.offsetTop ?? 0,
    getItemKey: (index) => displayItemKey(displayItems[index]),
  });

  const highlightIndex = useMemo(() => {
    if (!highlightRowId) return null;
    const index = displayItems.findIndex((item) => item.type === "row" && item.row.id === highlightRowId);
    return index === -1 ? null : index;
  }, [displayItems, highlightRowId]);

  // Re-centers on a fresh search match — deliberately keyed on the resolved index rather than the
  // virtualizer instance (a new object every render), so this doesn't fight the user's own scroll
  // position on unrelated re-renders once a match is already in view.
  useEffect(() => {
    if (highlightIndex === null) return;
    rowVirtualizer.scrollToIndex(highlightIndex, { align: "center", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightIndex]);

  // Chevrons only ever move a player past its nearest player neighbor — any tier line between
  // them just follows its anchor player wherever it goes, so there's nothing extra to resolve
  // here (unlike pointer drag, which can drop a player directly onto a tier's row).
  const handleMoveUp = useCallback(
    (id: string) => {
      const index = indexById.get(id);
      if (index === undefined || index === 0) return;
      onReorder(id, rows[index - 1].id);
    },
    [indexById, rows, onReorder]
  );

  const handleMoveDown = useCallback(
    (id: string) => {
      const index = indexById.get(id);
      if (index === undefined || index === rows.length - 1) return;
      onReorder(id, rows[index + 1].id);
    },
    [indexById, rows, onReorder]
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    onReorder(String(active.id), String(over.id));
  }

  function handleDragCancel() {
    setActiveId(null);
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
        isHighlighted={row.id === highlightRowId}
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

  function renderDisplayItem(item: DisplayItem) {
    if (item.type === "gap") {
      return (
        <>
          {item.tiers.map(({ tier, number }) => (
            <TierRow
              key={tier.id}
              tier={tier}
              number={number}
              canEdit={canEditTiers}
              onRename={onRenameTier}
              onRemove={onRemoveTier}
            />
          ))}
          {canEditTiers && <AddTierGap onAdd={() => onAddTier(tierScope, item.gapBeforePlayerId)} />}
        </>
      );
    }
    return renderPlayerRow(item.row);
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {groups ? (
            groups.map((group) => (
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
                      canEdit={false}
                      onRename={onRenameTier}
                      onRemove={onRemoveTier}
                    />
                  ) : (
                    renderPlayerRow(item.row)
                  )
                )}
              </Fragment>
            ))
          ) : (
            // Only up to ~overscan*2 + visible-row-count display items are actually mounted at
            // once here — this is what keeps dnd-kit's collision detection (which scans every
            // currently-registered droppable on each pointer move) cheap even with a
            // thousand-plus-player board. See the "Fix laggy player drag-and-drop" plan for the
            // full rationale.
            <div ref={setListElement} className="relative" style={{ height: rowVirtualizer.getTotalSize() }}>
              {rowVirtualizer.getVirtualItems().map((virtualItem) => (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start - rowVirtualizer.options.scrollMargin}px)`,
                  }}
                >
                  {renderDisplayItem(displayItems[virtualItem.index])}
                </div>
              ))}
            </div>
          )}
        </SortableContext>
        <DragOverlay>
          {activeRow ? <PlayerRowOverlay row={activeRow} editMode={editMode} canDrag={canDragPlayers} /> : null}
        </DragOverlay>
      </DndContext>

      {rows.length === 0 && (
        <div className="px-4 py-10 text-center font-mono text-sm text-ink-faint">
          No players match the current filters.
        </div>
      )}
    </div>
  );
}
