"use client";

import { useEffect, useMemo, useState } from "react";
import { sortByAdpIds } from "@/lib/derive";
import { useRankingFormat } from "@/lib/rankingFormat";
import { useBoardStore } from "@/lib/store";
import type { Player } from "@/lib/types";
import { BoardShell } from "./BoardShell";

export function GuestBoard({ players }: { players: Player[] }) {
  const [hydrated, setHydrated] = useState(false);
  const store = useBoardStore();
  const [format] = useRankingFormat();

  const adpOrderedIds = useMemo(() => sortByAdpIds(players, format), [players, format]);

  useEffect(() => {
    const unsub = useBoardStore.persist.onFinishHydration(() => setHydrated(true));
    useBoardStore.persist.rehydrate();
    return unsub;
  }, []);

  useEffect(() => {
    if (hydrated) store.initOrder(adpOrderedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

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
      }}
    />
  );
}
