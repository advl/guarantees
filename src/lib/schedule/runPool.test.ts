import { describe, expect, it } from "vitest";

import runPool from "./runPool.js";

describe("runPool", () => {
  it("answers what every row answered, in the order the rows were given", async () => {
    expect(await runPool([1, 2, 3, 4, 5], async (row) => row * 2, 2)).toEqual([
      2, 4, 6, 8, 10,
    ]);
  });

  it("runs a slice at a time, so no more than the width are in flight at once", async () => {
    let running = 0;
    let widest = 0;
    await runPool(
      [1, 2, 3, 4, 5],
      async (row) => {
        running += 1;
        widest = Math.max(widest, running);
        await new Promise((done) => setTimeout(done, row));
        running -= 1;
      },
      2,
    );
    expect(widest).toBe(2);
  });

  it("settles every row of a slice before it raises one that rejected, so no answer beside it is lost", async () => {
    const finished: number[] = [];
    await expect(
      runPool(
        [1, 2, 3],
        async (row) => {
          await new Promise((done) => setTimeout(done, row * 10));
          if (row === 1) throw new Error("this row could not be run");
          finished.push(row);
        },
        3,
      ),
    ).rejects.toThrow("this row could not be run");
    expect(finished).toEqual([2, 3]);
  });

  it("raises what was thrown even where it was not an error, so a caller's own class survives", async () => {
    await expect(
      runPool([1], async () => Promise.reject("a refusal in a string"), 1),
    ).rejects.toThrow("a refusal in a string");
  });
});
