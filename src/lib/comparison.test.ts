import { describe, expect, it } from "vitest";
import { keccak256 } from "viem";

import { compareRuntime, firstDifferentByte } from "./comparison";

describe("runtime comparison", () => {
  it("returns exact only for complete byte equality", () => {
    expect(compareRuntime("0x6001600055", "0x6001600055")).toEqual({
      outcome: "exact",
      expectedRuntimeHash: keccak256("0x6001600055"),
      observedRuntimeHash: keccak256("0x6001600055"),
      expectedBytes: 5,
      observedBytes: 5,
    });
  });

  it("reports the first different byte and both identities", () => {
    expect(compareRuntime("0x6001600055", "0x6001610055")).toEqual({
      outcome: "differs",
      expectedRuntimeHash: keccak256("0x6001600055"),
      observedRuntimeHash: keccak256("0x6001610055"),
      expectedBytes: 5,
      observedBytes: 5,
      firstDifferenceOffset: 2,
    });
    expect(firstDifferentByte("0x6001", "0x600100")).toBe(2);
  });

  it("keeps no-code separate from mismatch", () => {
    expect(compareRuntime("0x6001", "0x")).toEqual({
      outcome: "no-code",
      expectedRuntimeHash: keccak256("0x6001"),
      expectedBytes: 2,
    });
  });
});
