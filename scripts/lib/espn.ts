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

export interface EspnPlayer {
  espnId: number;
  fullName: string;
  position: Position | null;
  team: string;
  byeWeek: number | null;
  adp: number | null;
  adpTrendPct: number | null;
  percentOwned: number | null;
  auctionValue: number | null;
  averageRank: number | null;
  injuryStatus: string | null;
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
    };
  }[];
}

function extractAverageRank(rankings: Record<string, RawRankingEntry[]> | undefined): number | null {
  const entries = rankings?.["0"];
  if (!entries) return null;
  const consensus = entries.find((e) => e.rankSourceId === 0 && e.rankType === "STANDARD");
  return typeof consensus?.averageRank === "number" ? consensus.averageRank : null;
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
      sortDraftRanks: { sortPriority: 1, sortAsc: true, value: "STANDARD" },
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
      averageRank: extractAverageRank(p.rankings),
      injuryStatus: p.injuryStatus ?? null,
    });
  }
  return players;
}
