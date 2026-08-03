import { normalizeName } from "./normalize";
import type { BoardState, DraftStatus, Player, Position } from "./types";

export type SortKey = "mine" | "consensus" | "adp" | "delta" | "name";
export type SortDir = "asc" | "desc";

export interface BoardRow extends Player {
  mineRank: number;
  draftStatus: DraftStatus;
}

const FLEX_POSITIONS = new Set<Position>(["RB", "WR", "TE"]);

export interface FilterState {
  search: string;
  position: Position | "ALL" | "FLEX";
  hideDrafted: boolean;
  onlyMine: boolean;
}

export function buildRows(players: Player[], board: BoardState): BoardRow[] {
  const mineRanks = new Map<string, number>();
  board.customOrder.forEach((id, i) => mineRanks.set(id, i + 1));

  return players.map((p) => ({
    ...p,
    mineRank: mineRanks.get(p.id) ?? p.consensusRank,
    draftStatus: board.draftPicks[p.id]?.status ?? "available",
  }));
}

// Default ordering for new boards and "reset to ADP": ADP ascending, undrafted-ADP players
// fall back to consensusRank so they still land in a sensible spot instead of all at the end.
export function sortByAdpIds(players: Player[]): string[] {
  return players
    .slice()
    .sort((a, b) => (a.adp ?? 1000 + a.consensusRank) - (b.adp ?? 1000 + b.consensusRank))
    .map((p) => p.id);
}

export function filterAndSortRows(
  rows: BoardRow[],
  filters: FilterState,
  sortKey: SortKey,
  sortDir: SortDir
): BoardRow[] {
  const query = normalizeName(filters.search);

  let result = rows.filter((r) => {
    if (filters.position === "FLEX" && !FLEX_POSITIONS.has(r.position)) return false;
    if (filters.position !== "ALL" && filters.position !== "FLEX" && r.position !== filters.position) return false;
    if (filters.hideDrafted && r.draftStatus !== "available") return false;
    if (filters.onlyMine && r.draftStatus !== "drafted_by_me") return false;
    if (query && !normalizeName(r.name).includes(query)) return false;
    return true;
  });

  const dir = sortDir === "asc" ? 1 : -1;
  const nullsLast = (v: number | null) => (v === null ? Number.POSITIVE_INFINITY : v);

  result = result.slice().sort((a, b) => {
    switch (sortKey) {
      case "mine":
        return (a.mineRank - b.mineRank) * dir;
      case "consensus":
        return (a.consensusRank - b.consensusRank) * dir;
      case "adp":
        return (nullsLast(a.adp) - nullsLast(b.adp)) * dir;
      case "delta":
        return (nullsLast(a.adpWeeklyDelta) - nullsLast(b.adpWeeklyDelta)) * dir;
      case "name":
        return a.name.localeCompare(b.name) * dir;
      default:
        return 0;
    }
  });

  return result;
}
