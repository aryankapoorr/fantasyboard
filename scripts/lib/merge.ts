import { normalizeName } from "../../lib/normalize";
import type { Player, Position, RankingBundle, RankingFormat, SeedPlayer, StatLine } from "../../lib/types";
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
  matchedToSeedCount: number;
  topTierCount: number;
  unmatchedSeedNames: string[];
  coverage: Record<RankingFormat, FormatCoverage>;
  sleeperMatchedCount: number;
}

// The player universe is the full live ESPN pool (every fantasy-rosterable player ESPN tracks,
// ~1000+ across all 6 positions), not the static editorial seed list — the seed list is
// still consulted per player as a rank fallback/tiebreaker (see fallbackRank below), but no
// longer gates who appears on the board at all. "Top tier" for the ESPN-response safety-net
// check in fetch-rankings.ts is ESPN's own pool order (its PPR-sorted fetch order), not the
// seed's rank column, since the seed no longer defines the universe.
const TOP_TIER_ESPN_INDEX = 50;

const FORMATS: RankingFormat[] = ["ppr", "standard"];

function indexKey(name: string, position: string): string {
  return `${normalizeName(name)}|${position}`;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

interface EspnEntry {
  espn: EspnPlayer;
  position: Position; // narrowed non-null copy of espn.position, filtered before entries are built
  espnIndex: number;
  seed: SeedPlayer | undefined;
  ffc: Record<RankingFormat, FfcPlayer | undefined>;
  sleeperProjection: SleeperEntry | undefined;
  sleeperLastSeason: SleeperEntry | undefined;
}

function toPlayerStatLine(entry: SleeperEntry | undefined): StatLine | null {
  return entry?.statLine ?? null;
}

// Two-tier sort avoids ever comparing values from different scales directly: entries with a
// genuine live value for this format sort by that first, then the rest fall back to a secondary
// value (editorial seed rank, or ultimately ESPN's own fetch-order index — see fallbackRank).
function twoTierRank<T>(
  entries: T[],
  liveValue: (t: T) => number | null,
  fallbackValue: (t: T) => number
): Map<T, { rank: number; source: "espn" | "editorial" }> {
  const withLive = entries.filter((e) => liveValue(e) !== null).sort((a, b) => liveValue(a)! - liveValue(b)!);
  const withoutLive = entries
    .filter((e) => liveValue(e) === null)
    .sort((a, b) => fallbackValue(a) - fallbackValue(b));
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
  // aliases map an editorial seed name to its ESPN-canonical name; matching now flows the other
  // way (ESPN's name -> seed/FFC/Sleeper), so a reverse lookup resolves the same aliasing
  // symmetrically without needing a second alias file.
  const reverseAliases = new Map(Object.entries(aliases).map(([seedName, canonical]) => [canonical, seedName]));
  function aliasedKeys(name: string, position: string): string[] {
    const keys = [indexKey(name, position)];
    const reverse = reverseAliases.get(name);
    if (reverse) keys.push(indexKey(reverse, position));
    return keys;
  }

  const seedByNameAndPosition = new Map<string, SeedPlayer>();
  const seedByTeam = new Map<string, SeedPlayer>();
  for (const s of seed) {
    const resolvedName = aliases[s.name] ?? s.name;
    if (s.position === "DST") {
      seedByTeam.set(s.team, s);
    } else {
      seedByNameAndPosition.set(indexKey(resolvedName, s.position), s);
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

  function lookupSeed(ep: EspnPlayer): SeedPlayer | undefined {
    if (ep.position === "DST") return seedByTeam.get(ep.team);
    for (const key of aliasedKeys(ep.fullName, ep.position!)) {
      const hit = seedByNameAndPosition.get(key);
      if (hit) return hit;
    }
    return undefined;
  }

  function lookupFfc(ep: EspnPlayer, format: RankingFormat): FfcPlayer | undefined {
    if (ep.position === "DST") return ffcIndex[format].dstByTeam.get(ep.team);
    for (const key of aliasedKeys(ep.fullName, ep.position!)) {
      const hit = ffcIndex[format].byNameAndPosition.get(key);
      if (hit) return hit;
    }
    return undefined;
  }

  function lookupSleeper(index: SleeperData["projections"], ep: EspnPlayer): SleeperEntry | undefined {
    if (ep.position === "DST") return index.dstByTeam.get(ep.team);
    for (const key of aliasedKeys(ep.fullName, ep.position!)) {
      const hit = index.byNameAndPosition.get(key);
      if (hit) return hit;
    }
    return undefined;
  }

  const entries: EspnEntry[] = [];
  const matchedSeedEntries = new Set<SeedPlayer>();
  let sleeperMatchedCount = 0;

  espnPlayers
    .filter((ep): ep is EspnPlayer & { position: NonNullable<EspnPlayer["position"]> } => ep.position !== null)
    .forEach((ep, espnIndex) => {
      const seedMatch = lookupSeed(ep);
      if (seedMatch) matchedSeedEntries.add(seedMatch);

      const ffc: Record<RankingFormat, FfcPlayer | undefined> = {
        ppr: lookupFfc(ep, "ppr"),
        standard: lookupFfc(ep, "standard"),
      };

      const sleeperProjection = lookupSleeper(sleeper.projections, ep);
      const sleeperLastSeason = lookupSleeper(sleeper.lastSeason, ep);
      if (sleeperProjection || sleeperLastSeason) sleeperMatchedCount++;

      entries.push({ espn: ep, position: ep.position, espnIndex, seed: seedMatch, ffc, sleeperProjection, sleeperLastSeason });
    });

  const topTierCount = entries.filter((e) => e.espnIndex < TOP_TIER_ESPN_INDEX).length;

  // Fallback rank when a player has no live ESPN rank for this format: prefer the editorial
  // seed's hand-curated rank when available, otherwise fall back to this player's own position
  // in ESPN's PPR-sorted fetch order — always present, so every player gets a total, dense,
  // gap-free rank even outside both the seed list and ESPN's own confident-rank coverage.
  const fallbackRank = (e: EspnEntry) => e.seed?.rank ?? 1000 + e.espnIndex;

  // consensusRank: overall cross-position rank, per format, from ESPN's own draftRanksByRankType.
  const consensusRankByFormat: Record<RankingFormat, Map<EspnEntry, { rank: number; source: "espn" | "editorial" }>> =
    {
      ppr: twoTierRank(entries, (e) => e.espn.ppr.overallRank, fallbackRank),
      standard: twoTierRank(entries, (e) => e.espn.standard.overallRank, fallbackRank),
    };

  // positionRank: within-position rank, per format, from ESPN's per-position analyst blend.
  const byPosition = new Map<string, EspnEntry[]>();
  for (const e of entries) {
    const list = byPosition.get(e.position) ?? [];
    list.push(e);
    byPosition.set(e.position, list);
  }
  const positionRankByFormat: Record<RankingFormat, Map<EspnEntry, { rank: number; source: "espn" | "editorial" }>> = {
    ppr: new Map(),
    standard: new Map(),
  };
  for (const [, list] of byPosition) {
    for (const format of FORMATS) {
      const ranked = twoTierRank(
        list,
        (e) => e.espn[format].positionAverageRank,
        fallbackRank
      );
      for (const [entry, value] of ranked) positionRankByFormat[format].set(entry, value);
    }
  }

  const coverage: Record<RankingFormat, FormatCoverage> = {
    ppr: { consensusEspnCount: 0, topTierConsensusEspnCount: 0, positionRankEspnCount: 0, topTierPositionRankEspnCount: 0, ffcMatchedCount: 0 },
    standard: { consensusEspnCount: 0, topTierConsensusEspnCount: 0, positionRankEspnCount: 0, topTierPositionRankEspnCount: 0, ffcMatchedCount: 0 },
  };

  const players: Player[] = entries.map((e) => {
    const isTopTier = e.espnIndex < TOP_TIER_ESPN_INDEX;

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
        positionRankAnalystCount: e.espn[format].positionRankAnalystCount,
        positionRankLow: e.espn[format].positionRankLow,
        positionRankHigh: e.espn[format].positionRankHigh,
        // ESPN's ADP has full coverage and is the primary source; FFC only fills in the rare
        // case ESPN has no value.
        adp: e.espn.adp ?? ffcPlayer?.adp ?? null,
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
      id: String(e.espn.espnId),
      espnId: e.espn.espnId,
      name: e.espn.fullName,
      position: e.position,
      team: e.espn.team,
      byeWeek: e.espn.byeWeek,
      injuryStatus: e.espn.injuryStatus,
      auctionValue: e.espn.auctionValue,
      percentOwned: e.espn.percentOwned,
      espnAdp: e.espn.adp,
      adpTrendPct: e.espn.adpTrendPct,
      ppr: bundles.ppr,
      standard: bundles.standard,
      projectedStatLine: toPlayerStatLine(e.sleeperProjection),
      lastSeasonStatLine: toPlayerStatLine(e.sleeperLastSeason),
    };
  });

  const unmatchedSeedNames = seed.filter((s) => !matchedSeedEntries.has(s)).map((s) => s.name);

  return {
    players,
    matchedToSeedCount: matchedSeedEntries.size,
    topTierCount,
    unmatchedSeedNames,
    coverage,
    sleeperMatchedCount,
  };
}
