import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeLocalStorage } from "./storage";
import {
  applyNote,
  computeDraftPickUpdate,
  mergeMissingByAdpOrder,
  spliceReorder,
  toggleFavorite as toggleFavoriteId,
} from "./boardOps";
import type { BoardState, DraftStatus, RankingFormat } from "./types";

interface BoardActions {
  // Sets the board's format and seeds its order in one step — only meant for a brand new board
  // (customOrder still empty), once the user picks PPR or standard.
  chooseFormat: (format: RankingFormat, orderedIds: string[]) => void;
  initOrder: (playerIds: string[]) => void;
  reorderPlayer: (activeId: string, overId: string) => void;
  resetOrder: (orderedIds: string[]) => void;
  setDraftStatus: (playerId: string, status: DraftStatus) => void;
  undraft: (playerId: string) => void;
  resetDraft: () => void;
  toggleFavorite: (playerId: string) => void;
  setNote: (playerId: string, text: string) => void;
}

type BoardStore = BoardState & BoardActions;

export const useBoardStore = create<BoardStore>()(
  persist(
    (set, get) => ({
      customOrder: [],
      draftPicks: {},
      nextPickNumber: 1,
      format: "ppr",
      favorites: [],
      notes: {},

      chooseFormat: (format, orderedIds) => {
        set({ format, customOrder: orderedIds });
      },

      initOrder: (playerIds) => {
        const { customOrder } = get();
        if (customOrder.length > 0) {
          const next = mergeMissingByAdpOrder(customOrder, playerIds);
          if (next !== customOrder) set({ customOrder: next });
          return;
        }
        set({ customOrder: playerIds });
      },

      reorderPlayer: (activeId, overId) => {
        const { customOrder } = get();
        const next = spliceReorder(customOrder, activeId, overId);
        if (next) set({ customOrder: next });
      },

      resetOrder: (orderedIds) => {
        set({ customOrder: orderedIds });
      },

      setDraftStatus: (playerId, status) => {
        const { draftPicks, nextPickNumber } = get();
        const { pick, nextPickNumber: nextCounter } = computeDraftPickUpdate(
          draftPicks[playerId],
          status,
          nextPickNumber
        );
        set({
          draftPicks: { ...draftPicks, [playerId]: pick },
          nextPickNumber: nextCounter,
        });
      },

      undraft: (playerId) => {
        const { draftPicks } = get();
        const next = { ...draftPicks };
        delete next[playerId];
        set({ draftPicks: next });
      },

      resetDraft: () => {
        set({ draftPicks: {}, nextPickNumber: 1 });
      },

      toggleFavorite: (playerId) => {
        const { favorites } = get();
        set({ favorites: toggleFavoriteId(favorites, playerId) });
      },

      setNote: (playerId, text) => {
        const { notes } = get();
        set({ notes: applyNote(notes, playerId, text) });
      },
    }),
    {
      name: "fantasyboard:board:v1",
      storage: createJSONStorage(() => safeLocalStorage),
      skipHydration: true,
    }
  )
);
