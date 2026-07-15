import { createPublicClient, http, type Address } from "viem";
import { monadTestnet } from "viem/chains";

export const monadChain = monadTestnet;
export const monadRpcUrl = "https://testnet-rpc.monad.xyz";

export const publicClient = createPublicClient({
  chain: monadChain,
  transport: http(monadRpcUrl),
});

// This is immutable public chain identity, not user configuration.
export const probeAddress =
  "0xDe7D3BA3A42643164378fa64B72dA5cBe9C9369c" as Address;
export const expectedProbeRuntimeHash =
  "0x90857816f72eedd2d66537f6c9ecf19a9e7eb4b8c697c14972a8f0ae0352ef30" as const;
export const probeDeploymentBlock = 45_202_395n;
