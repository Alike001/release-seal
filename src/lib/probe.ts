import type { Address, Hex } from "viem";

export const gasProbeAbi = [
  {
    type: "event",
    name: "RunMeasured",
    anonymous: false,
    inputs: [
      { indexed: true, name: "runId", type: "bytes32" },
      { indexed: true, name: "caller", type: "address" },
      { indexed: false, name: "iterations", type: "uint32" },
      { indexed: false, name: "gasBeforeWork", type: "uint256" },
      { indexed: false, name: "gasAfterWork", type: "uint256" },
      { indexed: false, name: "checksum", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "calibrate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "runId", type: "bytes32" },
      { name: "iterations", type: "uint32" },
    ],
    outputs: [{ name: "workGas", type: "uint256" }],
  },
] as const;

export const calibrationSelector = "0xac1d9bc1" as Hex;
export const maxIterations = 512;

export type ProbeMeasurement = {
  runId: Hex;
  caller: Address;
  iterations: number;
  gasBeforeWork: bigint;
  gasAfterWork: bigint;
  checksum: Hex;
};
