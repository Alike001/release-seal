import {
  encodePacked,
  keccak256,
  type Abi,
  type Address,
  type Hex,
} from "viem";

export const releaseSealedEvent = {
  type: "event",
  name: "ReleaseSealed",
  anonymous: false,
  inputs: [
    { name: "sealId", type: "bytes32", indexed: true },
    { name: "issuer", type: "address", indexed: true },
    { name: "target", type: "address", indexed: true },
    { name: "runtimeHash", type: "bytes32", indexed: false },
    { name: "artifactFileHash", type: "bytes32", indexed: false },
    { name: "releaseId", type: "bytes32", indexed: false },
    { name: "blockNumber", type: "uint64", indexed: false },
  ],
} as const;

export const releaseSealRegistryAbi = [
  {
    type: "error",
    name: "DuplicateSeal",
    inputs: [{ name: "sealId", type: "bytes32" }],
  },
  {
    type: "error",
    name: "RuntimeHashMismatch",
    inputs: [
      { name: "claimed", type: "bytes32" },
      { name: "observed", type: "bytes32" },
    ],
  },
  {
    type: "error",
    name: "TargetHasNoCode",
    inputs: [{ name: "target", type: "address" }],
  },
  {
    type: "error",
    name: "ZeroEvidence",
    inputs: [],
  },
  {
    type: "function",
    name: "seal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "claimedRuntimeHash", type: "bytes32" },
      { name: "artifactFileHash", type: "bytes32" },
      { name: "releaseId", type: "bytes32" },
    ],
    outputs: [{ name: "sealId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "computeSealId",
    stateMutability: "view",
    inputs: [
      { name: "issuer", type: "address" },
      { name: "target", type: "address" },
      { name: "runtimeHash", type: "bytes32" },
      { name: "artifactFileHash", type: "bytes32" },
      { name: "releaseId", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getSeal",
    stateMutability: "view",
    inputs: [{ name: "sealId", type: "bytes32" }],
    outputs: [
      {
        name: "sealRecord",
        type: "tuple",
        components: [
          { name: "issuer", type: "address" },
          { name: "target", type: "address" },
          { name: "runtimeHash", type: "bytes32" },
          { name: "artifactFileHash", type: "bytes32" },
          { name: "releaseId", type: "bytes32" },
          { name: "blockNumber", type: "uint64" },
        ],
      },
    ],
  },
  releaseSealedEvent,
] as const satisfies Abi;

export const releaseSealRegistryAddress =
  "0x34e6115D585A22B176Cb4F664da389aB8cC8b7b4" as const satisfies Address;

export const releaseSealRegistryRuntimeHash =
  "0xbeba792ad0de3adb3698cdfb49cb439a65736c88289f2e824edcc943f0407199" as const satisfies Hex;

export const firstReleaseSealId =
  "0x53d2b1c05305211e12e191e76c95e3e88119a1d9b5d14c60131695940b31abec" as const satisfies Hex;

/**
 * Deterministic local identifier for this artifact version. The domain tag
 * prevents a future ReleaseSeal identifier from being confused with a raw
 * artifact file hash used elsewhere.
 */
export function deriveReleaseId(artifactFileHash: Hex) {
  return keccak256(
    encodePacked(
      ["string", "bytes32"],
      ["ReleaseSeal release/v1", artifactFileHash],
    ),
  );
}
