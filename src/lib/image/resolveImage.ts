import { Refusal } from "../contract/index.js";
import { type Spawn, spawnProcess } from "../process/index.js";
import { UNMEASURED_S } from "../register/index.js";
import type { Engine } from "../run/index.js";
import { REFERENCE_PATTERN } from "./constants.js";
import type { ImageRef } from "./types.js";

/**
 * Resolves a digest-pinned reference to what the engine is handed: the ID
 * of an image in local storage carrying that digest, whatever name it is
 * filed under, or else the reference itself once it has been pulled.
 *
 * Local first because the digest is the identity and the registry is only
 * where a machine that lacks the image goes looking: a machine that already
 * holds it — this repository's own integration suite, which builds it —
 * runs against what it has rather than fetching a second copy of the same
 * bytes. The engine
 * reports a pulled multi-platform image under two digests — the list's and
 * the platform's — in different fields, so both `.Digest` and `.RepoDigests`
 * are searched. A pull that opens a connection and stalls is reported as
 * what it is, because falling through to the message about an absent image
 * would describe a registry answering slowly as an image that is not there.
 *
 * @note Impure — spawns the engine to list local images, and to pull.
 * @throws Refusal when the reference is not pinned by digest, the engine
 * cannot list what it holds, the pull stalls to its deadline, or the image
 * is neither local nor pullable.
 */
export default async function resolveImage(
  engine: Engine,
  reference: string,
  spawn: Spawn = spawnProcess,
): Promise<ImageRef> {
  if (!REFERENCE_PATTERN.test(reference)) {
    throw new Refusal(
      `${reference} is not an image pinned by digest — an admissible run names its image as \`name@sha256:<digest>\`, never by tag`,
    );
  }
  const digest = reference.slice(reference.indexOf("@") + 1);

  const listed = await spawn(
    engine.binary,
    [
      "images",
      "--no-trunc",
      "--format",
      "{{.Digest}} {{.RepoDigests}} {{.ID}}",
    ],
    { deadlineMs: UNMEASURED_S * 1000, capture: true },
  );
  if (listed.code !== 0 || listed.killed) {
    throw new Refusal(
      `the engine could not list its images, so whether ${reference} is in local storage is unknown — an engine that cannot say what it holds is not one to pull with either`,
    );
  }
  for (const line of listed.out.split("\n")) {
    const fields = line.trim().split(/\s+/);
    const id = fields.at(-1);
    const carried = fields
      .slice(0, -1)
      .map((field) => field.replace(/^\[|\]$/g, ""))
      .some((field) => field === digest || field.endsWith(`@${digest}`));
    if (carried && id !== undefined && id !== "")
      return { digest, reference: id };
  }

  const pulled = await spawn(engine.binary, ["pull", reference], {
    deadlineMs: UNMEASURED_S * 1000,
  });
  if (pulled.killed) {
    throw new Refusal(
      `${reference} did not pull within ${UNMEASURED_S}s — the registry took the connection and stopped answering, which is not the same as an image that is absent`,
    );
  }
  if (pulled.code !== 0) {
    throw new Refusal(
      `${reference} is neither in local storage nor pullable — a row pins the image the pipeline published, so either that digest was never pushed or this machine cannot reach the registry it was pushed to`,
    );
  }
  return { digest, reference };
}
