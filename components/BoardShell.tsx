"use client";

import { useMemo, useState } from "react";
import {
  buildRows,
  countsByPosition,
  filterAndSortRows,
  sortByFantasyProsIds,
  POSITION_GROUP_ORDER,
  type FilterState,
  type SortDir,
  type SortKey,
} from "@/lib/derive";
import type { BoardState, DraftStatus, Player, TierScope } from "@/lib/types";
import { FilterBar } from "./FilterBar";
import { PlayerDetailModal } from "./PlayerDetailModal";
import { PlayerTable } from "./PlayerTable";

export interface BoardActions {
  reorderPlayer: (activeId: string, overId: string) => void;
  resetOrder: (orderedIds: string[]) => void;
  setDraftStatus: (playerId: string, status: DraftStatus) => void;
  undraft: (playerId: string) => void;
  resetDraft: () => void;
  toggleFavorite: (playerId: string) => void;
  setNote: (playerId: string, text: string) => void;
  addTier: (scope: TierScope, beforePlayerId: string | null) => void;
  removeTier: (tierId: string) => void;
  renameTier: (tierId: string, label: string) => void;
  reorderTiers: (scope: TierScope, ordered: { id: string; beforePlayerId: string | null }[]) => void;
}

interface BoardShellProps {
  players: Player[];
  board: BoardState;
  hydrated: boolean;
  actions: BoardActions;
}

