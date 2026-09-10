import { describe, expect, it } from "vitest";

import _renderRun from "./_renderRun.js";
import { CORPUS_LABEL, ENTRY_LABEL, type RunSpec } from "./index.js";

const spec: RunSpec = {
  name: "guarantees-x-measured-1",
  labels: { corpus: "0123456789ab", entry: "x" },
  image: "sha256:image",
  mounts: [
    { host: "/srv/repo", container: "/workspace", readOnly: true },
    {
      host: "/srv/repo/guarantees/.work/x",
      container: "/workspace/guarantees/.work/x",
      readOnly: false,
    },
  ],
  masks: ["/workspace/node_modules"],
  workdir: "/workspace/guarantees",
  network: false,
  deadlineS: 30,
  command: ["/node_modules/.bin/vitest", "run", "x.test.ts"],
};

describe("_renderRun", () => {
  it("renders a run that removes itself on exit, named and labelled as described", () => {
    const argv = _renderRun(spec);
    expect(argv.slice(0, 8)).toEqual([
      "run",
      "--rm",
      "--name",
      "guarantees-x-measured-1",
      "--label",
      `${CORPUS_LABEL}=0123456789ab`,
      "--label",
      `${ENTRY_LABEL}=x`,
    ]);
  });

  it("mounts the workspace read-only and the work directory writable", () => {
    const argv = _renderRun(spec);
    expect(argv).toContain("/srv/repo:/workspace:ro");
    expect(argv).toContain(
      "/srv/repo/guarantees/.work/x:/workspace/guarantees/.work/x",
    );
  });

  it("covers each masked path with a volume of its own, before the image and with no host side to inherit anything from", () => {
    const argv = _renderRun(spec);
    expect(argv.filter((arg) => arg === "-v")).toHaveLength(3);
    const mask = "/workspace/node_modules";
    expect(argv.at(argv.indexOf(mask) - 1)).toBe("-v");
    expect(argv.indexOf(mask)).toBeLessThan(argv.indexOf(spec.image));
  });

  it("renders nothing for a run that masks nothing", () => {
    const argv = _renderRun({ ...spec, masks: [] });
    expect(argv.filter((arg) => arg === "-v")).toHaveLength(2);
  });

  it("walls the network off exactly when the run has none", () => {
    expect(_renderRun(spec)).toContain("--network=none");
    expect(_renderRun({ ...spec, network: true })).not.toContain(
      "--network=none",
    );
  });

  it("sets the working directory, then the image, then the command last", () => {
    const argv = _renderRun(spec);
    expect(argv.slice(-6)).toEqual([
      "-w",
      "/workspace/guarantees",
      "sha256:image",
      "/node_modules/.bin/vitest",
      "run",
      "x.test.ts",
    ]);
  });
});
