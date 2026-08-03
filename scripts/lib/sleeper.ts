import { normalizeName } from "../../lib/normalize";
import type { Position, StatLine } from "../../lib/types";

// Undocumented but currently live Sleeper endpoints (no API key). Officially documented Sleeper
// API has no stats/projections — these were verified by direct inspection. Treated as a
// supplementary, nullable enrichment: a match miss or a shape change here should never block
// the build (see scripts/fetch-rankings.ts, which only hard-fails on core ESPN coverage).
const BASE_URL = "https://api.sleeper.app";

const POSITION_MAP: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DST",
};

const SLEEPER_POSITIONS = Object.keys(POSITION_MAP);

interface RawSleeperStats {
  gp?: number;
  pass_yd?: number;
  pass_td?: number;
  pass_int?: number;
  rush_att?: number;
  rush_yd?: number;
  rush_td?: number;
  rec?: number;
  rec_yd?: number;
  rec_td?: number;
  fum_lost?: number;
  pts_ppr?: number;
  pts_std?: number;
  [key: string]: number | undefined;
}

interface RawSleeperEntry {
  player_id: string;
  team: string | null;
  player: {
    first_name: string;
    last_name: string;
    position: string | null;
    team: string | null;
    fantasy_positions?: string[];
  } | null;
  stats: RawSleeperStats | null;
}

export interface SleeperEntry {
  name: string;
  position: Position;
  team: string | null;
  pointsPpr: number | null;
  pointsStd: number | null;
  statLine: StatLine;
}

export interface SleeperIndex {
  byNameAndPosition: Map<string, SleeperEntry>;
  dstByTeam: Map<string, SleeperEntry>;
}

export interface SleeperData {
  projections: SleeperIndex;
  lastSeason: SleeperIndex;
}

function indexKey(name: string, position: string): string {
  return `${normalizeName(name)}|${position}`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// Sums whichever of the given (bucketed) keys are present; returns null only if NONE of them
// appear at all, so an irrelevant position (e.g. a WR's kicking fields) stays null rather than 0.
function sumFields(stats: RawSleeperStats, keys: string[]): number | null {
  let found = false;
  let total = 0;
  for (const key of keys) {
    const value = stats[key];
    if (typeof value === "number") {
      found = true;
      total += value;
    }
  }
  return found ? round1(total) : null;
}

function toStatLine(stats: RawSleeperStats): StatLine {
  return {
    gamesPlayed: stats.gp ?? null,
    passYards: stats.pass_yd ?? null,
    passTd: stats.pass_td ?? null,
    passInt: stats.pass_int ?? null,
    rushAttempts: stats.rush_att ?? null,
    rushYards: stats.rush_yd ?? null,
    rushTd: stats.rush_td ?? null,
    receptions: stats.rec ?? null,
    recYards: stats.rec_yd ?? null,
    recTd: stats.rec_td ?? null,
    fumblesLost: stats.fum_lost ?? null,
    // Sleeper splits kicking distance into buckets rather than a flat made/attempted total.
    fgMade: sumFields(stats, ["fgm_0_39", "fgm_40_49", "fgm_50p"]),
    fgAttempted: sumFields(stats, [
      "fgm_0_39",
      "fgm_40_49",
      "fgm_50p",
      "fgmiss_0_39",
      "fgmiss_40_49",
      "fgmiss_50p",
    ]),
    xpMade: stats.xpm ?? null,
    sacks: stats.sack ?? null,
    defInterceptions: stats.int ?? null,
    fumbleRecoveries: stats.fum_rec ?? null,
    // Sleeper reports individual defensive/special-teams TD types as separate fields; sum
    // whichever appear rather than assuming any single one is always present.
    defTd: sumFields(stats, ["pass_int_td", "fum_rec_td", "kick_ret_td", "punt_ret_td", "blk_kick_td"]),
  };
}

async function fetchJson(url: string): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url);
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

async function fetchBulk(kind: "projections" | "stats", season: number): Promise<RawSleeperEntry[]> {
  const all: RawSleeperEntry[] = [];
  for (const pos of SLEEPER_POSITIONS) {
    const url = `${BASE_URL}/${kind}/nfl/${season}?season_type=regular&position[]=${pos}`;
    const data = (await fetchJson(url)) as RawSleeperEntry[];
    all.push(...data);
  }
  return all;
}

function buildIndex(raw: RawSleeperEntry[]): SleeperIndex {
  const byNameAndPosition = new Map<string, SleeperEntry>();
  const dstByTeam = new Map<string, SleeperEntry>();

  for (const r of raw) {
    if (!r.player || !r.stats) continue;
    const rawPosition = r.player.position ?? r.player.fantasy_positions?.[0] ?? null;
    const position = rawPosition ? POSITION_MAP[rawPosition] : undefined;
    if (!position) continue;

    const entry: SleeperEntry = {
      name: `${r.player.first_name} ${r.player.last_name}`.trim(),
      position,
      team: r.team ?? r.player.team ?? null,
      pointsPpr: r.stats.pts_ppr ?? null,
      pointsStd: r.stats.pts_std ?? null,
      statLine: toStatLine(r.stats),
    };

    if (position === "DST") {
      if (entry.team) dstByTeam.set(entry.team, entry);
    } else {
      byNameAndPosition.set(indexKey(entry.name, position), entry);
    }
  }

  return { byNameAndPosition, dstByTeam };
}

// `season` is the upcoming/current draft season (full-season projections); the prior season's
// completed actuals are fetched at `season - 1`.
export async function fetchSleeperData(season: number): Promise<SleeperData> {
  const [projectionsRaw, lastSeasonRaw] = await Promise.all([
    fetchBulk("projections", season),
    fetchBulk("stats", season - 1),
  ]);
  return { projections: buildIndex(projectionsRaw), lastSeason: buildIndex(lastSeasonRaw) };
}
