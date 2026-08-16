"use client";

import { useEffect } from "react";
import { sortByFantasyProsIds } from "@/lib/derive";
import { useFirestoreBoard } from "@/lib/firestoreBoards";
import type { Player } from "@/lib/types";
import { BoardShell } from "./BoardShell";

interface FirestoreBoardViewProps {
  uid: string;
  boardId: string;
  players: Player[];
}

export function FirestoreBoardView({ uid, boardId, players }: FirestoreBoardViewProps) {
  const { board, loading, notFound, actions } = useFirestoreBoard(uid, boardId);

  useEffect(() => {
    // Merges in any players missing from customOrder (e.g. added by a later data refresh) —
    // without this, a new player can never be reordered: spliceReorder is a no-op for an id
    // that isn't in customOrder at all. Runs once per board load (not on every snapshot update,
    // e.g. every reorder/draft pick) since it's keyed on boardId + board-loaded, not on `board`
    // itself, which is a new object reference on every Firestore update.
    if (board) actions.initOrder(sortByFantasyProsIds(players, board.format));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, !!board]);

  if (notFound) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="font-mono text-sm text-ink-muted">This board doesn&apos;t exist or you don&apos;t have access to it.</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="font-mono text-xs text-ink-faint">loading board…</span>
      </div>
    );
  }

  return <BoardShell players={players} board={board} hydrated={!loading} actions={actions} />;
}
