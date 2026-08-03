"use client";

import playersData from "@/data/players.json";
import { BoardPageMain } from "@/components/BoardPageMain";
import { GuestBoard } from "@/components/GuestBoard";
import { SiteHeader } from "@/components/SiteHeader";
import type { Player } from "@/lib/types";

export default function GuestPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader mode="guest" season={playersData.season} />
      <BoardPageMain>
        <GuestBoard players={playersData.players as Player[]} />
      </BoardPageMain>
    </div>
  );
}
