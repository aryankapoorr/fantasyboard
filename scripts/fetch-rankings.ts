import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { fetchPlayerPool } from "./lib/espn";
import { mergePlayers } from "./lib/merge";
import type { PlayersFile, SeedPlayer } from "../lib/types";

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

  const { players, matchedCount, unmatchedNames } = mergePlayers(seed, espnPlayers, aliases);

  const pct = ((matchedCount / seed.length) * 100).toFixed(1);
  console.log(`Matched ${matchedCount}/${seed.length} (${pct}%) seed players to ESPN data.`);
  if (unmatchedNames.length > 0) {
    console.log("Unmatched names (add to data/seed/name-aliases.json if needed):");
    for (const name of unmatchedNames) console.log(`  - ${name}`);
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
