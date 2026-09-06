import ts from "typescript";
import { FILE_SIZE_THRESHOLD } from "./constants.js";
import type { Checked } from "./types.js";

/**
 * `@module` belongs to a barrel, whose reader wants to know what the
 * directory is about; on an implementation file it doubles the doc of the
 * one value the file exports. And a file past the size threshold opens with
 * the reason it cannot be smaller — the threshold is a review line, not a
 * cap, and crossing it in silence is what the line exists to catch.
 */
export default function checkDocumentation(
  { text, report }: Checked,
  isBarrel: boolean,
): void {
  if (!isBarrel && /@module\b/.test(text)) {
    report(
      "docs/module-tag-on-barrels",
      "`@module` — the tag documents a barrel; an implementation file documents its one export instead",
    );
  }

  const lines = text.split("\n").length;
  if (lines <= FILE_SIZE_THRESHOLD) return;
  const header = ts.getLeadingCommentRanges(text, 0) ?? [];
  const justified = header.some((range) =>
    text.slice(range.pos, range.end).includes(`${FILE_SIZE_THRESHOLD} lines`),
  );
  if (!justified) {
    report(
      "docs/size-justified",
      `${lines} lines — a file past ${FILE_SIZE_THRESHOLD} lines opens with a comment naming the threshold and why its content is irreducible`,
    );
  }
}
