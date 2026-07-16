import type { ArtifactEvidence } from "./release-seal-types";
import { parseFoundryArtifact } from "./artifact";
import {
  releaseSealRegistryAddress,
  releaseSealRegistryRuntimeHash,
} from "./release-seal-registry";

export const selfCheckArtifactUrl =
  "/artifacts/ReleaseSealRegistry.json" as const;
export const selfCheckArtifactFilename = "ReleaseSealRegistry.json" as const;
export const selfCheckTarget = releaseSealRegistryAddress;

export async function loadSelfCheckArtifact(
  fetcher: typeof fetch = fetch,
): Promise<ArtifactEvidence> {
  const response = await fetcher(selfCheckArtifactUrl, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("The published registry artifact could not be loaded.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  const parsed = parseFoundryArtifact(bytes, selfCheckArtifactFilename);
  if (!parsed.ok) {
    throw new Error(
      `The published registry artifact is invalid: ${parsed.error.message}`,
    );
  }
  if (parsed.value.runtimeHash !== releaseSealRegistryRuntimeHash) {
    throw new Error(
      "The published registry artifact does not match ReleaseSeal's pinned runtime hash.",
    );
  }

  return parsed.value;
}
