import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseRegister } from "@aztlan/guarantees";
import { COLLECTS, readPipeline } from "@aztlan/guarantees/selftest";

/** This corpus's own directory, which is where an entry resolves everything from. */
export const corpusRoot = resolve(dirname(fileURLToPath(import.meta.url)));

/** The repository this corpus judges: its parent, and what a run mounts. */
export const repositoryRoot = resolve(corpusRoot, "..");

/**
 * The register, read exactly as the scheduler reads it: against the tiers
 * the workflow triggers and proves.
 *
 * An entry that parsed it any other way would be judging a document the
 * scheduler never saw, and the guards that matter most — a tier no job runs,
 * a tier no job proves — are precisely the ones a corpus cannot assert about
 * itself from the inside, since a tier nothing schedules never runs its own
 * entries.
 */
export const register = parseRegister(
  readFileSync(join(corpusRoot, "corpus.toml"), "utf8"),
  readPipeline(
    readFileSync(
      join(repositoryRoot, ".github", "workflows", "guarantees.yml"),
      "utf8",
    ),
    COLLECTS,
  ),
);
