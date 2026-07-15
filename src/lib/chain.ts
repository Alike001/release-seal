import { createPublicClient, http, type Address } from "viem";
import { monadTestnet } from "viem/chains";

export const monadChain = monadTestnet;
export const monadRpcUrl = "https://testnet-rpc.monad.xyz";

export const publicClient = createPublicClient({
  chain: monadChain,
  transport: http(monadRpcUrl),
});

export const probeAddress = process.env.NEXT_PUBLIC_GAS_PROBE_ADDRESS as
  Address | undefined;
export const expectedProbeRuntimeHash = process.env
  .NEXT_PUBLIC_GAS_PROBE_RUNTIME_HASH as `0x${string}` | undefined;
export const probeDeploymentBlock = process.env
  .NEXT_PUBLIC_GAS_PROBE_DEPLOYMENT_BLOCK
  ? BigInt(process.env.NEXT_PUBLIC_GAS_PROBE_DEPLOYMENT_BLOCK)
  : undefined;
