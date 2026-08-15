import type { DraftPickState, DraftStatus } from "./types";

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
