import { spawn } from "node:child_process";
import type { Spawned, SpawnOptions } from "./types.js";

/**
 * Spawns a process and answers with what it left, under a deadline.
 *
 * Standard output is piped only when the caller captures it, and standard
 * error never: the engine's own diagnostics are the most useful output this
 * produces, and a pipe nobody drains is a deadlock waiting for an error long
 * enough to fill it.
 *
 * When the deadline fires, `killed` is recorded, the caller's `onDeadline`
 * is awaited when given, and only afterwards is a client still alive sent
 * SIGKILL. For an engine client the hook is the container's removal, which
 * is what stops the work: killing the client alone detaches it and leaves
 * the container running, holding its mounts and writing for as long as it
 * lives; the signal afterwards tidies up a client already done, or is the
 * last resort when the engine did not answer. A hook that fails surfaces as
 * this call's rejection once the process has closed. A process that cannot
 * be started rejects with the error: a fault of the machine, not an answer.
 *
 * @note Impure — spawns a process, waits for it, and kills it at the deadline.
 *
 * @package
 */
export default function spawnProcess(
  binary: string,
  args: readonly string[],
  options: SpawnOptions,
): Promise<Spawned> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      cwd: options.cwd,
      stdio: ["ignore", options.capture ? "pipe" : "inherit", "inherit"],
    });
    const chunks: Buffer[] = [];
    if (child.stdout) {
      child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    }

    let killed = false;
    let stopping: Promise<void> | null = null;
    const timer = setTimeout(() => {
      killed = true;
      stopping = (async () => {
        try {
          await options.onDeadline?.();
        } finally {
          if (child.exitCode === null && child.signalCode === null) {
            child.kill("SIGKILL");
          }
        }
      })();
      // The rejection, if any, is delivered on close below; this handler
      // keeps it from being reported as unhandled in the meantime.
      stopping.catch(() => undefined);
    }, options.deadlineMs);

    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      const spawned = {
        code,
        out: Buffer.concat(chunks).toString("utf8").trim(),
        killed,
      };
      if (stopping === null) {
        resolve(spawned);
        return;
      }
      stopping.then(() => resolve(spawned), reject);
    });
  });
}
