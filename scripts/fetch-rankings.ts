import { parseArgs } from "node:util";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { fetchPlayerPool } from "./lib/espn";
import { fetchFfcAdp } from "./lib/ffc";
import { fetchSleeperData } from "./lib/sleeper";
import { mergePlayers, round1 } from "./lib/merge";
import type { PlayersFile, RankingFormat, SeedPlayer } from "../lib/types";

// ESPN only ships cross-position/analyst-blended ranks with real confidence for its own
// top-ranked players (coverage tapers off for bench/K/DST), so this is checked against the
// seed's top tier, where coverage is observed to be ~98% under normal conditions, not the full
// seed list. STANDARD-format analyst position-rank coverage is expected to be near-zero (ESPN's
// contributing analysts overwhelmingly only submit PPR ranks) so only the consensus (overall)
// and PPR position-rank thresholds are enforced as hard safety nets.
const MIN_TOP_TIER_CONSENSUS_ESPN_RATE = 0.85;
const MIN_TOP_TIER_PPR_POSITION_RANK_ESPN_RATE = 0.85;

// The "vs last week" delta is computed against a rolling anchor snapshot that only gets
// replaced once it's at least this old, so it always reflects roughly a week of movement.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;
const FORMATS: RankingFormat[] = ["ppr", "standard"];

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
  console.log(`Fetched ${espnPlayers.length} ESPN players (carries both PPR and STANDARD ranks).`);

  console.log(`Fetching FantasyFootballCalculator ADP (PPR and standard) for season ${season}...`);
  const ffcPpr = await fetchFfcAdp(season, "ppr");
  const ffcStandard = await fetchFfcAdp(season, "standard");
  console.log(`Fetched ${ffcPpr.length} FFC PPR players, ${ffcStandard.length} FFC standard players.`);

  console.log(`Fetching Sleeper projections (${season}) and last-season stats (${season - 1})...`);
  const sleeperData = await fetchSleeperData(season);
  console.log(
    `Fetched ${sleeperData.projections.byNameAndPosition.size + sleeperData.projections.dstByTeam.size} Sleeper projections, ` +
      `${sleeperData.lastSeason.byNameAndPosition.size + sleeperData.lastSeason.dstByTeam.size} Sleeper last-season stat lines.`
  );

  const { players, matchedFromEspnCount, topTierCount, unmatchedNames, coverage, sleeperMatchedCount } = mergePlayers(
    seed,
    espnPlayers,
    { ppr: ffcPpr, standard: ffcStandard },
    sleeperData,
    aliases
  );

  const espnPct = ((matchedFromEspnCount / seed.length) * 100).toFixed(1);
  console.log(`Matched ${matchedFromEspnCount}/${seed.length} (${espnPct}%) seed players to ESPN data.`);

  const sleeperPct = ((sleeperMatchedCount / seed.length) * 100).toFixed(1);
  console.log(
    `Matched ${sleeperMatchedCount}/${seed.length} (${sleeperPct}%) seed players to Sleeper projections/stats ` +
      `(supplementary enrichment — not a build-blocking threshold).`
  );

  for (const format of FORMATS) {
    const c = coverage[format];
    const consensusPct = ((c.consensusEspnCount / seed.length) * 100).toFixed(1);
    const topTierConsensusRate = topTierCount > 0 ? c.topTierConsensusEspnCount / topTierCount : 1;
    const positionRankPct = ((c.positionRankEspnCount / seed.length) * 100).toFixed(1);
    const topTierPositionRankRate = topTierCount > 0 ? c.topTierPositionRankEspnCount / topTierCount : 1;
    const ffcPct = ((c.ffcMatchedCount / seed.length) * 100).toFixed(1);
    console.log(
      `[${format}] consensus from ESPN: ${c.consensusEspnCount}/${seed.length} (${consensusPct}%), ${(topTierConsensusRate * 100).toFixed(1)}% within top tier. ` +
        `positionRank from ESPN: ${c.positionRankEspnCount}/${seed.length} (${positionRankPct}%), ${(topTierPositionRankRate * 100).toFixed(1)}% within top tier. ` +
        `FFC ADP matched: ${c.ffcMatchedCount}/${seed.length} (${ffcPct}%).`
    );

    if (format === "ppr" && topTierPositionRankRate < MIN_TOP_TIER_PPR_POSITION_RANK_ESPN_RATE) {
      console.error(
        `[ppr] Top-tier ESPN position-rank coverage (${(topTierPositionRankRate * 100).toFixed(1)}%) is below the ${(MIN_TOP_TIER_PPR_POSITION_RANK_ESPN_RATE * 100).toFixed(0)}% safety threshold — ESPN's rankings response may have changed shape. Refusing to write data/players.json.`
      );
      process.exit(1);
    }
    if (topTierConsensusRate < MIN_TOP_TIER_CONSENSUS_ESPN_RATE) {
      console.error(
        `[${format}] Top-tier ESPN consensus coverage (${(topTierConsensusRate * 100).toFixed(1)}%) is below the ${(MIN_TOP_TIER_CONSENSUS_ESPN_RATE * 100).toFixed(0)}% safety threshold — ESPN's draftRanksByRankType response may have changed shape. Refusing to write data/players.json.`
      );
      process.exit(1);
    }
  }

  if (unmatchedNames.length > 0) {
    console.log("Unmatched ESPN names (add to data/seed/name-aliases.json if needed):");
    for (const name of unmatchedNames) console.log(`  - ${name}`);
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

  const anchorById = new Map((anchor?.players ?? []).map((p) => [p.id, p]));
  for (const p of players) {
    const anchorPlayer = anchorById.get(p.id);
    for (const format of FORMATS) {
      const previousAdp = anchorPlayer?.[format]?.adp ?? null;
      const currentAdp = p[format].adp;
      p[format].adpWeeklyDelta = previousAdp != null && currentAdp != null ? round1(previousAdp - currentAdp) : null;
    }
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
