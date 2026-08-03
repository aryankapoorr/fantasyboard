"use client";

import { useMemo, useState } from "react";
import { buildRows, filterAndSortRows, sortByAdpIds, type FilterState, type SortDir, type SortKey } from "@/lib/derive";
import { useRankingFormat } from "@/lib/rankingFormat";
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
  const [format, setFormat] = useRankingFormat();
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    position: "ALL",
    hideDrafted: false,
    onlyMine: false,
  });

  const adpOrderedIds = useMemo(() => sortByAdpIds(players, format), [players, format]);

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
      // Dragging reorders customOrder ("mine"); the visible row order must
      // follow it, or drags appear to do nothing.
      setSortKey("mine");
      setSortDir("asc");
    }
  }

  const rows = useMemo(() => {
    if (!hydrated) return [];
    const built = buildRows(players, board, format);
    return filterAndSortRows(built, filters, sortKey, sortDir);
  }, [hydrated, players, board, filters, sortKey, sortDir, format]);

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
        onEditModeChange={handleEditModeChange}
        format={format}
        onFormatChange={setFormat}
        onReset={() => actions.resetOrder(adpOrderedIds)}
      />
      <div
        className={`flex items-center justify-between px-3 py-2 font-mono text-[11px] ${
          filters.onlyMine ? "bg-accent/10 text-accent" : "text-ink-faint"
        }`}
      >
        <span>{filters.onlyMine ? `Your team — ${rows.length} player${rows.length === 1 ? "" : "s"}` : `${rows.length} of ${players.length} players`}</span>
        <span>{draftedCount} drafted</span>
      </div>
      <div className="px-3 pb-6">
        <PlayerTable
          rows={rows}
          editMode={editMode}
          sortKey={sortKey}
          sortDir={sortDir}
          format={format}
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
