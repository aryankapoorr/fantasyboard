export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export interface Player {
  id: string; // espn id if matched, else `slug:<name>-<team>`
  espnId: number | null;
  name: string;
  position: Position;
  team: string; // uppercase abbrev, "FA" if unrostered
  byeWeek: number | null;
  consensusRank: number; // from seed file, 1-based overall
  positionRank: number; // derived post-merge, 1-based within position
  adp: number | null; // from ESPN
  adpDelta: number | null; // adp - consensusRank
  auctionValue: number | null;
  percentOwned: number | null;
  matchedFromEspn: boolean;
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
