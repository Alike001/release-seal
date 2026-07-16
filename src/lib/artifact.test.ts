import { describe, expect, it } from "vitest";
import { keccak256 } from "viem";

import {
  MAX_ARTIFACT_BYTES,
  normalizeRuntimeBytecode,
  parseFoundryArtifact,
} from "./artifact";

const encoder = new TextEncoder();

function artifact(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    abi: [],
    deployedBytecode: {
      object: "0x6001600055",
      linkReferences: {},
    },
    metadata: {
      compiler: { version: "0.8.23+commit.f704f362" },
      settings: {
        compilationTarget: { "src/Counter.sol": "Counter" },
        optimizer: { enabled: false, runs: 200 },
      },
    },
    ...overrides,
  });
}

describe("Foundry artifact parsing", () => {
  it("reads a real Foundry-shaped artifact without top-level name fields", () => {
    const raw = artifact();
    const bytes = encoder.encode(raw);
    const result = parseFoundryArtifact(bytes, "Counter.json");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      filename: "Counter.json",
      artifactFileHash: keccak256(bytes),
      runtime: "0x6001600055",
      runtimeHash: keccak256("0x6001600055"),
      runtimeBytes: 5,
      compilationTarget: "src/Counter.sol:Counter",
      compilerVersion: "0.8.23+commit.f704f362",
      optimizer: "DISABLED",
    });
  });

  it("normalizes an unprefixed mixed-case runtime", () => {
    expect(normalizeRuntimeBytecode("60Aa00")).toBe("0x60aa00");
  });

  it.each([
    ["malformed-json", encoder.encode("{"), "malformed-json"],
    [
      "missing-runtime",
      encoder.encode(JSON.stringify({ abi: [] })),
      "missing-runtime",
    ],
    [
      "odd-runtime",
      encoder.encode(
        artifact({
          deployedBytecode: { object: "0x123", linkReferences: {} },
        }),
      ),
      "invalid-runtime",
    ],
    [
      "non-hex-runtime",
      encoder.encode(
        artifact({
          deployedBytecode: { object: "0x12zz", linkReferences: {} },
        }),
      ),
      "invalid-runtime",
    ],
    [
      "linked-libraries",
      encoder.encode(
        artifact({
          deployedBytecode: {
            object: "0x6000",
            linkReferences: { "src/Lib.sol": { Lib: [] } },
          },
        }),
      ),
      "linked-libraries",
    ],
    [
      "immutable-references",
      encoder.encode(
        artifact({
          deployedBytecode: {
            object: "0x6000",
            linkReferences: {},
            immutableReferences: { "7": [{ start: 1, length: 32 }] },
          },
        }),
      ),
      "immutable-references",
    ],
  ])("rejects %s", (_, bytes, code) => {
    const result = parseFoundryArtifact(bytes, "bad.json");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(code);
  });

  it("rejects files over the local size boundary before parsing", () => {
    const result = parseFoundryArtifact(
      new Uint8Array(MAX_ARTIFACT_BYTES + 1),
      "huge.json",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("file-too-large");
  });
});
