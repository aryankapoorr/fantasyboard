import { normalizeName } from "../../lib/normalize";
import type { Player, RankingBundle, RankingFormat, SeedPlayer, StatLine } from "../../lib/types";
import type { EspnPlayer } from "./espn";
import type { FfcPlayer } from "./ffc";
import type { SleeperData, SleeperEntry } from "./sleeper";

export interface FormatCoverage {
  consensusEspnCount: number;
  topTierConsensusEspnCount: number;
  positionRankEspnCount: number;
  topTierPositionRankEspnCount: number;
  ffcMatchedCount: number;
}

export interface MergeResult {
  players: Player[];
  matchedFromEspnCount: number;
  topTierCount: number;
  unmatchedNames: string[];
  coverage: Record<RankingFormat, FormatCoverage>;
  sleeperMatchedCount: number;
}

// ESPN only ships cross-position/analyst-blended ranks with real confidence for its own
// top-ranked players; coverage tapers off for bench/K/DST. Used as a safety-net signal scoped
// to the seed's top tier, where coverage should be ~universal, rather than the full list.
const TOP_TIER_SEED_RANK = 50;

const FORMATS: RankingFormat[] = ["ppr", "standard"];

function indexKey(name: string, position: string): string {
  return `${normalizeName(name)}|${position}`;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface SeedEntry {
  seed: SeedPlayer;
  espn: EspnPlayer | undefined;
  ffc: Record<RankingFormat, FfcPlayer | undefined>;
  sleeperProjection: SleeperEntry | undefined;
  sleeperLastSeason: SleeperEntry | undefined;
}

function lookupSleeper(index: SleeperData["projections"], name: string, position: string, team: string): SleeperEntry | undefined {
  return position === "DST" ? index.dstByTeam.get(team) : index.byNameAndPosition.get(indexKey(name, position));
}

// StatLine is position-agnostic and identical regardless of scoring format, so it's built once
// from whichever Sleeper entry matched (projection or last-season), not per-format.
function toPlayerStatLine(entry: SleeperEntry | undefined): StatLine | null {
  return entry?.statLine ?? null;
}

// Two-tier sort avoids ever comparing values from different scales directly: entries with a
// genuine live value for this format sort by that first, then the rest fall back to the seed's
// static editorial order (used identically regardless of format — it's a fallback for missing
// data, not a competing format-specific source).
function twoTierRank<T>(
  entries: T[],
  liveValue: (t: T) => number | null,
  editorialValue: (t: T) => number
): Map<T, { rank: number; source: "espn" | "editorial" }> {
  const withLive = entries.filter((e) => liveValue(e) !== null).sort((a, b) => liveValue(a)! - liveValue(b)!);
  const withoutLive = entries
    .filter((e) => liveValue(e) === null)
    .sort((a, b) => editorialValue(a) - editorialValue(b));
  const result = new Map<T, { rank: number; source: "espn" | "editorial" }>();
  [...withLive, ...withoutLive].forEach((e, i) => {
    result.set(e, { rank: i + 1, source: liveValue(e) !== null ? "espn" : "editorial" });
  });
  return result;
}

export function mergePlayers(
  seed: SeedPlayer[],
  espnPlayers: EspnPlayer[],
  ffcByFormat: Record<RankingFormat, FfcPlayer[]>,
  sleeper: SleeperData,
  aliases: Record<string, string>
): MergeResult {
  const byNameAndPosition = new Map<string, EspnPlayer>();
  const dstByTeam = new Map<string, EspnPlayer>();
  for (const ep of espnPlayers) {
    if (!ep.position) continue;
    if (ep.position === "DST") {
      dstByTeam.set(ep.team, ep);
    } else {
      byNameAndPosition.set(indexKey(ep.fullName, ep.position), ep);
    }
  }

  const ffcIndex: Record<RankingFormat, { byNameAndPosition: Map<string, FfcPlayer>; dstByTeam: Map<string, FfcPlayer> }> =
    {
      ppr: { byNameAndPosition: new Map(), dstByTeam: new Map() },
      standard: { byNameAndPosition: new Map(), dstByTeam: new Map() },
    };
  for (const format of FORMATS) {
    for (const fp of ffcByFormat[format]) {
      if (!fp.position) continue;
      if (fp.position === "DST") {
        ffcIndex[format].dstByTeam.set(fp.team, fp);
      } else {
        ffcIndex[format].byNameAndPosition.set(indexKey(fp.name, fp.position), fp);
      }
    }
  }

  const entries: SeedEntry[] = [];
  const unmatchedNames: string[] = [];
  let matchedFromEspnCount = 0;
  let topTierCount = 0;
  let sleeperMatchedCount = 0;

  for (const s of seed) {
    const resolvedName = aliases[s.name] ?? s.name;

    let espn: EspnPlayer | undefined;
    const ffc: Record<RankingFormat, FfcPlayer | undefined> = { ppr: undefined, standard: undefined };
    if (s.position === "DST") {
      espn = dstByTeam.get(s.team);
      for (const format of FORMATS) ffc[format] = ffcIndex[format].dstByTeam.get(s.team);
    } else {
      espn = byNameAndPosition.get(indexKey(resolvedName, s.position));
      for (const format of FORMATS) ffc[format] = ffcIndex[format].byNameAndPosition.get(indexKey(resolvedName, s.position));
    }

    const sleeperProjection = lookupSleeper(sleeper.projections, resolvedName, s.position, s.team);
    const sleeperLastSeason = lookupSleeper(sleeper.lastSeason, resolvedName, s.position, s.team);
    if (sleeperProjection || sleeperLastSeason) sleeperMatchedCount++;

    if (espn) matchedFromEspnCount++;
    else unmatchedNames.push(s.name);
    if (s.rank <= TOP_TIER_SEED_RANK) topTierCount++;

    entries.push({ seed: s, espn, ffc, sleeperProjection, sleeperLastSeason });
  }

  // consensusRank: overall cross-position rank, per format, from ESPN's own draftRanksByRankType
  // (verified live to be a true cross-position board, not position-scoped).
  const consensusRankByFormat: Record<RankingFormat, Map<SeedEntry, { rank: number; source: "espn" | "editorial" }>> =
    {
      ppr: twoTierRank(entries, (e) => e.espn?.ppr.overallRank ?? null, (e) => e.seed.rank),
      standard: twoTierRank(entries, (e) => e.espn?.standard.overallRank ?? null, (e) => e.seed.rank),
    };

  // positionRank: within-position rank, per format, from ESPN's per-position analyst blend.
  const byPosition = new Map<string, SeedEntry[]>();
  for (const e of entries) {
    const list = byPosition.get(e.seed.position) ?? [];
    list.push(e);
    byPosition.set(e.seed.position, list);
  }
  const positionRankByFormat: Record<RankingFormat, Map<SeedEntry, { rank: number; source: "espn" | "editorial" }>> = {
    ppr: new Map(),
    standard: new Map(),
  };
  for (const [, list] of byPosition) {
    for (const format of FORMATS) {
      const ranked = twoTierRank(
        list,
        (e) => e.espn?.[format].positionAverageRank ?? null,
        (e) => e.seed.rank
      );
      for (const [entry, value] of ranked) positionRankByFormat[format].set(entry, value);
    }
  }

  const coverage: Record<RankingFormat, FormatCoverage> = {
    ppr: { consensusEspnCount: 0, topTierConsensusEspnCount: 0, positionRankEspnCount: 0, topTierPositionRankEspnCount: 0, ffcMatchedCount: 0 },
    standard: { consensusEspnCount: 0, topTierConsensusEspnCount: 0, positionRankEspnCount: 0, topTierPositionRankEspnCount: 0, ffcMatchedCount: 0 },
  };

  const players: Player[] = entries.map((e) => {
    const s = e.seed;
    const isTopTier = s.rank <= TOP_TIER_SEED_RANK;

    const bundles = {} as Record<RankingFormat, RankingBundle>;
    for (const format of FORMATS) {
      const consensus = consensusRankByFormat[format].get(e)!;
      const positionRank = positionRankByFormat[format].get(e)!;
      const ffcPlayer = e.ffc[format];

      if (consensus.source === "espn") {
        coverage[format].consensusEspnCount++;
        if (isTopTier) coverage[format].topTierConsensusEspnCount++;
      }
      if (positionRank.source === "espn") {
        coverage[format].positionRankEspnCount++;
        if (isTopTier) coverage[format].topTierPositionRankEspnCount++;
      }
      if (ffcPlayer) coverage[format].ffcMatchedCount++;

      bundles[format] = {
        consensusRank: consensus.rank,
        consensusSource: consensus.source,
        positionRank: positionRank.rank,
        positionRankSource: positionRank.source === "espn" ? "espn-analysts" : "editorial",
        positionRankAnalystCount: e.espn ? e.espn[format].positionRankAnalystCount : null,
        positionRankLow: e.espn?.[format].positionRankLow ?? null,
        positionRankHigh: e.espn?.[format].positionRankHigh ?? null,
        // ESPN's ADP has full coverage and is the primary source; FFC only fills in the rare
        // case ESPN has no value (e.g. a player unmatched from ESPN entirely).
        adp: e.espn?.adp ?? ffcPlayer?.adp ?? null,
        adpWeeklyDelta: null, // filled in by fetch-rankings.ts against the rolling weekly anchor
        ffcAdp: ffcPlayer?.adp ?? null,
        adpHigh: ffcPlayer?.high ?? null,
        adpLow: ffcPlayer?.low ?? null,
        adpStdev: ffcPlayer?.stdev ?? null,
        adpSampleSize: ffcPlayer?.timesDrafted ?? null,
        projectedPoints: (format === "ppr" ? e.sleeperProjection?.pointsPpr : e.sleeperProjection?.pointsStd) ?? null,
        lastSeasonPoints: (format === "ppr" ? e.sleeperLastSeason?.pointsPpr : e.sleeperLastSeason?.pointsStd) ?? null,
      };
    }

    return {
      id: e.espn ? String(e.espn.espnId) : `slug:${normalizeName(s.name)}-${s.team.toLowerCase()}`,
      espnId: e.espn?.espnId ?? null,
      name: s.name,
      position: s.position,
      team: e.espn?.team ?? s.team,
      byeWeek: e.espn?.byeWeek ?? null,
      injuryStatus: e.espn?.injuryStatus ?? null,
      auctionValue: e.espn?.auctionValue ?? null,
      percentOwned: e.espn?.percentOwned ?? null,
      espnAdp: e.espn?.adp ?? null,
      adpTrendPct: e.espn?.adpTrendPct ?? null,
      matchedFromEspn: !!e.espn,
      ppr: bundles.ppr,
      standard: bundles.standard,
      projectedStatLine: toPlayerStatLine(e.sleeperProjection),
      lastSeasonStatLine: toPlayerStatLine(e.sleeperLastSeason),
    };
  });

  return { players, matchedFromEspnCount, topTierCount, unmatchedNames, coverage, sleeperMatchedCount };
}
