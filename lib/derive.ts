import { normalizeName } from "./normalize";
import type { BoardState, DraftStatus, Player, Position, RankingFormat, Tier } from "./types";

export type SortKey = "mine" | "consensus" | "adp" | "delta" | "name" | "fantasyPros";
export type SortDir = "asc" | "desc";

export type BoardRow = Omit<Player, "ppr" | "standard"> &
  Player["ppr"] & {
    format: RankingFormat;
    mineRank: number;
    draftStatus: DraftStatus;
    isFavorite: boolean;
  };

const FLEX_POSITIONS = new Set<Position>(["RB", "WR", "TE"]);

export interface FilterState {
  search: string;
  position: Position | "ALL" | "FLEX";
  hideDrafted: boolean;
  onlyMine: boolean;
  onlyFavorites: boolean;
}

export function buildRows(players: Player[], board: BoardState, format: RankingFormat): BoardRow[] {
  const mineRanks = new Map<string, number>();
  board.customOrder.forEach((id, i) => mineRanks.set(id, i + 1));
  const favorites = new Set(board.favorites ?? []);

  return players.map((p) => {
    const { ppr, standard, ...shared } = p;
    const bundle = format === "ppr" ? ppr : standard;
    return {
      ...shared,
      ...bundle,
      format,
      mineRank: mineRanks.get(p.id) ?? bundle.consensusRank,
      draftStatus: board.draftPicks[p.id]?.status ?? "available",
      isFavorite: favorites.has(p.id),
    };
  });
}

// Default ordering for new boards and "reset to fp rank": FantasyPros ECR ascending, players
// FantasyPros doesn't rank (mostly deep bench/waiver players) fall back to consensusRank so they
// still land in a sensible spot instead of all at the end.
export function sortByFantasyProsIds(players: Player[], format: RankingFormat): string[] {
  return players
    .slice()
    .sort((a, b) => {
      const av = a[format];
      const bv = b[format];
      return (av.fantasyProsRank ?? 1000 + av.consensusRank) - (bv.fantasyProsRank ?? 1000 + bv.consensusRank);
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
    if (filters.onlyFavorites && !r.isFavorite) return false;
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
      case "fantasyPros":
        return (nullsLast(a.fantasyProsRank) - nullsLast(b.fantasyProsRank)) * dir;
      case "name":
        return a.name.localeCompare(b.name) * dir;
      default:
        return 0;
    }
  });

  return result;
}

// Fixed roster-review order: QB, RB, WR, TE, DST, K — matches standard fantasy draft-board convention.
export const POSITION_GROUP_ORDER: Position[] = ["QB", "RB", "WR", "TE", "DST", "K"];

export function countsByPosition(rows: BoardRow[]): Record<Position, number> {
  const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  for (const row of rows) counts[row.position]++;
  return counts;
}

export interface PositionGroup {
  position: Position;
  rows: BoardRow[];
}

export function groupRowsByPosition(rows: BoardRow[]): PositionGroup[] {
  return POSITION_GROUP_ORDER.map((position) => ({
    position,
    rows: rows.filter((r) => r.position === position),
  })).filter((group) => group.rows.length > 0);
}

export type InterleavedItem = { type: "player"; row: BoardRow } | { type: "tier"; tier: Tier; number: number };

// Weaves `scopeTiers` into `rows` by anchor (`beforePlayerId`), numbering tiers sequentially in
// the order they're encountered — this is the live auto-numbering shown whenever a tier has no
// custom label. A tier whose anchor player isn't present in `rows` (filtered out by search/
// hideDrafted, or — when rows is a single position-group's slice — simply anchored to a player in
// a different group) is silently dropped; it reappears automatically once the anchor is visible
// again, so callers never need to handle a "missing anchor" case explicitly.
export function interleaveTiers(rows: BoardRow[], scopeTiers: Tier[]): InterleavedItem[] {
  const byAnchor = new Map<string, Tier[]>();
  const trailing: Tier[] = [];
  for (const tier of scopeTiers) {
    if (tier.beforePlayerId === null) {
      trailing.push(tier);
    } else {
      const existing = byAnchor.get(tier.beforePlayerId);
      if (existing) existing.push(tier);
      else byAnchor.set(tier.beforePlayerId, [tier]);
    }
  }

  const result: InterleavedItem[] = [];
  let number = 0;
  for (const row of rows) {
    for (const tier of byAnchor.get(row.id) ?? []) {
      result.push({ type: "tier", tier, number: ++number });
    }
    result.push({ type: "player", row });
  }
  for (const tier of trailing) {
    result.push({ type: "tier", tier, number: ++number });
  }
  return result;
}

export interface TierGap {
  type: "gap";
  gapBeforePlayerId: string | null;
  tiers: { tier: Tier; number: number }[];
}
export interface RowItem {
  type: "row";
  row: BoardRow;
}
export type DisplayItem = TierGap | RowItem;

// Builds one display item per player row plus one "gap" marker before it (and a final gap after
// the last row), each gap carrying whichever tiers currently anchor there. This is what the "+"
// insert affordance renders against: `gapBeforePlayerId` is always a real player id (or null for
// the trailing gap) independent of how many tiers already occupy that slot, so adding another
// tier to an already-occupied gap is just as simple as adding the first one.
export function buildDisplayItems(rows: BoardRow[], scopeTiers: Tier[]): DisplayItem[] {
  const interleaved = interleaveTiers(rows, scopeTiers);
  const items: DisplayItem[] = [];
  let pending: { tier: Tier; number: number }[] = [];
  for (const entry of interleaved) {
    if (entry.type === "tier") {
      pending.push({ tier: entry.tier, number: entry.number });
    } else {
      items.push({ type: "gap", gapBeforePlayerId: entry.row.id, tiers: pending });
      pending = [];
      items.push({ type: "row", row: entry.row });
    }
  }
  items.push({ type: "gap", gapBeforePlayerId: null, tiers: pending });
  return items;
}

