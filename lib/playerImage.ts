import type { Player } from "./types";

// ESPN's public CDN, no auth required — verified live for the current season pool.
// Individual players are keyed by ESPN's own player id; team defenses have no individual
// headshot on ESPN, so a team logo is used instead.
export function playerImageUrl(player: Pick<Player, "espnId" | "team" | "position">): string | null {
  if (player.position === "DST") {
    return player.team && player.team !== "FA"
      ? `https://a.espncdn.com/i/teamlogos/nfl/500/${player.team.toLowerCase()}.png`
      : null;
  }
  return player.espnId !== null ? `https://a.espncdn.com/i/headshots/nfl/players/full/${player.espnId}.png` : null;
}
