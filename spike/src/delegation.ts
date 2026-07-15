import {
  ExecutionMode,
  ROOT_AUTHORITY,
  createCaveat,
  createExecution,
  type Delegation,
  type ExecutionStruct,
} from "@metamask/smart-accounts-kit";
import { DelegationManager } from "@metamask/smart-accounts-kit/contracts";
import { createCaveatBuilder } from "@metamask/smart-accounts-kit/utils";
import {
  encodeAbiParameters,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";

import { getDelegationEnvironment } from "./networks.js";

export type RunwayDelegationInput = {
  chainId: 143 | 10_143;
  delegator: Address;
  relayer: Address;
  floorEnforcer: Address;
  policyNonce: bigint;
  expiry: number;
  salt: Hex;
  execution: ExecutionStruct;
};

export type UnsignedDelegation = Omit<Delegation, "signature">;

export function createNativeTransfer(recipient: Address, value: bigint) {
  return createExecution({ target: recipient, value });
}

export function buildRunwayDelegation(
  input: RunwayDelegationInput,
): UnsignedDelegation {
  const environment = getDelegationEnvironment(input.chainId);
  const caveats = createCaveatBuilder(environment)
    .addCaveat("exactExecution", { execution: input.execution })
    .addCaveat("limitedCalls", { limit: 1 })
    .addCaveat("redeemer", { redeemers: [input.relayer] })
    .addCaveat("timestamp", {
      afterThreshold: 0,
      beforeThreshold: input.expiry,
    })
    .addCaveat(
      createCaveat(
        input.floorEnforcer,
        encodeAbiParameters([{ type: "uint256" }], [input.policyNonce]),
      ),
    )
    .build();

  return {
    delegate: input.relayer,
    delegator: input.delegator,
    authority: ROOT_AUTHORITY,
    caveats,
    salt: input.salt,
  };
}

export function attachSignature(
  delegation: UnsignedDelegation,
  signature: Hex,
): Delegation {
  return { ...delegation, signature };
}

export function encodeRunwayRedemption(
  delegation: Delegation,
  execution: ExecutionStruct,
): Hex {
  return DelegationManager.encode.redeemDelegations({
    delegations: [[delegation]],
    modes: [ExecutionMode.SingleDefault],
    executions: [[execution]],
  });
}

export async function simulateRunwayRedemption(
  client: PublicClient,
  chainId: 143 | 10_143,
  delegation: Delegation,
  execution: ExecutionStruct,
) {
  const environment = getDelegationEnvironment(chainId);
  return DelegationManager.simulate.redeemDelegations({
    client,
    delegationManagerAddress: environment.DelegationManager,
    delegations: [[delegation]],
    modes: [ExecutionMode.SingleDefault],
    executions: [[execution]],
  });
}
