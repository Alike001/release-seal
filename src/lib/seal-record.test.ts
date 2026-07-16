import { describe, expect, it } from "vitest";

import {
  compareReproducedArtifact,
  compareSealedRuntime,
  isFinalizedSealBlock,
} from "./seal-record";

describe("compareSealedRuntime", () => {
  it("marks identical current code as still matching", () => {
    const matching = compareSealedRuntime(
      "0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1",
      "0xdeadbeef",
    );

    expect(matching.state).toBe("matches");
    expect(matching.liveRuntimeHash).toBe(
      "0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1",
    );
  });

  it("marks changed or absent code as changed", () => {
    expect(
      compareSealedRuntime(
        "0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1",
        "0x",
      ).state,
    ).toBe("changed");
    expect(
      compareSealedRuntime(
        "0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1",
        undefined,
      ).state,
    ).toBe("changed");
  });
});

describe("isFinalizedSealBlock", () => {
  it("accepts a seal in or before the current finalized block", () => {
    expect(isFinalizedSealBlock(42n, 42n)).toBe(true);
    expect(isFinalizedSealBlock(42n, 43n)).toBe(true);
  });

  it("does not mistake inclusion for finality", () => {
    expect(isFinalizedSealBlock(43n, 42n)).toBe(false);
  });
});

describe("compareReproducedArtifact", () => {
  const artifact = {
    filename: "ReleaseSealRegistry.json",
    artifactFileHash:
      "0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1",
    runtime: "0xdeadbeef",
    runtimeHash:
      "0xd4fd4e189132273036449fc9e11198c739161b4c0116a9a2dccdfa1c492006f1",
    runtimeBytes: 4,
  } as const;

  it("requires both the exact file and runtime evidence", () => {
    expect(
      compareReproducedArtifact(
        artifact,
        artifact.runtimeHash,
        artifact.artifactFileHash,
      ).state,
    ).toBe("matches");
    expect(
      compareReproducedArtifact(
        artifact,
        artifact.runtimeHash,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ).state,
    ).toBe("differs");
  });
});
