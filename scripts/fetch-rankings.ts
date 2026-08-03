import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { fetchPlayerPool } from "./lib/espn";
import { fetchFfcAdp } from "./lib/ffc";
import { mergePlayers } from "./lib/merge";
import type { PlayersFile, SeedPlayer } from "../lib/types";

// ESPN only ships cross-analyst averageRank for its own top-ranked players (coverage
// tapers off for bench/K/DST), so this is checked against the seed's top tier, where
// coverage is observed to be ~98% under normal conditions, not the full seed list.
const MIN_TOP_TIER_ESPN_AVERAGE_RANK_RATE = 0.85;

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;

const seedPlayerSchema = z.object({
  rank: z.number().int().positive(),
  name: z.string().min(1),
  position: z.enum(POSITIONS),
  team: z.string().min(2),
});

const seedFileSchema = z.array(seedPlayerSchema);

async function main() {
  const { values } = parseArgs({
    options: {
      season: { type: "string", default: String(new Date().getFullYear()) },
    },
  });
  const season = Number(values.season);

  const root = resolve(__dirname, "..");
  const seedRaw = JSON.parse(readFileSync(resolve(root, "data/seed/expert-rankings.json"), "utf8"));
  const aliases = JSON.parse(readFileSync(resolve(root, "data/seed/name-aliases.json"), "utf8")) as Record<
    string,
    string
  >;

  const parsed = seedFileSchema.safeParse(seedRaw);
  if (!parsed.success) {
    console.error("Seed file failed validation:");
    console.error(parsed.error.format());
    process.exit(1);
  }
  const seed: SeedPlayer[] = parsed.data;

  console.log(`Fetching ESPN player pool for season ${season}...`);
  const espnPlayers = await fetchPlayerPool(season, 1000);
  console.log(`Fetched ${espnPlayers.length} ESPN players.`);

  console.log(`Fetching FantasyFootballCalculator ADP for season ${season}...`);
  const ffcPlayers = await fetchFfcAdp(season);
  console.log(`Fetched ${ffcPlayers.length} FFC players.`);

  const {
    players,
    matchedCount,
    matchedFromFfcCount,
    espnAverageRankCount,
    topTierEspnAverageRankCount,
    topTierCount,
    unmatchedNames,
  } = mergePlayers(seed, espnPlayers, ffcPlayers, aliases);

  const espnPct = ((matchedCount / seed.length) * 100).toFixed(1);
  const ffcPct = ((matchedFromFfcCount / seed.length) * 100).toFixed(1);
  const avgRankPct = ((espnAverageRankCount / seed.length) * 100).toFixed(1);
  const topTierRate = topTierCount > 0 ? topTierEspnAverageRankCount / topTierCount : 1;
  const topTierPct = (topTierRate * 100).toFixed(1);
  console.log(`Matched ${matchedCount}/${seed.length} (${espnPct}%) seed players to ESPN data.`);
  console.log(`Matched ${matchedFromFfcCount}/${seed.length} (${ffcPct}%) seed players to FFC data.`);
  console.log(
    `Consensus rank from ESPN average: ${espnAverageRankCount}/${seed.length} overall (${avgRankPct}%), ${topTierEspnAverageRankCount}/${topTierCount} (${topTierPct}%) within the top tier; rest fell back to the seed file.`
  );
  if (unmatchedNames.length > 0) {
    console.log("Unmatched ESPN names (add to data/seed/name-aliases.json if needed):");
    for (const name of unmatchedNames) console.log(`  - ${name}`);
  }

  if (topTierRate < MIN_TOP_TIER_ESPN_AVERAGE_RANK_RATE) {
    console.error(
      `Top-tier ESPN average-rank coverage (${topTierPct}%) is below the ${(MIN_TOP_TIER_ESPN_AVERAGE_RANK_RATE * 100).toFixed(0)}% safety threshold — ESPN's rankings response may have changed shape. Refusing to write data/players.json.`
    );
    process.exit(1);
  }

  const output: PlayersFile = {
    generatedAt: new Date().toISOString(),
    season,
    players,
  };

  const outPath = resolve(root, "data/players.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${players.length} players to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
