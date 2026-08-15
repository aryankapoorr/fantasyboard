import type { DraftPickState, DraftStatus, Tier, TierScope } from "./types";

export function toggleFavorite(favorites: string[], playerId: string): string[] {
  return favorites.includes(playerId) ? favorites.filter((id) => id !== playerId) : [...favorites, playerId];
}

export function applyNote(notes: Record<string, string>, playerId: string, text: string): Record<string, string> {
  const trimmed = text.trim();
  if (!trimmed) {
    if (!(playerId in notes)) return notes;
    const next = { ...notes };
    delete next[playerId];
    return next;
  }
  return { ...notes, [playerId]: trimmed };
}

export function spliceReorder(order: string[], activeId: string, overId: string): string[] | null {
  const from = order.indexOf(activeId);
  const to = order.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return null;
  const next = order.slice();
  next.splice(from, 1);
  next.splice(to, 0, activeId);
  return next;
}

// Folds any player ids missing from `order` into it — new players the board hasn't seen yet
// (e.g. added by a later data refresh). Each missing id is inserted immediately before the first
// existing entry that ranks worse than it in `adpOrderedIds`, so it lands near its real ADP
// relative to players already on the board instead of being dumped at the very bottom, where
// reordering it back up would take hundreds of moves. Existing entries' relative order is
// untouched. Returns the same array reference when nothing is missing, so callers can skip a
// write with a simple `!==` check.
export function mergeMissingByAdpOrder(order: string[], adpOrderedIds: string[]): string[] {
  const known = new Set(order);
  const missing = adpOrderedIds.filter((id) => !known.has(id));
  if (missing.length === 0) return order;

  const adpRank = new Map(adpOrderedIds.map((id, i) => [id, i]));
  const next = order.slice();
  for (const id of missing) {
    const rank = adpRank.get(id)!;
    let insertAt = next.length;
    for (let i = 0; i < next.length; i++) {
      const existingRank = adpRank.get(next[i]);
      if (existingRank !== undefined && existingRank > rank) {
        insertAt = i;
        break;
      }
    }
    next.splice(insertAt, 0, id);
  }
  return next;
}

export function addTier(tiers: Tier[], scope: TierScope, beforePlayerId: string | null): Tier[] {
  return [...tiers, { id: `tier:${crypto.randomUUID()}`, scope, beforePlayerId, customLabel: null }];
}

export function removeTier(tiers: Tier[], tierId: string): Tier[] {
  return tiers.filter((t) => t.id !== tierId);
}

export function renameTier(tiers: Tier[], tierId: string, label: string): Tier[] {
  const trimmed = label.trim();
  return tiers.map((t) => (t.id === tierId ? { ...t, customLabel: trimmed || null } : t));
}

// Replaces the whole same-scope slice of `tiers` with `ordered` (ids + recomputed anchors, as
// produced by resolveInterleavedDragEnd). A single-field patch on just the dragged tier isn't
// enough: multiple tiers can share one anchor, and their relative order (the tiebreak used by
// interleaveTiers) only lives in this array's element order, so every same-scope tier's position
// must be rewritten atomically for a drag to reliably take effect.
export function applyTierOrder(
  tiers: Tier[],
  scope: TierScope,
  ordered: { id: string; beforePlayerId: string | null }[]
): Tier[] {
  const others = tiers.filter((t) => t.scope !== scope);
  const byId = new Map(tiers.map((t) => [t.id, t]));
  const rebuilt = ordered.map((u) => ({ ...byId.get(u.id)!, beforePlayerId: u.beforePlayerId }));
  return [...others, ...rebuilt];
}

export function computeDraftPickUpdate(
  existing: DraftPickState | undefined,
  status: DraftStatus,
  nextPickNumber: number
): { pick: DraftPickState; nextPickNumber: number } {
  const pick: DraftPickState = {
    status,
    pickNumber: existing?.pickNumber ?? nextPickNumber,
    draftedAt: new Date().toISOString(),
  };
  return { pick, nextPickNumber: existing ? nextPickNumber : nextPickNumber + 1 };
}
