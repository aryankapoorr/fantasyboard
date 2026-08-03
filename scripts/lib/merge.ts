import { normalizeName } from "../../lib/normalize";
import type { Player, SeedPlayer } from "../../lib/types";
import type { EspnPlayer } from "./espn";
import type { FfcPlayer } from "./ffc";

export interface MergeResult {
  players: Player[];
  matchedCount: number;
  matchedFromFfcCount: number;
  espnAverageRankCount: number;
  topTierEspnAverageRankCount: number;
  topTierCount: number;
  unmatchedNames: string[];
}

// ESPN only ships cross-analyst averageRank data for its own top-ranked players;
// coverage tapers off for bench/K/DST. Used as a safety-net signal scoped to the
// seed's top tier, where coverage should be ~universal, rather than the full list.
const TOP_TIER_SEED_RANK = 50;

function indexKey(name: string, position: string): string {
  return `${normalizeName(name)}|${position}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function mergePlayers(
  seed: SeedPlayer[],
  espnPlayers: EspnPlayer[],
  ffcPlayers: FfcPlayer[],
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

  const ffcByNameAndPosition = new Map<string, FfcPlayer>();
  const ffcDstByTeam = new Map<string, FfcPlayer>();
  for (const fp of ffcPlayers) {
    if (!fp.position) continue;
    if (fp.position === "DST") {
      ffcDstByTeam.set(fp.team, fp);
    } else {
      ffcByNameAndPosition.set(indexKey(fp.name, fp.position), fp);
    }
  }

  interface Intermediate extends Omit<Player, "positionRank"> {
    sourceRank: number;
  }

  const merged: Intermediate[] = [];
  const unmatchedNames: string[] = [];
  let matchedCount = 0;
  let matchedFromFfcCount = 0;
  let espnAverageRankCount = 0;
  let topTierEspnAverageRankCount = 0;
  let topTierCount = 0;

  for (const s of seed) {
    const resolvedName = aliases[s.name] ?? s.name;

    let espn: EspnPlayer | undefined;
    let ffc: FfcPlayer | undefined;
    if (s.position === "DST") {
      espn = dstByTeam.get(s.team);
      ffc = ffcDstByTeam.get(s.team);
    } else {
      espn = byNameAndPosition.get(indexKey(resolvedName, s.position));
      ffc = ffcByNameAndPosition.get(indexKey(resolvedName, s.position));
    }

    const espnAdp = espn?.adp ?? null;
    const ffcAdp = ffc?.adp ?? null;
    const adp = espnAdp != null && ffcAdp != null ? round1((espnAdp + ffcAdp) / 2) : (espnAdp ?? ffcAdp ?? null);

    const consensusSource: Player["consensusSource"] = espn?.averageRank != null ? "espn-average" : "seed-fallback";
    const sourceRank = espn?.averageRank ?? s.rank;
    if (consensusSource === "espn-average") espnAverageRankCount++;
    if (s.rank <= TOP_TIER_SEED_RANK) {
      topTierCount++;
      if (consensusSource === "espn-average") topTierEspnAverageRankCount++;
    }

    if (espn) matchedCount++;
    else unmatchedNames.push(s.name);
    if (ffc) matchedFromFfcCount++;

    merged.push({
      id: espn ? String(espn.espnId) : `slug:${normalizeName(s.name)}-${s.team.toLowerCase()}`,
      espnId: espn?.espnId ?? null,
      name: s.name,
      position: s.position,
      team: espn?.team ?? s.team,
      byeWeek: espn?.byeWeek ?? null,
      consensusRank: 0, // assigned below once sourceRank is finalized for all players
      consensusSource,
      adp,
      espnAdp,
      ffcAdp,
      adpDelta: null, // assigned below alongside consensusRank
      adpHigh: ffc?.high ?? null,
      adpLow: ffc?.low ?? null,
      adpStdev: ffc?.stdev ?? null,
      adpSampleSize: ffc?.timesDrafted ?? null,
      adpTrendPct: espn?.adpTrendPct ?? null,
      injuryStatus: espn?.injuryStatus ?? null,
      auctionValue: espn?.auctionValue ?? null,
      percentOwned: espn?.percentOwned ?? null,
      matchedFromEspn: !!espn,
      matchedFromFfc: !!ffc,
      sourceRank,
    });
  }

  merged.sort((a, b) => a.sourceRank - b.sourceRank);
  merged.forEach((p, i) => {
    p.consensusRank = i + 1;
    p.adpDelta = p.adp != null ? p.adp - p.consensusRank : null;
  });

  const byPosition = new Map<string, Intermediate[]>();
  for (const p of merged) {
    const list = byPosition.get(p.position) ?? [];
    list.push(p);
    byPosition.set(p.position, list);
  }
  const positionRanks = new Map<string, number>();
  for (const [, list] of byPosition) {
    list
      .slice()
      .sort((a, b) => a.consensusRank - b.consensusRank)
      .forEach((p, i) => positionRanks.set(p.id, i + 1));
  }

  const players: Player[] = merged.map((p) => ({
    id: p.id,
    espnId: p.espnId,
    name: p.name,
    position: p.position,
    team: p.team,
    byeWeek: p.byeWeek,
    consensusRank: p.consensusRank,
    consensusSource: p.consensusSource,
    positionRank: positionRanks.get(p.id) ?? 0,
    adp: p.adp,
    espnAdp: p.espnAdp,
    ffcAdp: p.ffcAdp,
    adpDelta: p.adpDelta,
    adpHigh: p.adpHigh,
    adpLow: p.adpLow,
    adpStdev: p.adpStdev,
    adpSampleSize: p.adpSampleSize,
    adpTrendPct: p.adpTrendPct,
    injuryStatus: p.injuryStatus,
    auctionValue: p.auctionValue,
    percentOwned: p.percentOwned,
    matchedFromEspn: p.matchedFromEspn,
    matchedFromFfc: p.matchedFromFfc,
  }));

  return {
    players,
    matchedCount,
    matchedFromFfcCount,
    espnAverageRankCount,
    topTierEspnAverageRankCount,
    topTierCount,
    unmatchedNames,
  };
}
