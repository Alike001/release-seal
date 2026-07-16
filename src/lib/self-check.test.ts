import { describe, expect, it, vi } from "vitest";

import { releaseSealRegistryRuntimeHash } from "./release-seal-registry";
import {
  loadSelfCheckArtifact,
  selfCheckArtifactFilename,
  selfCheckArtifactUrl,
} from "./self-check";

import artifact from "../../public/artifacts/ReleaseSealRegistry.json";

function artifactResponse(value: unknown, ok = true) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return {
    ok,
    arrayBuffer: async () => bytes.buffer,
  } as Response;
}

describe("ReleaseSeal self-check artifact", () => {
  it("loads the genuine registry runtime through the normal artifact parser", async () => {
    const fetcher = vi.fn(async () => artifactResponse(artifact));

    const result = await loadSelfCheckArtifact(fetcher as typeof fetch);

    expect(fetcher).toHaveBeenCalledWith(selfCheckArtifactUrl, {
      cache: "no-store",
      headers: { accept: "application/json" },
    });
    expect(result.filename).toBe(selfCheckArtifactFilename);
    expect(result.runtimeHash).toBe(releaseSealRegistryRuntimeHash);
    expect(result.runtimeBytes).toBe(2_913);
  });

  it("rejects a published artifact whose runtime is not the pinned registry build", async () => {
    const changed = structuredClone(artifact);
    changed.deployedBytecode.object = "0x6000";
    const fetcher = vi.fn(async () => artifactResponse(changed));

    await expect(
      loadSelfCheckArtifact(fetcher as typeof fetch),
    ).rejects.toThrow("does not match ReleaseSeal's pinned runtime hash");
  });

  it("reports an unavailable published artifact", async () => {
    const fetcher = vi.fn(async () => artifactResponse({}, false));

    await expect(
      loadSelfCheckArtifact(fetcher as typeof fetch),
    ).rejects.toThrow("could not be loaded");
  });
});
