"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import type { Tier } from "@/lib/types";

interface TierRowProps {
  tier: Tier;
  number: number;
  canDrag: boolean;
  onRename: (tierId: string, label: string) => void;
  onRemove: (tierId: string) => void;
}

export function TierRow({ tier, number, canDrag, onRename, onRemove }: TierRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tier.id,
    disabled: !canDrag,
  });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tier.customLabel ?? "");
  const label = tier.customLabel ?? `Tier ${number}`;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function commit() {
    onRename(tier.id, draft);
    setEditing(false);
  }

  function startEditing() {
    if (!canDrag) return;
    setDraft(tier.customLabel ?? "");
    setEditing(true);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? attributes : {})}
      {...(canDrag ? listeners : {})}
      aria-label={canDrag ? `Drag to reorder ${label}` : undefined}
      className={`flex items-center gap-2 border-b border-hairline bg-panel px-3 py-1.5 transition-colors ${
        canDrag ? "cursor-grab active:cursor-grabbing" : ""
      } ${isDragging ? "z-10 bg-panel-raised shadow-lg shadow-black/40" : ""}`}
    >
      {canDrag && (
        <div aria-hidden="true" className="flex h-5 w-5 shrink-0 items-center justify-center text-ink-faint">
          <GripVertical size={13} />
        </div>
      )}
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
          disabled={!canDrag}
          className="shrink-0 whitespace-nowrap font-mono text-[11px] font-medium uppercase tracking-wider text-accent disabled:cursor-default"
        >
          {label}
        </button>
      )}
      <div className="h-px flex-1 bg-accent/40" />
      {canDrag && (
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
}
