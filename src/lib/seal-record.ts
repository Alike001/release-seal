import { keccak256, type Hex } from "viem";

import type { ArtifactEvidence } from "@/lib/release-seal-types";

export function compareSealedRuntime(
  recordedRuntimeHash: Hex,
  liveCode: Hex | undefined,
) {
  const liveRuntimeHash =
    liveCode === undefined ? undefined : keccak256(liveCode);

  return {
    liveRuntimeHash,
    state: liveRuntimeHash === recordedRuntimeHash ? "matches" : "changed",
  } as const;
}

export function compareReproducedArtifact(
  artifact: ArtifactEvidence,
  recordedRuntimeHash: Hex,
  recordedArtifactFileHash: Hex,
) {
  const fileMatches = artifact.artifactFileHash === recordedArtifactFileHash;
  const runtimeMatches = artifact.runtimeHash === recordedRuntimeHash;

  return {
    fileMatches,
    runtimeMatches,
    state: fileMatches && runtimeMatches ? "matches" : "differs",
  } as const;
}

export function isFinalizedSealBlock(
  sealBlock: bigint,
  finalizedBlock: bigint,
) {
  return sealBlock <= finalizedBlock;
}
