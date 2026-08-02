"use client";

import { useEffect, useMemo, useState } from "react";
import { useBoardStore } from "@/lib/store";
import type { Player } from "@/lib/types";
import { BoardShell } from "./BoardShell";

export function GuestBoard({ players }: { players: Player[] }) {
  const [hydrated, setHydrated] = useState(false);
  const store = useBoardStore();

  const consensusOrderedIds = useMemo(
    () => players.slice().sort((a, b) => a.consensusRank - b.consensusRank).map((p) => p.id),
    [players]
  );

  useEffect(() => {
    const unsub = useBoardStore.persist.onFinishHydration(() => setHydrated(true));
    useBoardStore.persist.rehydrate();
    return unsub;
  }, []);

  useEffect(() => {
    if (hydrated) store.initOrder(consensusOrderedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  return (
    <BoardShell
      players={players}
      board={store}
      hydrated={hydrated}
      actions={{
        reorderPlayer: store.reorderPlayer,
        resetToConsensus: store.resetToConsensus,
        setDraftStatus: store.setDraftStatus,
        undraft: store.undraft,
      }}
    />
  );
}