export function BoardShell({ players, board, hydrated, actions }: BoardShellProps) {
  const [editMode, setEditMode] = useState(false);
  const [tierEditMode, setTierEditMode] = useState(false);
  // Defaults to the board's own saved order, not ADP — otherwise a freshly loaded page shows
  // ADP order on top of the (correctly persisted) custom order, which reads as "my reorder didn't save."
  const [sortKey, setSortKey] = useState<SortKey>("mine");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  // Fixed at board creation — boards written before this field existed fall back to PPR.
  const format = board.format ?? "ppr";
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    position: "ALL",
    hideDrafted: false,
    onlyMine: false,
    onlyFavorites: false,
  });

  const defaultOrderedIds = useMemo(() => sortByFantasyProsIds(players, format), [players, format]);

  function handleSortChange(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function handleEditModeChange(next: boolean) {
    setEditMode(next);
    if (next) {
      // The up/down arrows reorder customOrder ("mine"); the visible row order
      // must follow it, or moves appear to do nothing.
      setSortKey("mine");
      setSortDir("asc");
      // Reordering moves a player to sit beside whatever's currently adjacent in customOrder —
      // if any filter is hiding players, "adjacent" in the visible list isn't adjacent in the
      // real order, and the move silently reshuffles hidden players too.
      setFilters((f) => ({ ...f, search: "", hideDrafted: false, onlyMine: false, onlyFavorites: false }));
    }
  }

  function handleTierEditModeChange(next: boolean) {
    setTierEditMode(next);
    if (next) {
      // Tiers anchor to a player id, not an index, so unlike player reordering above this isn't
      // strictly required for correctness — but a stable "mine" order keeps a tier rendering next
      // to the same neighbors while you're editing it, rather than jumping around under whatever
      // sort was active. Position stays as-is: switching position pills is how you pick which
      // scope's tiers you're editing.
      setSortKey("mine");
      setSortDir("asc");
      setFilters((f) => ({ ...f, search: "", hideDrafted: false, onlyMine: false, onlyFavorites: false }));
    }
  }

  const rows = useMemo(() => {
    if (!hydrated) return [];
    const built = buildRows(players, board, format);
    return filterAndSortRows(built, filters, sortKey, sortDir);
  }, [hydrated, players, board, filters, sortKey, sortDir, format]);

  // Tiers exist for the whole board, for each real position, and for the FLEX view — every value
  // `filters.position` can take has its own tier list. Player drag reordering only ever runs at
  // the unfiltered ALL scope, though: reordering within a filtered subset would splice against
  // filtered-list adjacency and corrupt the real customOrder for hidden players (the bug the
  // position-filter-reset above already guards against).
  const tierScope: TierScope = filters.position;
  const canDragPlayers = editMode && filters.position === "ALL";
  // Editing players and editing tiers are independent toggles — otherwise turning on player edit
  // mode on the ALL page also lights up every tier "+" gap and drag handle, cluttering the view
  // for someone who just wants to reorder players.
  const canEditTiers = tierEditMode;
  const scopeTiers = useMemo(
    () => (board.tiers ?? []).filter((t) => t.scope === tierScope),
    [board.tiers, tierScope]
  );

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="font-mono text-xs text-ink-faint">loading board…</span>
      </div>
    );
  }

  const draftedCount = Object.keys(board.draftPicks).length;
  const positionCounts = filters.onlyMine ? countsByPosition(rows) : null;

  // A player can only be selected by clicking a currently-rendered row, and the modal's backdrop
  // blocks further table interaction while open, so both lookups are safe at render time.
  const selectedRow = selectedPlayerId ? (rows.find((r) => r.id === selectedPlayerId) ?? null) : null;
  const otherFormatBundle = selectedPlayerId
    ? players.find((p) => p.id === selectedPlayerId)?.[format === "ppr" ? "standard" : "ppr"]
    : undefined;

  return (
    <div className="flex flex-1 flex-col">
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        editMode={editMode}
        onEditModeChange={handleEditModeChange}
        tierEditMode={tierEditMode}
        onTierEditModeChange={handleTierEditModeChange}
        tierScope={tierScope}
        onReset={() => {
          if (window.confirm("Reset your custom order back to FantasyPros rank order?")) {
            actions.resetOrder(defaultOrderedIds);
          }
        }}
        onResetDraft={() => {
          if (draftedCount === 0) return;
          if (window.confirm(`Undraft all ${draftedCount} player${draftedCount === 1 ? "" : "s"} and start the board fresh?`)) {
            actions.resetDraft();
          }
        }}
        draftedCount={draftedCount}
      />
      <div
        className={`flex flex-col gap-1 px-3 py-2 font-mono text-[11px] sm:flex-row sm:items-center sm:justify-between ${
          filters.onlyMine ? "bg-accent/10 text-accent" : "text-ink-faint"
        }`}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{filters.onlyMine ? `Your team — ${rows.length} player${rows.length === 1 ? "" : "s"}` : `${rows.length} of ${players.length} players`}</span>
          {positionCounts && (
            <span className="text-ink-faint">
              {POSITION_GROUP_ORDER.map((pos) => `${pos} ${positionCounts[pos]}`).join(" · ")}
            </span>
          )}
        </div>
        <span>{draftedCount} drafted</span>
      </div>
      <div className="px-3 pb-6">
        <PlayerTable
          rows={rows}
          editMode={editMode}
          canDragPlayers={canDragPlayers}
          sortKey={sortKey}
          sortDir={sortDir}
          format={format}
          groupByPosition={filters.onlyMine && !editMode && !tierEditMode}
          canEditTiers={canEditTiers}
          tierScope={tierScope}
          scopeTiers={scopeTiers}
          onSortChange={handleSortChange}
          onReorder={actions.reorderPlayer}
          onDraftMe={(id) => actions.setDraftStatus(id, "drafted_by_me")}
          onDraftOther={(id) => actions.setDraftStatus(id, "drafted_by_other")}
          onUndraft={actions.undraft}
          onToggleFavorite={actions.toggleFavorite}
          onOpenDetail={setSelectedPlayerId}
          onAddTier={actions.addTier}
          onRemoveTier={actions.removeTier}
          onRenameTier={actions.renameTier}
          onReorderTiers={actions.reorderTiers}
        />
      </div>

      {selectedRow && otherFormatBundle && (
        <PlayerDetailModal
          row={selectedRow}
          otherFormatBundle={otherFormatBundle}
          note={board.notes?.[selectedRow.id] ?? ""}
          onNoteChange={(text) => actions.setNote(selectedRow.id, text)}
          onToggleFavorite={() => actions.toggleFavorite(selectedRow.id)}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  );
}
