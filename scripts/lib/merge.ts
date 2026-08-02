import { normalizeName } from "../../lib/normalize";
import type { Player, SeedPlayer } from "../../lib/types";
import type { EspnPlayer } from "./espn";

export interface MergeResult {
  players: Player[];
  matchedCount: number;
  unmatchedNames: string[];
}

function indexKey(name: string, position: string): string {
  return `${normalizeName(name)}|${position}`;
}

export function mergePlayers(
  seed: SeedPlayer[],
  espnPlayers: EspnPlayer[],
  aliases: Record<string, string>
): MergeResult {
  const byNameAndPosition = new Map<string, EspnPlayer>();
  const dstByTeam = new Map<string, EspnPlayer>();

  for (const ep of espnPlayers) {
    if (!ep.position) continue;
    if (ep.position === "DST") {
      dstByTeam.set(ep.team, ep);
    } else {
      byNameAndPosition.set(indexKey(ep.fullName, ep.position), ep);
    }
  }

  const merged: Omit<Player, "positionRank">[] = [];
  const unmatchedNames: string[] = [];
  let matchedCount = 0;

  for (const s of seed) {
    let espn: EspnPlayer | undefined;
    if (s.position === "DST") {
      espn = dstByTeam.get(s.team);
    } else {
      const resolvedName = aliases[s.name] ?? s.name;
      espn = byNameAndPosition.get(indexKey(resolvedName, s.position));
    }

    if (espn) {
      matchedCount++;
      const adp = espn.adp;
      merged.push({
        id: String(espn.espnId),
        espnId: espn.espnId,
        name: s.name,
        position: s.position,
        team: espn.team,
        byeWeek: espn.byeWeek,
        consensusRank: s.rank,
        adp,
        adpDelta: adp != null ? adp - s.rank : null,
        auctionValue: espn.auctionValue,
        percentOwned: espn.percentOwned,
        matchedFromEspn: true,
      });
    } else {
      unmatchedNames.push(s.name);
      merged.push({
        id: `slug:${normalizeName(s.name)}-${s.team.toLowerCase()}`,
        espnId: null,
        name: s.name,
        position: s.position,
        team: s.team,
        byeWeek: null,
        consensusRank: s.rank,
        adp: null,
        adpDelta: null,
        auctionValue: null,
        percentOwned: null,
        matchedFromEspn: false,
      });
    }
  }

  const byPosition = new Map<string, Omit<Player, "positionRank">[]>();
  for (const p of merged) {
    const list = byPosition.get(p.position) ?? [];
    list.push(p);
    byPosition.set(p.position, list);
  }
  const positionRanks = new Map<string, number>();
  for (const [, list] of byPosition) {
    list
      .slice()
      .sort((a, b) => a.consensusRank - b.consensusRank)
      .forEach((p, i) => positionRanks.set(p.id, i + 1));
  }

  const players: Player[] = merged.map((p) => ({
    ...p,
    positionRank: positionRanks.get(p.id) ?? 0,
  }));

  return { players, matchedCount, unmatchedNames };
}
