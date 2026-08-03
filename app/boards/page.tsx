"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, Pencil } from "lucide-react";
import playersData from "@/data/players.json";
import { useAuth } from "@/lib/auth";
import { sortByAdpIds } from "@/lib/derive";
import { SiteHeader } from "@/components/SiteHeader";
import { useUserBoards, createBoard, renameBoard, deleteBoard, type BoardSummary } from "@/lib/firestoreBoards";
import type { Player } from "@/lib/types";

function formatRelative(date: Date | null): string {
  if (!date) return "just now";
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function BoardCard({ uid, board }: { uid: string; board: BoardSummary }) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(board.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function commitRename() {
    const trimmed = nameDraft.trim();
    setRenaming(false);
    if (trimmed && trimmed !== board.name) {
      void renameBoard(uid, board.id, trimmed);
    } else {
      setNameDraft(board.name);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline bg-panel px-4 py-3 last:border-b-0">
      <Link href={`/boards/${board.id}`} className="min-w-0 flex-1">
        {renaming ? (
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setNameDraft(board.name);
                setRenaming(false);
              }
            }}
            onClick={(e) => e.preventDefault()}
            className="w-full rounded border border-accent bg-board px-2 py-1 font-display text-[15px] text-ink"
          />
        ) : (
          <div className="truncate font-display text-[15px] font-medium tracking-wide text-ink">{board.name}</div>
        )}
        <div className="mt-0.5 font-mono text-[11px] text-ink-faint">
          {board.draftedCount} drafted · updated {formatRelative(board.updatedAt)}
        </div>
      </Link>

      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setRenaming(true)}
          aria-label="Rename board"
          className="flex h-7 w-7 items-center justify-center rounded border border-hairline text-ink-muted hover:border-ink-faint hover:text-ink"
        >
          <Pencil size={13} />
        </button>
        {confirmingDelete ? (
          <>
            <button
              onClick={() => void deleteBoard(uid, board.id)}
              className="rounded border border-reach/50 bg-reach/10 px-2 py-1 font-mono text-[11px] text-reach hover:bg-reach/20"
            >
              confirm?
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="rounded border border-hairline px-2 py-1 font-mono text-[11px] text-ink-muted hover:text-ink"
            >
              cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            aria-label="Delete board"
            className="flex h-7 w-7 items-center justify-center rounded border border-hairline text-ink-muted hover:border-reach/50 hover:text-reach"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

function NewBoardForm({ uid }: { uid: string }) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const adpOrderedIds = useMemo(() => sortByAdpIds(playersData.players as Player[]), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const id = await createBoard(uid, trimmed, adpOrderedIds, playersData.season);
      router.push(`/boards/${id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New board name…"
        className="w-56 rounded border border-hairline bg-board px-3 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus:border-accent"
      />
      <button
        type="submit"
        disabled={!name.trim() || creating}
        className="flex items-center gap-1.5 rounded border border-accent bg-accent px-3 py-2 font-mono text-[12px] font-medium text-accent-ink hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus size={14} /> new board
      </button>
    </form>
  );
}

export default function BoardsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { boards, loading: boardsLoading } = useUserBoards(user?.uid ?? null);

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
      <SiteHeader mode="dashboard" />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-semibold tracking-wide text-ink">My Boards</h1>
          <NewBoardForm uid={user.uid} />
        </div>

        <div className="mt-8 overflow-hidden rounded-md border border-hairline">
          {boardsLoading ? (
            <div className="px-4 py-10 text-center font-mono text-xs text-ink-faint">loading boards…</div>
          ) : boards.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <p className="font-mono text-xs text-ink-faint">You don&apos;t have any boards yet.</p>
              <p className="mt-1 font-mono text-xs text-ink-faint">Create your first one above to get started.</p>
            </div>
          ) : (
            boards.map((b) => <BoardCard key={b.id} uid={user.uid} board={b} />)
          )}
        </div>
      </main>
    </div>
  );
}
