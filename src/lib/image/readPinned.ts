import { parse, TomlError } from "smol-toml";
import { Refusal } from "../contract/index.js";
import { INPUTS_PATTERN, PINNED_FILE, REFERENCE_PATTERN } from "./constants.js";
import type { Pinned } from "./types.js";

const KEYS = ["digest", "inputs"] as const;

/**
 * Reads a pinned record, or refuses it. The record is two strings and
 * nothing else: the digest-pinned reference the rows name, in the shape the
 * register's image column takes, and the inputs hash in the shape
 * `hashImageInputs` answers. A key beside those is refused, because a
 * record that carries more than it is read for will one day carry
 * something somebody relies on and nothing reads.
 *
 * @throws Refusal naming the first fault found.
 *
 * @package
 */
export default function readPinned(text: string): Pinned {
  let document: Record<string, unknown>;
  try {
    document = parse(text);
  } catch (error) {
    if (!(error instanceof TomlError)) throw error;
    throw new Refusal(
      `${PINNED_FILE} does not parse: ${error.message.replace(/\n[\s\S]*$/, "")}`,
    );
  }
  for (const key of Object.keys(document)) {
    if (!(KEYS as readonly string[]).includes(key)) {
      throw new Refusal(
        `${PINNED_FILE}: \`${key}\` is not a key a pinned record carries (${KEYS.join(", ")})`,
      );
    }
  }
  const [digest, inputs] = KEYS.map((key) => {
    const value = document[key];
    if (typeof value !== "string") {
      throw new Refusal(
        `${PINNED_FILE}: \`${key}\` is missing or not a string`,
      );
    }
    return value;
  }) as [string, string];
  if (!REFERENCE_PATTERN.test(digest)) {
    throw new Refusal(
      `${PINNED_FILE}: \`digest\` ${JSON.stringify(digest)} is not an image pinned by digest — a name, \`@sha256:\` and sixty-four hex digits, as a row names one`,
    );
  }
  if (!INPUTS_PATTERN.test(inputs)) {
    throw new Refusal(
      `${PINNED_FILE}: \`inputs\` ${JSON.stringify(inputs)} is not an inputs hash — \`sha256:\` and sixty-four hex digits`,
    );
  }
  return { digest, inputs };
}
