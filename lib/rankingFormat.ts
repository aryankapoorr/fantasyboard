"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { RankingFormat } from "./types";

const STORAGE_KEY = "fantasyboard:rankingFormat:v1";

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): RankingFormat {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "standard" ? "standard" : "ppr";
  } catch {
    return "ppr";
  }
}

function getServerSnapshot(): RankingFormat {
  return "ppr";
}

// Per-browser preference, not board data — backed directly by localStorage via
// useSyncExternalStore so it stays consistent across every component reading it, with the same
// default (PPR) on the server and first client render to avoid a hydration mismatch.
export function useRankingFormat(): [RankingFormat, (next: RankingFormat) => void] {
  const format = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setFormat = useCallback((next: RankingFormat) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore write failures (private browsing, storage disabled, etc.)
    }
    // The native storage event only fires in OTHER tabs, so notify this tab's listeners too.
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
  }, []);

  return [format, setFormat];
}
