import { arrayMove } from "@dnd-kit/sortable";
import { normalizeName } from "./normalize";
import type { BoardState, DraftStatus, Player, Position, RankingFormat, Tier } from "./types";

export type SortKey = "mine" | "consensus" | "adp" | "delta" | "name";
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

export type DragResolution =
  | { type: "tier"; ordered: { id: string; beforePlayerId: string | null }[] }
  | { type: "player"; activeId: string; overId: string };

// Resolves a dnd-kit drag-end against the current interleaved [players + tiers] sequence for one
// scope. (Mobile move-up/down chevrons don't go through this — they only ever swap a player with
// its nearest player neighbor, since a tier line between them just follows its anchor wherever
// that player goes; this function is only needed where a drop can land directly on a tier's row.)
//
// Dragging a tier: uses arrayMove so the recomputed order matches what the user visually saw
// mid-drag, then recomputes EVERY same-scope tier's anchor (the next player entry found scanning
// forward, skipping adjacent tiers; null if none remain) — not just the dragged tier's. Multiple
// tiers can share one anchor (stacked in the same gap), and interleaveTiers only disambiguates
// same-anchor tiers by array order, so a single-field patch would silently fail to reorder them.
//
// Dragging a player (only ever invoked when player-dragging is enabled by the caller): if dropped
// onto a tier's slot, resolves to that tier's own anchor player (or the last in-scope player if
// the tier is trailing) so a bare `tier:` id never reaches spliceReorder, which only understands
// player ids.
export function resolveInterleavedDragEnd(
  interleaved: InterleavedItem[],
  activeId: string,
  overId: string
): DragResolution | null {
  if (activeId === overId) return null;
  const idOf = (item: InterleavedItem) => (item.type === "tier" ? item.tier.id : item.row.id);
  const flatIds = interleaved.map(idOf);
  const fromIndex = flatIds.indexOf(activeId);
  const toIndex = flatIds.indexOf(overId);
  if (fromIndex === -1 || toIndex === -1) return null;

  if (activeId.startsWith("tier:")) {
    const moved = arrayMove(interleaved, fromIndex, toIndex);
    const ordered: { id: string; beforePlayerId: string | null }[] = [];
    for (let i = 0; i < moved.length; i++) {
      const item = moved[i];
      if (item.type !== "tier") continue;
      let anchor: string | null = null;
      for (let j = i + 1; j < moved.length; j++) {
        const next = moved[j];
        if (next.type === "player") {
          anchor = next.row.id;
          break;
        }
      }
      ordered.push({ id: item.tier.id, beforePlayerId: anchor });
    }
    return { type: "tier", ordered };
  }

  const overItem = interleaved[toIndex];
  let resolvedOverId: string;
  if (overItem.type === "player") {
    resolvedOverId = overItem.row.id;
  } else if (overItem.tier.beforePlayerId !== null) {
    resolvedOverId = overItem.tier.beforePlayerId;
  } else {
    const lastPlayer = [...interleaved]
      .reverse()
      .find((item): item is Extract<InterleavedItem, { type: "player" }> => item.type === "player" && item.row.id !== activeId);
    if (!lastPlayer) return null;
    resolvedOverId = lastPlayer.row.id;
  }
  if (resolvedOverId === activeId) return null;
  return { type: "player", activeId, overId: resolvedOverId };
}
