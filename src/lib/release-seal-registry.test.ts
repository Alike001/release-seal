import { describe, expect, it } from "vitest";
import {
  decodeErrorResult,
  encodeErrorResult,
  encodeFunctionData,
  zeroAddress,
} from "viem";

import {
  deriveReleaseId,
  releaseSealRegistryAbi,
  releaseSealRegistryAddress,
} from "./release-seal-registry";

describe("releaseSealRegistryAbi", () => {
  it("encodes the registry seal call with all evidence fields", () => {
    const data = encodeFunctionData({
      abi: releaseSealRegistryAbi,
      functionName: "seal",
      args: [
        zeroAddress,
        "0x1111111111111111111111111111111111111111111111111111111111111111",
        "0x2222222222222222222222222222222222222222222222222222222222222222",
        "0x3333333333333333333333333333333333333333333333333333333333333333",
      ],
    });

    expect(data).toMatch(/^0x[0-9a-f]{264}$/);
  });

  it("derives a stable, domain-separated release identifier", () => {
    const artifactHash =
      "0x1111111111111111111111111111111111111111111111111111111111111111";

    expect(deriveReleaseId(artifactHash)).toBe(
      "0x921e85da762c8b0a9eb75a8d3b7d03705de44a2bd85398a00c378d0fde19640e",
    );
    expect(releaseSealRegistryAddress).toBe(
      "0x34e6115D585A22B176Cb4F664da389aB8cC8b7b4",
    );
  });

  it("decodes the registry's duplicate-seal error", () => {
    const sealId =
      "0x1111111111111111111111111111111111111111111111111111111111111111";
    const data = encodeErrorResult({
      abi: releaseSealRegistryAbi,
      errorName: "DuplicateSeal",
      args: [sealId],
    });

    expect(data.slice(0, 10)).toBe("0x9d0d46f2");
    expect(
      decodeErrorResult({ abi: releaseSealRegistryAbi, data }),
    ).toMatchObject({
      errorName: "DuplicateSeal",
      args: [sealId],
    });
  });
});
