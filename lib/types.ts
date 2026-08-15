export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export type RankingFormat = "ppr" | "standard";

// All numbers in here come from a single scoring format's data — never blended across formats.
// See scripts/lib/merge.ts for how each field is sourced per format.
export interface RankingBundle {
  consensusRank: number; // dense 1..N overall cross-position rank within the tracked universe
  consensusSource: "espn" | "editorial"; // espn = ESPN's own cross-position rank for this format; editorial = seed fallback
  positionRank: number; // 1-based within position
  positionRankSource: "espn-analysts" | "editorial";
  positionRankAnalystCount: number | null; // distinct outside analysts who submitted a rank in THIS format
  positionRankLow: number | null; // lowest (best) individual analyst rank, this format only
  positionRankHigh: number | null; // highest (worst) individual analyst rank, this format only
  adp: number | null; // ESPN aggregate ADP (format-unspecified, same value in both bundles); falls back to FFC's per-format ADP only if ESPN has no value for this player
  adpWeeklyDelta: number | null; // (adp ~7 days ago) - (adp now); positive = rising (ADP dropped)
  ffcAdp: number | null; // FantasyFootballCalculator ADP for this format only — kept as a secondary reference now that `adp` above is ESPN-primary
  adpHigh: number | null;
  adpLow: number | null;
  adpStdev: number | null;
  adpSampleSize: number | null; // FFC times_drafted
  projectedPoints: number | null; // Sleeper/RotoWire full-season projection, this format only
  lastSeasonPoints: number | null; // Sleeper actual full-season total from the prior season, this format only
}

// Position-agnostic per-game-category totals (season projection or prior-season actual).
// Sourced from Sleeper's undocumented bulk projections/stats endpoints (see scripts/lib/sleeper.ts).
// Every field is nullable and populated only when Sleeper reports it for that player/position —
// most fields stay null for irrelevant positions (e.g. a WR's fgMade is always null).
export interface StatLine {
  gamesPlayed: number | null;
  passYards: number | null;
  passTd: number | null;
  passInt: number | null;
  rushAttempts: number | null;
  rushYards: number | null;
  rushTd: number | null;
  receptions: number | null;
  recYards: number | null;
  recTd: number | null;
  fumblesLost: number | null;
  fgMade: number | null;
  fgAttempted: number | null;
  xpMade: number | null;
  sacks: number | null;
  defInterceptions: number | null;
  fumbleRecoveries: number | null;
  defTd: number | null;
}

export interface Player {
  id: string; // espn id if matched, else `slug:<name>-<team>`
  espnId: number | null;
  name: string;
  position: Position;
  team: string; // uppercase abbrev, "FA" if unrostered
  byeWeek: number | null;
  injuryStatus: string | null; // from ESPN, e.g. "QUESTIONABLE"
  auctionValue: number | null;
  percentOwned: number | null;
  // ESPN's own aggregate ADP (ownership.averageDraftPosition) isn't labeled PPR or standard by
  // ESPN and is identical regardless of requested scoring segment. It's the primary source for
  // both formats' `adp` above (full coverage, vs. FFC's ~65-70%) — kept here too as a
  // format-agnostic reference/tooltip stat.
  espnAdp: number | null;
  adpTrendPct: number | null; // from ESPN week-over-week ADP change (also format-unspecified)
  matchedFromEspn: boolean;
  ppr: RankingBundle;
  standard: RankingBundle;
  // Format-agnostic category stats — same underlying game-log numbers regardless of scoring format.
  projectedStatLine: StatLine | null;
  lastSeasonStatLine: StatLine | null;
}

export interface PlayersFile {
  generatedAt: string;
  season: number;
  players: Player[];
}

export type DraftStatus = "available" | "drafted_by_me" | "drafted_by_other";

export interface DraftPickState {
  status: DraftStatus;
  pickNumber?: number;
  draftedAt?: string;
}

export interface BoardState {
  customOrder: string[];
  draftPicks: Record<string, DraftPickState>;
  nextPickNumber: number;
  // Chosen once when the board is created; drives which format's rankings/ADP it shows.
  format: RankingFormat;
  favorites: string[];
  notes: Record<string, string>;
}

export interface SeedPlayer {
  rank: number;
  name: string;
  position: Position;
  team: string;
}

export interface FirestoreBoardDoc extends BoardState {
  name: string;
  season: number;
  createdAt: unknown; // Timestamp | FieldValue
  updatedAt: unknown; // Timestamp | FieldValue
}
