"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

interface SiteHeaderProps {
  mode: "landing" | "guest" | "dashboard" | "board";
  syncedAt?: string;
  season?: number;
  backHref?: string;
  backLabel?: string;
}

function formatSyncDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function UserBadge() {
  const { user, signOutUser } = useAuth();
  const router = useRouter();

  if (!user) return null;

  const initial = (user.displayName ?? user.email ?? "?").charAt(0).toUpperCase();

  async function handleSignOut() {
    await signOutUser();
    router.push("/");
  }

  return (
    <div className="flex items-center gap-2">
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photoURL} alt="" className="h-6 w-6 rounded-full border border-hairline" referrerPolicy="no-referrer" />
      ) : (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-panel-raised font-mono text-[11px] text-ink-muted">
          {initial}
        </span>
      )}
      <span className="hidden font-mono text-[11px] text-ink-muted sm:inline">
        {user.displayName ?? user.email}
      </span>
      <button
        onClick={handleSignOut}
        className="rounded border border-hairline px-2 py-1 font-mono text-[11px] text-ink-muted hover:border-ink-faint hover:text-ink"
      >
        sign out
      </button>
    </div>
  );
}

export function SiteHeader({ mode, syncedAt, season, backHref, backLabel }: SiteHeaderProps) {
  return (
    <header className="border-b border-hairline bg-panel px-4 py-3">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-baseline gap-2.5">
          <Link href="/" className="font-display text-xl font-semibold uppercase tracking-wide text-ink">
            FantasyBoard
          </Link>
          {season !== undefined && (
            <span className="hidden font-mono text-xs text-ink-faint sm:inline">{season} season</span>
          )}
          {backHref && (
            <Link
              href={backHref}
              className="font-mono text-[11px] text-ink-muted hover:text-ink"
            >
              ← {backLabel ?? "back"}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {mode === "guest" && (
            <>
              <Link href="/" className="font-mono text-[11px] text-accent hover:text-accent-hover">
                sign in to save boards →
              </Link>
              {syncedAt && (
                <span className="font-mono text-[11px] text-ink-faint">synced {formatSyncDate(syncedAt)}</span>
              )}
            </>
          )}
          {(mode === "dashboard" || mode === "board") && <UserBadge />}
        </div>
      </div>
    </header>
  );
}
