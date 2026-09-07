import { describe, expect, it } from "vitest";

import expectOneFault from "../../_testing/expectOneFault.js";
import {
  PIPELINE,
  REGISTER_ONE_IMAGE,
  renderRegister,
  renderRow,
} from "../../_testing/fixtures.js";
import { CONTRACT_VERSION } from "../contract/index.js";
import _readHeader from "./_readHeader.js";
import { parseRegister } from "./index.js";

const withHeader = (header: string) =>
  `[corpus]\n${header}\n\n${REGISTER_ONE_IMAGE}`;

describe("parseRegister", () => {
  describe("the header", () => {
    it("reads a register without a header, or without a version, as written against contract 1", () => {
      const rows = parseRegister(REGISTER_ONE_IMAGE, PIPELINE);
      expect(parseRegister(withHeader(`contract = "1"`), PIPELINE)).toEqual(
        rows,
      );
      expect(parseRegister(withHeader(""), PIPELINE)).toEqual(rows);
    });

    it("reads a header naming the version this package reads", () => {
      expect(
        parseRegister(withHeader(`contract = "${CONTRACT_VERSION}"`), PIPELINE)
          .size,
      ).toBe(5);
    });

    it("refuses a header naming another version", () => {
      expectOneFault(withHeader(`contract = "0"`), {
        table: "corpus",
        column: "contract",
        reason: /is "0", and this package reads contract "1"/,
        line: 2,
      });
    });

    it("refuses a version that is not written as text", () => {
      expectOneFault(withHeader("contract = 1"), {
        table: "corpus",
        column: "contract",
        reason: "is not a string",
        line: 2,
      });
    });

    it("refuses a key the header does not carry", () => {
      expectOneFault(withHeader(`version = "1"`), {
        table: "corpus",
        column: "version",
        reason: /is not a key the header carries/,
        line: 2,
      });
    });

    it("points a key it cannot find on a line at the header", () => {
      expectOneFault(withHeader("x.y = 1"), {
        table: "corpus",
        column: "x",
        reason: /is not a key the header carries/,
        line: 1,
      });
    });

    it("refuses the header's name written as a row, as one fault naming the reservation", () => {
      const text = renderRegister([
        renderRow("corpus"),
        renderRow("corpus-can-fail", { expect: `"fail"` }),
      ]);
      expectOneFault(text, {
        table: "corpus",
        reason:
          /is reserved for the register's header, and this table is written as a row/,
        line: 1,
      });
    });

    it("refuses a headerless register the day the contract moves past the version the header did not exist at", () => {
      // The version this package reads is a constant, so the day cannot be
      // staged through `parseRegister`; the reader takes the version as a
      // parameter for exactly this, so the refusal is watched firing on a
      // version the contract has not reached rather than trusted until then.
      expect(_readHeader(null, "2")).toEqual([
        {
          table: "corpus",
          column: "contract",
          reason: expect.stringMatching(
            /^is "1", and this package reads contract "2"/,
          ),
          line: undefined,
        },
      ]);
      const located = { id: "corpus", line: 1, locateColumn: () => 2 };
      expect(_readHeader({ table: { contract: "2" }, located }, "2")).toEqual(
        [],
      );
      expect(_readHeader({ table: {}, located }, "2")).toEqual([
        expect.objectContaining({ column: "contract", line: 2 }),
      ]);
    });
  });
});
