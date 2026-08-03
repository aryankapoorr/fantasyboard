import { parseArgs } from "node:util";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { fetchPlayerPool } from "./lib/espn";
import { fetchFfcAdp } from "./lib/ffc";
import { mergePlayers, round1 } from "./lib/merge";
import type { PlayersFile, SeedPlayer } from "../lib/types";

// ESPN only ships cross-analyst position-blended ranks for its own top-ranked players
// (coverage tapers off for bench/K/DST), so this is checked against the seed's top tier,
// where coverage is observed to be ~98% under normal conditions, not the full seed list.
const MIN_TOP_TIER_POSITION_RANK_ESPN_RATE = 0.85;

// The "vs last week" delta is computed against a rolling anchor snapshot that only gets
// replaced once it's at least this old, so it always reflects roughly a week of movement.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
    positionRankEspnCount,
    topTierPositionRankEspnCount,
    topTierCount,
    unmatchedNames,
  } = mergePlayers(seed, espnPlayers, ffcPlayers, aliases);

  const espnPct = ((matchedCount / seed.length) * 100).toFixed(1);
  const ffcPct = ((matchedFromFfcCount / seed.length) * 100).toFixed(1);
  const positionRankEspnPct = ((positionRankEspnCount / seed.length) * 100).toFixed(1);
  const topTierRate = topTierCount > 0 ? topTierPositionRankEspnCount / topTierCount : 1;
  const topTierPct = (topTierRate * 100).toFixed(1);
  console.log(`Matched ${matchedCount}/${seed.length} (${espnPct}%) seed players to ESPN data.`);
  console.log(`Matched ${matchedFromFfcCount}/${seed.length} (${ffcPct}%) seed players to FFC data.`);
  console.log(
    `Position rank from ESPN analyst blend: ${positionRankEspnCount}/${seed.length} overall (${positionRankEspnPct}%), ${topTierPositionRankEspnCount}/${topTierCount} (${topTierPct}%) within the top tier; rest fell back to editorial order.`
  );
  if (unmatchedNames.length > 0) {
    console.log("Unmatched ESPN names (add to data/seed/name-aliases.json if needed):");
    for (const name of unmatchedNames) console.log(`  - ${name}`);
  }

  if (topTierRate < MIN_TOP_TIER_POSITION_RANK_ESPN_RATE) {
    console.error(
      `Top-tier ESPN position-rank coverage (${topTierPct}%) is below the ${(MIN_TOP_TIER_POSITION_RANK_ESPN_RATE * 100).toFixed(0)}% safety threshold — ESPN's rankings response may have changed shape. Refusing to write data/players.json.`
    );
    process.exit(1);
  }

  // Roll the weekly anchor forward: keep comparing against the same snapshot until it's at
  // least a week old, then replace it with whatever was current just before this run.
  const currentPath = resolve(root, "data/players.json");
  const weekAgoPath = resolve(root, "data/players-week-ago.json");

  let anchor: PlayersFile | null = existsSync(weekAgoPath)
    ? (JSON.parse(readFileSync(weekAgoPath, "utf8")) as PlayersFile)
    : null;
  const anchorAgeMs = anchor ? Date.now() - new Date(anchor.generatedAt).getTime() : Infinity;

  if (anchorAgeMs >= WEEK_MS && existsSync(currentPath)) {
    const outgoing = readFileSync(currentPath, "utf8");
    writeFileSync(weekAgoPath, outgoing);
    anchor = JSON.parse(outgoing) as PlayersFile;
    console.log("Weekly anchor snapshot refreshed.");
  } else if (anchor) {
    const ageDays = (anchorAgeMs / (24 * 60 * 60 * 1000)).toFixed(1);
    console.log(`Weekly anchor snapshot is ${ageDays} day(s) old, keeping it.`);
  } else {
    console.log("No weekly anchor snapshot yet; ADP weekly deltas will be null this run.");
  }

  const anchorAdpById = new Map((anchor?.players ?? []).map((p) => [p.id, p.adp]));
  for (const p of players) {
    const previousAdp = anchorAdpById.get(p.id) ?? null;
    p.adpWeeklyDelta = previousAdp != null && p.adp != null ? round1(previousAdp - p.adp) : null;
  }

  const output: PlayersFile = {
    generatedAt: new Date().toISOString(),
    season,
    players,
  };

  writeFileSync(currentPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`Wrote ${players.length} players to ${currentPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
