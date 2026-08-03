"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import playersData from "@/data/players.json";
import { sortByAdpIds } from "@/lib/derive";
import { createBoard } from "@/lib/firestoreBoards";
import type { Player, RankingFormat } from "@/lib/types";
import { FormatChoice } from "./FormatChoice";

interface NewBoardDialogProps {
  uid: string;
  onClose: () => void;
}

export function NewBoardDialog({ uid, onClose }: NewBoardDialogProps) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  async function handleChoose(format: RankingFormat) {
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const orderedIds = sortByAdpIds(playersData.players as Player[], format);
      const id = await createBoard(uid, trimmed, orderedIds, playersData.season, format);
      router.push(`/boards/${id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-md border border-hairline bg-panel p-5 shadow-lg shadow-black/40"
      >
        <h2 className="font-display text-base font-medium tracking-wide text-ink">New board</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          placeholder="Board name…"
          disabled={creating}
          className="mt-3 w-full rounded border border-hairline bg-board px-3 py-2 font-body text-sm text-ink placeholder:text-ink-faint focus:border-accent disabled:opacity-50"
        />
        <p className="mt-4 font-mono text-[11px] text-ink-faint">
          {name.trim() ? "Choose a scoring format to create it" : "Enter a name to continue"}
        </p>
        <div className="mt-2">
          <FormatChoice disabled={!name.trim() || creating} onChoose={handleChoose} />
        </div>
        <button
          onClick={onClose}
          disabled={creating}
          className="mt-4 font-mono text-[11px] text-ink-muted hover:text-ink disabled:opacity-50"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
