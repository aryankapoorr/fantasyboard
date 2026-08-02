import { normalizeName } from "./normalize";
import type { BoardState, DraftStatus, Player, Position } from "./types";

export type SortKey = "mine" | "consensus" | "adp" | "delta" | "name";
export type SortDir = "asc" | "desc";

export interface BoardRow extends Player {
  mineRank: number;
  draftStatus: DraftStatus;
}

export interface FilterState {
  search: string;
  position: Position | "ALL";
  hideDrafted: boolean;
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

export function filterAndSortRows(
  rows: BoardRow[],
  filters: FilterState,
  sortKey: SortKey,
  sortDir: SortDir
): BoardRow[] {
  const query = normalizeName(filters.search);

  let result = rows.filter((r) => {
    if (filters.position !== "ALL" && r.position !== filters.position) return false;
    if (filters.hideDrafted && r.draftStatus !== "available") return false;
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
        return (nullsLast(a.adpDelta) - nullsLast(b.adpDelta)) * dir;
      case "name":
        return a.name.localeCompare(b.name) * dir;
      default:
        return 0;
    }
  });

  return result;
}
