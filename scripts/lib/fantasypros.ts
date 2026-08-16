import type { Position, RankingFormat } from "../../lib/types";

const URL_BY_FORMAT: Record<RankingFormat, string> = {
  standard: "https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php",
  ppr: "https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php",
};

const VALID_POSITIONS = new Set<Position>(["QB", "RB", "WR", "TE", "K", "DST"]);

export interface FantasyProsPlayer {
  name: string;
  position: Position | null;
  team: string;
  rank: number;
}

interface RawEcrPlayer {
  player_name: string;
  player_team_id: string;
  player_position_id: string;
  rank_ecr: number;
}

// The rankings page has no JSON API of its own (robots.txt disallows /api/, /json/, /ajax/) —
// the data is embedded directly in the page's HTML as `var ecrData = {...};` for its own
// front-end widget, which robots.txt does allow us to fetch.
const ECR_DATA_RE = /var ecrData = (\{[\s\S]*?\});/;

async function fetchHtml(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (!res.ok) {
        throw new Error(`Request to ${url} failed: ${res.status} ${res.statusText}`);
      }
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt === 0) await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw lastError;
}

export async function fetchFantasyProsRankings(format: RankingFormat): Promise<FantasyProsPlayer[]> {
  const html = await fetchHtml(URL_BY_FORMAT[format]);
  const match = html.match(ECR_DATA_RE);
  if (!match) {
    throw new Error(`Could not find ecrData on FantasyPros ${format} rankings page — page layout may have changed.`);
  }
  const data = JSON.parse(match[1]) as { players?: RawEcrPlayer[] };
  return (data.players ?? []).map((p) => ({
    name: p.player_name,
    position: VALID_POSITIONS.has(p.player_position_id as Position) ? (p.player_position_id as Position) : null,
    team: p.player_team_id.toUpperCase(),
    rank: p.rank_ecr,
  }));
}
