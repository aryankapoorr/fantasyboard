"use client";

import { memo, useState } from "react";
import { X } from "lucide-react";
import type { Tier } from "@/lib/types";

interface TierRowProps {
  tier: Tier;
  number: number;
  // Whether tier-editing affordances (rename, remove) show — tiers are never draggable; position
  // is fixed at creation time (wherever the "+" gap was clicked) and only changes if the tier's
  // anchor player is itself reordered, or the tier is removed and re-added elsewhere.
  canEdit: boolean;
  onRename: (tierId: string, label: string) => void;
  onRemove: (tierId: string) => void;
}

export const TierRow = memo(function TierRow({ tier, number, canEdit, onRename, onRemove }: TierRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tier.customLabel ?? "");
  const label = tier.customLabel ?? `Tier ${number}`;

  function commit() {
    onRename(tier.id, draft);
    setEditing(false);
  }

  function startEditing() {
    if (!canEdit) return;
    setDraft(tier.customLabel ?? "");
    setEditing(true);
  }

  return (
    <div className="flex items-center gap-2 border-b border-hairline bg-panel px-3 py-1.5">
      <div className="h-px flex-1 bg-accent/40" />
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(tier.customLabel ?? "");
              setEditing(false);
            }
          }}
          placeholder={`Tier ${number}`}
          className="w-32 border-b border-accent bg-transparent px-1 font-mono text-[11px] font-medium uppercase tracking-wider text-accent outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={startEditing}
          disabled={!canEdit}
          className="shrink-0 whitespace-nowrap font-mono text-[11px] font-medium uppercase tracking-wider text-accent disabled:cursor-default"
        >
          {label}
        </button>
      )}
      <div className="h-px flex-1 bg-accent/40" />
      {canEdit && (
        <button
          type="button"
          onClick={() => onRemove(tier.id)}
          aria-label={`Remove ${label}`}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint hover:bg-panel-raised hover:text-ink-muted"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
});
