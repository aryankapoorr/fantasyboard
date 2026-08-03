import type { Position, StatLine } from "./types";

const LABELS: Record<keyof StatLine, string> = {
  gamesPlayed: "Games",
  passYards: "Pass Yds",
  passTd: "Pass TD",
  passInt: "Int",
  rushAttempts: "Rush Att",
  rushYards: "Rush Yds",
  rushTd: "Rush TD",
  receptions: "Rec",
  recYards: "Rec Yds",
  recTd: "Rec TD",
  fumblesLost: "Fum Lost",
  fgMade: "FG Made",
  fgAttempted: "FG Att",
  xpMade: "XP Made",
  sacks: "Sacks",
  defInterceptions: "Int",
  fumbleRecoveries: "Fum Rec",
  defTd: "Def TD",
};

const POSITION_STAT_FIELDS: Record<Position, (keyof StatLine)[]> = {
  QB: ["gamesPlayed", "passYards", "passTd", "passInt", "rushAttempts", "rushYards", "rushTd", "fumblesLost"],
  RB: ["gamesPlayed", "rushAttempts", "rushYards", "rushTd", "receptions", "recYards", "recTd", "fumblesLost"],
  WR: ["gamesPlayed", "receptions", "recYards", "recTd", "rushAttempts", "rushYards", "rushTd", "fumblesLost"],
  TE: ["gamesPlayed", "receptions", "recYards", "recTd", "fumblesLost"],
  K: ["gamesPlayed", "fgMade", "fgAttempted", "xpMade"],
  DST: ["gamesPlayed", "sacks", "defInterceptions", "fumbleRecoveries", "defTd"],
};

export function formatStatLine(position: Position, line: StatLine | null): { label: string; value: number }[] {
  if (!line) return [];
  return POSITION_STAT_FIELDS[position]
    .filter((key) => line[key] !== null)
    .map((key) => ({ label: LABELS[key], value: line[key] as number }));
}
