"use client";

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
