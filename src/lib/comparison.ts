import { keccak256, type Hex } from "viem";

import type { RuntimeComparison } from "./release-seal-types";

function byteLength(value: Hex) {
  return (value.length - 2) / 2;
}

export function firstDifferentByte(expected: Hex, observed: Hex) {
  const expectedBody = expected.slice(2).toLowerCase();
  const observedBody = observed.slice(2).toLowerCase();
  const sharedBytes = Math.min(expectedBody.length, observedBody.length) / 2;

  for (let offset = 0; offset < sharedBytes; offset += 1) {
    const start = offset * 2;
    if (
      expectedBody.slice(start, start + 2) !==
      observedBody.slice(start, start + 2)
    ) {
      return offset;
    }
  }

  return Math.floor(sharedBytes);
}

export function compareRuntime(
  expected: Hex,
  observed: Hex | undefined,
): RuntimeComparison {
  const expectedRuntimeHash = keccak256(expected);
  const expectedBytes = byteLength(expected);

  if (!observed || observed === "0x") {
    return { outcome: "no-code", expectedRuntimeHash, expectedBytes };
  }

  const observedRuntimeHash = keccak256(observed);
  const observedBytes = byteLength(observed);
  if (expected.toLowerCase() === observed.toLowerCase()) {
    return {
      outcome: "exact",
      expectedRuntimeHash,
      observedRuntimeHash,
      expectedBytes,
      observedBytes,
    };
  }

  return {
    outcome: "differs",
    expectedRuntimeHash,
    observedRuntimeHash,
    expectedBytes,
    observedBytes,
    firstDifferenceOffset: firstDifferentByte(expected, observed),
  };
}
