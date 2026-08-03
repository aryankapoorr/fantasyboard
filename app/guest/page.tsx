"use client";

import playersData from "@/data/players.json";
import { GuestBoard } from "@/components/GuestBoard";
import { SiteHeader } from "@/components/SiteHeader";
import type { Player } from "@/lib/types";

export default function GuestPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader mode="guest" season={playersData.season} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
        <GuestBoard players={playersData.players as Player[]} />
      </main>
    </div>
  );
}
