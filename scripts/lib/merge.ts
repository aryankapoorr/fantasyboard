import { normalizeName } from "../../lib/normalize";
import type { Player, SeedPlayer } from "../../lib/types";
import type { EspnPlayer } from "./espn";
import type { FfcPlayer } from "./ffc";

export interface MergeResult {
  players: Player[];
  matchedCount: number;
  matchedFromFfcCount: number;
  positionRankEspnCount: number;
  topTierPositionRankEspnCount: number;
  topTierCount: number;
  unmatchedNames: string[];
}

// ESPN only ships cross-analyst position-blended ranks for its own top-ranked players;
// coverage tapers off for bench/K/DST. Used as a safety-net signal scoped to the seed's
// top tier, where coverage should be ~universal, rather than the full list.
const TOP_TIER_SEED_RANK = 50;

function indexKey(name: string, position: string): string {
  return `${normalizeName(name)}|${position}`;
}

export function round1(n: number): number {
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
    positionAverageRankValue: number | null;
  }

  const merged: Intermediate[] = [];
  const unmatchedNames: string[] = [];
  let matchedCount = 0;
  let matchedFromFfcCount = 0;
  let positionRankEspnCount = 0;
  let topTierPositionRankEspnCount = 0;
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

    const positionRankSource: Player["positionRankSource"] =
      espn?.positionAverageRank != null ? "espn-analysts" : "editorial";
    if (positionRankSource === "espn-analysts") {
      positionRankEspnCount++;
      if (s.rank <= TOP_TIER_SEED_RANK) topTierPositionRankEspnCount++;
    }
    if (s.rank <= TOP_TIER_SEED_RANK) topTierCount++;

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
      // Overall cross-position rank has exactly one free, non-circular source available:
      // the curated seed file. ESPN's per-analyst blend is only meaningful within a position
      // (see positionRank below) — mixing it in here was the bug that put kickers above RBs.
      consensusRank: s.rank,
      positionRankSource,
      positionRankAnalystCount: espn?.positionRankAnalystCount ?? null,
      positionRankLow: espn?.positionRankLow ?? null,
      positionRankHigh: espn?.positionRankHigh ?? null,
      adp,
      espnAdp,
      ffcAdp,
      adpWeeklyDelta: null, // filled in by fetch-rankings.ts against the rolling weekly anchor
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
      positionAverageRankValue: espn?.positionAverageRank ?? null,
    });
  }

  const byPosition = new Map<string, Intermediate[]>();
  for (const p of merged) {
    const list = byPosition.get(p.position) ?? [];
    list.push(p);
    byPosition.set(p.position, list);
  }
  const positionRanks = new Map<string, number>();
  for (const [, list] of byPosition) {
    // Two-tier sort avoids ever comparing values from different scales directly: players with
    // a genuine ESPN cross-analyst position rank sort by that first, then the rest fall back to
    // the seed's overall order as a same-position proxy.
    const withEspn = list
      .filter((p) => p.positionAverageRankValue != null)
      .sort((a, b) => a.positionAverageRankValue! - b.positionAverageRankValue!);
    const withoutEspn = list
      .filter((p) => p.positionAverageRankValue == null)
      .sort((a, b) => a.consensusRank - b.consensusRank);
    [...withEspn, ...withoutEspn].forEach((p, i) => positionRanks.set(p.id, i + 1));
  }

  const players: Player[] = merged.map((p) => ({
    id: p.id,
    espnId: p.espnId,
    name: p.name,
    position: p.position,
    team: p.team,
    byeWeek: p.byeWeek,
    consensusRank: p.consensusRank,
    positionRank: positionRanks.get(p.id) ?? 0,
    positionRankSource: p.positionRankSource,
    positionRankAnalystCount: p.positionRankAnalystCount,
    positionRankLow: p.positionRankLow,
    positionRankHigh: p.positionRankHigh,
    adp: p.adp,
    espnAdp: p.espnAdp,
    ffcAdp: p.ffcAdp,
    adpWeeklyDelta: p.adpWeeklyDelta,
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
    positionRankEspnCount,
    topTierPositionRankEspnCount,
    topTierCount,
    unmatchedNames,
  };
}
