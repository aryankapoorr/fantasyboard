import type { Position } from "../../lib/types";

const BASE_URL = "https://fantasyfootballcalculator.com/api/v1/adp/ppr";

const POSITION_MAP: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  PK: "K",
  DEF: "DST",
};

export interface FfcPlayer {
  name: string;
  position: Position | null;
  team: string;
  adp: number;
  high: number;
  low: number;
  stdev: number;
  timesDrafted: number;
}

interface RawFfcResponse {
  players?: {
    name: string;
    position: string;
    team: string;
    adp: number;
    times_drafted: number;
    high: number;
    low: number;
    stdev: number;
  }[];
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

export async function fetchFfcAdp(season: number, teams = 12): Promise<FfcPlayer[]> {
  const url = `${BASE_URL}?teams=${teams}&year=${season}`;
  const data = (await fetchJson(url)) as RawFfcResponse;
  const players: FfcPlayer[] = [];
  for (const p of data.players ?? []) {
    players.push({
      name: p.name,
      position: POSITION_MAP[p.position] ?? null,
      team: p.team.toUpperCase(),
      adp: p.adp,
      high: p.high,
      low: p.low,
      stdev: p.stdev,
      timesDrafted: p.times_drafted,
    });
  }
  return players;
}
