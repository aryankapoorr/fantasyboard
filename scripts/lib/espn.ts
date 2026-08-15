import type { Position } from "../../lib/types";

const BASE_URL = "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons";

export const POSITION_MAP: Record<number, Position> = {
  1: "QB",
  2: "RB",
  3: "WR",
  4: "TE",
  5: "K",
  16: "DST",
};

export interface EspnProTeam {
  abbrev: string;
  byeWeek: number | null;
}

export interface EspnFormatRank {
  // draftRanksByRankType[format].rank — ESPN's own cross-position overall rank for this format
  // (verified live: kickers/DST land ~230+, not scoped per-position like positionAverageRank below).
  overallRank: number | null;
  // rankings["0"]'s synthetic rankSourceId:0 entry for this rankType — scoped PER POSITION
  // (e.g. K1, DST1, TE1 all land near 1), NOT an overall cross-position rank.
  positionAverageRank: number | null;
  positionRankAnalystCount: number;
  positionRankLow: number | null;
  positionRankHigh: number | null;
}

export interface EspnPlayer {
  espnId: number;
  fullName: string;
  position: Position | null;
  team: string;
  byeWeek: number | null;
  // ESPN's own ADP isn't labeled PPR/standard and is identical regardless of requested scoring
  // segment (verified live across leaguedefaults/1,3,5,6,7,8). This is the primary ADP source
  // for both formats in scripts/lib/merge.ts (full coverage, unlike FFC's per-format data).
  adp: number | null;
  adpTrendPct: number | null;
  percentOwned: number | null;
  auctionValue: number | null;
  injuryStatus: string | null;
  ppr: EspnFormatRank;
  standard: EspnFormatRank;
}

async function fetchJson(url: string, headers?: Record<string, string>): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Request to ${url} failed: ${res.status} ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastError;
}

interface RawProTeamSchedulesResponse {
  settings?: { proTeams?: { id: number; abbrev?: string; byeWeek?: number }[] };
}

interface RawRankingEntry {
  rank: number;
  rankSourceId: number;
  rankType: string;
  averageRank?: number;
}

interface RawPlayerPoolResponse {
  players?: {
    player?: {
      id: number;
      fullName: string;
      defaultPositionId: number;
      proTeamId: number;
      injuryStatus?: string;
      ownership?: {
        averageDraftPosition?: number;
        averageDraftPositionPercentChange?: number;
        percentOwned?: number;
        auctionValueAverage?: number;
      };
      rankings?: Record<string, RawRankingEntry[]>;
      draftRanksByRankType?: Record<string, { rank: number }>;
    };
  }[];
}

// rankings["0"] mixes one synthetic self-average entry per rankType (rankSourceId 0) with one
// entry per contributing outside analyst. Filtering strictly by rankType keeps PPR and STANDARD
// counts/ranges from ever crossing — analysts overwhelmingly only submit a PPR-labeled rank, so
// STANDARD analyst coverage below is expected to be sparse; that's a true reflection of ESPN's
// data, not a bug.
function extractFormatRankInfo(entries: RawRankingEntry[], rankType: "PPR" | "STANDARD"): Omit<EspnFormatRank, "overallRank"> {
  const synthetic = entries.find((e) => e.rankSourceId === 0 && e.rankType === rankType);
  const analystEntries = entries.filter((e) => e.rankSourceId !== 0 && e.rankType === rankType);
  const analystIds = new Set(analystEntries.map((e) => e.rankSourceId));
  const ranks = analystEntries.map((e) => e.rank).filter((r) => typeof r === "number" && r > 0);
  return {
    positionAverageRank: typeof synthetic?.averageRank === "number" ? synthetic.averageRank : null,
    positionRankAnalystCount: analystIds.size,
    positionRankLow: ranks.length > 0 ? Math.min(...ranks) : null,
    positionRankHigh: ranks.length > 0 ? Math.max(...ranks) : null,
  };
}

export async function fetchProTeams(season: number): Promise<Map<number, EspnProTeam>> {
  const url = `${BASE_URL}/${season}?view=proTeamSchedules`;
  const data = (await fetchJson(url)) as RawProTeamSchedulesResponse;
  const teams = new Map<number, EspnProTeam>();
  for (const team of data.settings?.proTeams ?? []) {
    teams.set(team.id, {
      abbrev: (team.abbrev ?? "FA").toUpperCase(),
      byeWeek: team.byeWeek ?? null,
    });
  }
  return teams;
}

export async function fetchPlayerPool(season: number, limit = 400): Promise<EspnPlayer[]> {
  const url = `${BASE_URL}/${season}/segments/0/leaguedefaults/3?view=kona_player_info`;
  const filter = {
    players: {
      limit,
      sortDraftRanks: { sortPriority: 1, sortAsc: true, value: "PPR" },
    },
  };
  const data = (await fetchJson(url, { "X-Fantasy-Filter": JSON.stringify(filter) })) as RawPlayerPoolResponse;
  const proTeams = await fetchProTeams(season);

  const players: EspnPlayer[] = [];
  for (const entry of data.players ?? []) {
    const p = entry.player;
    if (!p) continue;
    const team = proTeams.get(p.proTeamId);
    const ownership = p.ownership ?? {};
    const rankingEntries = p.rankings?.["0"] ?? [];
    const pprInfo = extractFormatRankInfo(rankingEntries, "PPR");
    const stdInfo = extractFormatRankInfo(rankingEntries, "STANDARD");
    players.push({
      espnId: p.id,
      fullName: p.fullName,
      position: POSITION_MAP[p.defaultPositionId] ?? null,
      team: team?.abbrev ?? "FA",
      byeWeek: team?.byeWeek ?? null,
      adp: typeof ownership.averageDraftPosition === "number" ? ownership.averageDraftPosition : null,
      adpTrendPct:
        typeof ownership.averageDraftPositionPercentChange === "number"
          ? ownership.averageDraftPositionPercentChange
          : null,
      percentOwned: typeof ownership.percentOwned === "number" ? ownership.percentOwned : null,
      auctionValue: typeof ownership.auctionValueAverage === "number" ? ownership.auctionValueAverage : null,
      injuryStatus: p.injuryStatus ?? null,
      ppr: { overallRank: p.draftRanksByRankType?.PPR?.rank ?? null, ...pprInfo },
      standard: { overallRank: p.draftRanksByRankType?.STANDARD?.rank ?? null, ...stdInfo },
    });
  }
  return players;
}
