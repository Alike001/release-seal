import type { Address, Hex } from "viem";

export type ActivationStatus = "inactive" | "runway-ready" | "incompatible";

const EIP_7702_PREFIX = "0xef0100";

export function expectedDelegationCode(implementation: Address): Hex {
  return `${EIP_7702_PREFIX}${implementation.slice(2).toLowerCase()}` as Hex;
}

export function classifyActivation(
  code: Hex | undefined,
  implementation: Address,
): ActivationStatus {
  if (!code || code === "0x") return "inactive";

  return code.toLowerCase() === expectedDelegationCode(implementation)
    ? "runway-ready"
    : "incompatible";
}
