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
