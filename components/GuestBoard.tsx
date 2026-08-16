"use client";

import { useEffect, useState } from "react";
import { sortByFantasyProsIds } from "@/lib/derive";
import { useBoardStore } from "@/lib/store";
import type { Player } from "@/lib/types";
import { BoardShell } from "./BoardShell";
import { FormatChoice } from "./FormatChoice";

export function GuestBoard({ players }: { players: Player[] }) {
  const [hydrated, setHydrated] = useState(false);
  const store = useBoardStore();

  useEffect(() => {
    const unsub = useBoardStore.persist.onFinishHydration(() => setHydrated(true));
    useBoardStore.persist.rehydrate();
    return unsub;
  }, []);

  useEffect(() => {
    // A board that already has an order was created under some format already — just merge in
    // any players missing from it. A brand new board (no order yet) waits for the format pick
    // below instead of defaulting silently.
    if (hydrated && store.customOrder.length > 0) {
      store.initOrder(sortByFantasyProsIds(players, store.format));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="font-mono text-xs text-ink-faint">loading board…</span>
      </div>
    );
  }

  if (store.customOrder.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-display text-lg font-medium tracking-wide text-ink">Choose a scoring format</h1>
          <p className="mt-1.5 font-mono text-[11px] text-ink-faint">
            Sets your board&apos;s default order and rankings.
          </p>
          <div className="mt-5">
            <FormatChoice onChoose={(format) => store.chooseFormat(format, sortByFantasyProsIds(players, format))} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <BoardShell
      players={players}
      board={store}
      hydrated={hydrated}
      actions={{
        reorderPlayer: store.reorderPlayer,
        resetOrder: store.resetOrder,
        setDraftStatus: store.setDraftStatus,
        undraft: store.undraft,
        resetDraft: store.resetDraft,
        toggleFavorite: store.toggleFavorite,
        setNote: store.setNote,
        addTier: store.addTier,
        removeTier: store.removeTier,
        renameTier: store.renameTier,
      }}
    />
  );
}
