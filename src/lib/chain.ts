import { createPublicClient, http } from "viem";
import { monadTestnet } from "viem/chains";

export const monadChain = monadTestnet;
export const monadRpcUrl = "https://testnet-rpc.monad.xyz";

export const publicClient = createPublicClient({
  chain: monadChain,
  transport: http(monadRpcUrl),
});
