import { normalizeName } from "./normalize";
import type { BoardState, DraftStatus, Player, Position, RankingFormat } from "./types";

export type SortKey = "mine" | "consensus" | "adp" | "delta" | "name";
export type SortDir = "asc" | "desc";

export type BoardRow = Omit<Player, "ppr" | "standard"> &
  Player["ppr"] & {
    format: RankingFormat;
    mineRank: number;
    draftStatus: DraftStatus;
  };

const FLEX_POSITIONS = new Set<Position>(["RB", "WR", "TE"]);

export interface FilterState {
  search: string;
  position: Position | "ALL" | "FLEX";
  hideDrafted: boolean;
  onlyMine: boolean;
}

export function buildRows(players: Player[], board: BoardState, format: RankingFormat): BoardRow[] {
  const mineRanks = new Map<string, number>();
  board.customOrder.forEach((id, i) => mineRanks.set(id, i + 1));

  return players.map((p) => {
    const { ppr, standard, ...shared } = p;
    const bundle = format === "ppr" ? ppr : standard;
    return {
      ...shared,
      ...bundle,
      format,
      mineRank: mineRanks.get(p.id) ?? bundle.consensusRank,
      draftStatus: board.draftPicks[p.id]?.status ?? "available",
    };
  });
}

// Default ordering for new boards and "reset to ADP": ADP ascending, undrafted-ADP players
// fall back to consensusRank so they still land in a sensible spot instead of all at the end.
export function sortByAdpIds(players: Player[], format: RankingFormat): string[] {
  return players
    .slice()
    .sort((a, b) => {
      const av = a[format];
      const bv = b[format];
      return (av.adp ?? 1000 + av.consensusRank) - (bv.adp ?? 1000 + bv.consensusRank);
    })
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
