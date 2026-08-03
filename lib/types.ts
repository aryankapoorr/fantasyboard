export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export interface Player {
  id: string; // espn id if matched, else `slug:<name>-<team>`
  espnId: number | null;
  name: string;
  position: Position;
  team: string; // uppercase abbrev, "FA" if unrostered
  byeWeek: number | null;
  consensusRank: number; // dense 1..N rank, from ESPN's cross-analyst averageRank, falling back to seed file
  consensusSource: "espn-average" | "seed-fallback";
  positionRank: number; // derived post-merge, 1-based within position
  adp: number | null; // blended average of espnAdp/ffcAdp (or whichever is available)
  espnAdp: number | null;
  ffcAdp: number | null;
  adpDelta: number | null; // adp - consensusRank
  adpHigh: number | null; // from FantasyFootballCalculator
  adpLow: number | null;
  adpStdev: number | null;
  adpSampleSize: number | null; // FFC times_drafted
  adpTrendPct: number | null; // from ESPN week-over-week ADP change
  injuryStatus: string | null; // from ESPN, e.g. "QUESTIONABLE"
  auctionValue: number | null;
  percentOwned: number | null;
  matchedFromEspn: boolean;
  matchedFromFfc: boolean;
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
