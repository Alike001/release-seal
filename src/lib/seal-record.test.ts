import { describe, expect, it } from "vitest";

import { compareSealedRuntime } from "./seal-record";

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
