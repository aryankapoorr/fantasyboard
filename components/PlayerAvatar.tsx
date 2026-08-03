"use client";

import Image from "next/image";
import { useState } from "react";
import { playerImageUrl } from "@/lib/playerImage";
import type { Player } from "@/lib/types";
import { positionEdgeColor } from "./PositionBadge";

interface PlayerAvatarProps {
  player: Pick<Player, "espnId" | "team" | "position" | "name">;
  size: number;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function PlayerAvatar({ player, size }: PlayerAvatarProps) {
  const url = playerImageUrl(player);
  const [errored, setErrored] = useState(false);

  if (!url || errored) {
    return (
      <div
        style={{ width: size, height: size, borderColor: positionEdgeColor(player.position) }}
        className="flex flex-shrink-0 items-center justify-center rounded-full border bg-panel-raised font-mono text-ink-faint"
      >
        <span style={{ fontSize: size * 0.32 }} className="font-medium">
          {player.position === "DST" ? player.team : initials(player.name)}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt={player.name}
      width={size}
      height={size}
      onError={() => setErrored(true)}
      className={`flex-shrink-0 rounded-full bg-panel-raised ${
        player.position === "DST" ? "object-contain p-1" : "object-cover object-top"
      }`}
      style={{ width: size, height: size }}
      unoptimized
    />
  );
}
