"use client";

import { useMemo, useState } from "react";
import { buildRows, filterAndSortRows, sortByAdpIds, type FilterState, type SortDir, type SortKey } from "@/lib/derive";
import type { BoardState, DraftStatus, Player } from "@/lib/types";
import { FilterBar } from "./FilterBar";
import { PlayerTable } from "./PlayerTable";

export interface BoardActions {
  reorderPlayer: (activeId: string, overId: string) => void;
  resetOrder: (orderedIds: string[]) => void;
  setDraftStatus: (playerId: string, status: DraftStatus) => void;
  undraft: (playerId: string) => void;
}

interface BoardShellProps {
  players: Player[];
  board: BoardState;
  hydrated: boolean;
  actions: BoardActions;
}

export function BoardShell({ players, board, hydrated, actions }: BoardShellProps) {
  const [editMode, setEditMode] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("adp");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    position: "ALL",
    hideDrafted: false,
    onlyMine: false,
  });

  const adpOrderedIds = useMemo(() => sortByAdpIds(players), [players]);

  function handleSortChange(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const rows = useMemo(() => {
    if (!hydrated) return [];
    const built = buildRows(players, board);
    return filterAndSortRows(built, filters, sortKey, sortDir);
  }, [hydrated, players, board, filters, sortKey, sortDir]);

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="font-mono text-xs text-ink-faint">loading board…</span>
      </div>
    );
  }

  const draftedCount = Object.keys(board.draftPicks).length;

  return (
    <div className="flex flex-1 flex-col">
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        editMode={editMode}
        onEditModeChange={setEditMode}
        onReset={() => actions.resetOrder(adpOrderedIds)}
      />
      <div className="flex items-center justify-between px-3 py-2 font-mono text-[11px] text-ink-faint">
        <span>
          {rows.length} of {players.length} players
        </span>
        <span>{draftedCount} drafted</span>
      </div>
      <div className="px-3 pb-6">
        <PlayerTable
          rows={rows}
          editMode={editMode}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortChange={handleSortChange}
          onReorder={actions.reorderPlayer}
          onDraftMe={(id) => actions.setDraftStatus(id, "drafted_by_me")}
          onDraftOther={(id) => actions.setDraftStatus(id, "drafted_by_other")}
          onUndraft={actions.undraft}
        />
      </div>
    </div>
  );
}
