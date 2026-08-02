"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import playersData from "@/data/players.json";
import { useAuth } from "@/lib/auth";
import { useFirestoreBoard } from "@/lib/firestoreBoards";
import { SiteHeader } from "@/components/SiteHeader";
import { FirestoreBoardView } from "@/components/FirestoreBoardView";
import type { Player } from "@/lib/types";

function BoardNameBar({ uid, boardId }: { uid: string; boardId: string }) {
  const { name, actions } = useFirestoreBoard(uid, boardId);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function startEditing() {
    setDraft(name ?? "");
    setEditing(true);
  }

  function commit() {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== name) {
      actions.rename(trimmed);
    }
  }

  return (
    <div className="border-b border-hairline bg-panel px-4 py-2.5">
      <div className="mx-auto flex max-w-5xl items-center gap-2">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="rounded border border-accent bg-board px-2 py-1 font-display text-base text-ink"
          />
        ) : (
          <>
            <h1 className="font-display text-base font-medium tracking-wide text-ink">{name}</h1>
            <button
              onClick={startEditing}
              aria-label="Rename board"
              className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-panel-raised hover:text-ink-muted"
            >
              <Pencil size={12} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function BoardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ boardId: string }>();
  const boardId = params.boardId;

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="font-mono text-xs text-ink-faint">loading…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader mode="board" backHref="/boards" backLabel="my boards" />
      <BoardNameBar uid={user.uid} boardId={boardId} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        <FirestoreBoardView uid={user.uid} boardId={boardId} players={playersData.players as Player[]} />
      </main>
    </div>
  );
}
