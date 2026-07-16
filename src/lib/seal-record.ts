import { keccak256, type Hex } from "viem";

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
