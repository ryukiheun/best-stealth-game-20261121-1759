// main.ts — the entrypoint for the Moss & Shadow bounty entry.
// It assembles the submission output: it copies the finished game (game/)
// and the real-render screenshots (screenshots/) into the output directory
// and writes the dossier (dossier.json) the gate compares byte for byte.
// The grader runs it twice against the same output directory and the two
// dossiers must be byte-identical, so there are no timestamps, no random
// choices and no network calls anywhere here. Node 22 standard library
// only. Output directory: $MAKEFUN_OUTPUT_DIR when set (local runs),
// otherwise /output (the grader).
//
// The output root itself is NEVER removed. The grader mounts /output as a
// volume, and removing a mount point fails (EBUSY) even with force: true,
// which only ignores a missing path — that is exactly how round 1 failed
// with exit 1 while every local run passed. Copying over the previous run
// is safe instead: the same repository files are copied both times, so the
// second run writes the same bytes as the first.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-game.ts";

// Caps from the bounty rules: dossier text 160 KiB, at most 4 screenshots
// of at most 256 KiB each, game/ at most 993 entries and 48 MiB, and no
// path under game/ longer than 1000 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function repoRoot(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function outputDir(): string {
  return process.env.MAKEFUN_OUTPUT_DIR || "/output";
}

function main(): void {
  const root = repoRoot();
  const out = outputDir();
  const gameDir = join(root, "game");
  const shotsDir = join(root, "screenshots");
  if (!existsSync(gameDir)) throw new Error("main.ts: game/ is missing from the repository");
  if (!existsSync(shotsDir)) throw new Error("main.ts: screenshots/ is missing from the repository");

  mkdirSync(out, { recursive: true });
  cpSync(gameDir, join(out, "game"), { recursive: true });
  mkdirSync(join(out, "screenshots"), { recursive: true });
  cpSync(shotsDir, join(out, "screenshots"), { recursive: true });

  const dossier = buildDossier(out, DOSSIER_CAPS);
  writeFileSync(join(out, "dossier.json"), dossier);
  console.log(`wrote ${out}/dossier.json (${dossier.length} bytes)`);
}

main();
