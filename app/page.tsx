"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Radar, MousePointer2, ListChecks, StickyNote, Layers, Filter } from "lucide-react";
import playersData from "@/data/players.json";
import { useAuth } from "@/lib/auth";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PositionBadge } from "@/components/PositionBadge";
import { StatDelta } from "@/components/StatDelta";
import type { Player } from "@/lib/types";

const FEATURES = [
  {
    icon: Radar,
    title: "Live ADP for the entire player pool",
    body: "Every draftable player — not just the household names — ranked and priced straight from ESPN's live draft data, refreshed daily.",
  },
  {
    icon: Layers,
    title: "Build your own tiers",
    body: "Drop in tier breaks anywhere on the board — for everyone, or for a single position — and drag them wherever the value actually falls off.",
  },
  {
    icon: MousePointer2,
    title: "Drag to your own order",
    body: "Reorder every player into your personal board. Compare your ranks against consensus and ADP side by side.",
  },
  {
    icon: Filter,
    title: "Filter by position, flex, or your roster",
    body: "Jump straight to QBs, flex-eligible backs, or just the team you've already drafted, without losing your custom order underneath.",
  },
  {
    icon: ListChecks,
    title: "Track the draft live",
    body: "Mark picks as they happen — yours or an opponent's — and watch the board update instantly.",
  },
  {
    icon: StickyNote,
    title: "Favorite players, keep notes",
    body: "Star your targets and jot a note on anyone — \"buy the dip,\" \"contract dispute\" — saved right on your board.",
  },
] as const;

function PreviewRow({ player }: { player: Player }) {
  return (
    <div className="grid grid-cols-[1.5rem_auto_1fr_3rem_3rem] items-center gap-3 border-b border-hairline px-3 py-2 last:border-b-0">
      <div className="font-mono text-xs tabular-nums text-ink-faint">{player.ppr.consensusRank}</div>
      <PlayerAvatar player={player} size={26} />
      <div className="flex min-w-0 items-center gap-2">
        <PositionBadge position={player.position} />
        <span className="truncate font-display text-sm font-medium tracking-wide text-ink">{player.name}</span>
        <span className="font-mono text-[11px] text-ink-faint">{player.team}</span>
      </div>
      <div className="text-right font-mono text-xs tabular-nums text-ink-muted">
        {player.ppr.adp !== null ? player.ppr.adp.toFixed(1) : "—"}
      </div>
      <div className="justify-self-end">
        <StatDelta delta={player.ppr.adpWeeklyDelta} />
      </div>
    </div>
  );
}

export default function Home() {
  const { user, loading, signInWithGoogle } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/boards");
    }
  }, [loading, user, router]);

  async function handleSignIn() {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : String(err));
    }
  }

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="font-mono text-xs text-ink-faint">loading…</span>
      </div>
    );
  }

  const previewPlayers = (playersData.players as Player[]).slice(0, 5);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-hairline bg-panel px-4 py-3">
        <div className="mx-auto max-w-5xl">
          <span className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
            FantasyBoard
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-16">
        <div className="grid flex-1 grid-cols-1 items-center gap-12 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-5xl">
              Walk into your draft with a board that&apos;s actually yours.
            </h1>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-muted">
              Consensus expert rankings and live ADP, merged into one board you drag into your
              own order, break into tiers, and track pick by pick as the draft happens.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={handleSignIn}
                className="flex items-center gap-2 rounded border border-accent bg-accent px-4 py-2.5 font-mono text-[13px] font-medium tracking-wide text-accent-ink hover:bg-accent-hover"
              >
                <GoogleIcon />
                Sign in with Google
              </button>
              <Link
                href="/guest"
                className="rounded border border-hairline px-4 py-2.5 font-mono text-[13px] text-ink-muted hover:border-ink-faint hover:text-ink"
              >
                Continue as guest →
              </Link>
            </div>
            {authError && <p className="mt-3 font-mono text-xs text-reach">{authError}</p>}
          </div>

          <div className="overflow-hidden rounded-md border border-hairline bg-panel shadow-lg shadow-black/20">
            <div className="border-b border-hairline bg-panel-raised px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-ink-faint">
              {playersData.season} PPR consensus top 5
            </div>
            {previewPlayers.map((p) => (
              <PreviewRow key={p.id} player={p} />
            ))}
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-md border border-hairline bg-panel p-4">
              <Icon size={18} className="text-accent" />
              <h2 className="mt-3 font-display text-sm font-medium tracking-wide text-ink">{title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
