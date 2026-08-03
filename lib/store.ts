import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeLocalStorage } from "./storage";
import { computeDraftPickUpdate, spliceReorder } from "./boardOps";
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
}

type BoardStore = BoardState & BoardActions;

export const useBoardStore = create<BoardStore>()(
  persist(
    (set, get) => ({
      customOrder: [],
      draftPicks: {},
      nextPickNumber: 1,
      format: "ppr",

      chooseFormat: (format, orderedIds) => {
        set({ format, customOrder: orderedIds });
      },

      initOrder: (playerIds) => {
        const { customOrder } = get();
        if (customOrder.length > 0) {
          const known = new Set(customOrder);
          const missing = playerIds.filter((id) => !known.has(id));
          if (missing.length > 0) {
            set({ customOrder: [...customOrder, ...missing] });
          }
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
    }),
    {
      name: "fantasyboard:board:v1",
      storage: createJSONStorage(() => safeLocalStorage),
      skipHydration: true,
    }
  )
);
