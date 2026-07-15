import { decodeAbiParameters, getFunctionSelector, parseEther } from "viem";
import { describe, expect, it } from "vitest";

import {
  attachSignature,
  buildRunwayDelegation,
  createNativeTransfer,
  encodeRunwayRedemption,
} from "../src/delegation.js";
import { getDelegationEnvironment } from "../src/networks.js";

const DELEGATOR = "0x00000000000000000000000000000000000a11ce";
const RELAYER = "0x0000000000000000000000000000000000000b0b";
const RECIPIENT = "0x0000000000000000000000000000000000000caf";
const FLOOR_ENFORCER = "0x0000000000000000000000000000000000000101";
const SALT = `0x${"11".repeat(32)}` as const;

describe("Runway exact delegation", () => {
  it("binds one exact execution to one relayer and the policy nonce", () => {
    const environment = getDelegationEnvironment(10_143);
    const execution = createNativeTransfer(RECIPIENT, parseEther("1"));
    const delegation = buildRunwayDelegation({
      chainId: 10_143,
      delegator: DELEGATOR,
      relayer: RELAYER,
      floorEnforcer: FLOOR_ENFORCER,
      policyNonce: 7n,
      expiry: 2_000_000_000,
      salt: SALT,
      execution,
    });

    expect(delegation.delegate).toBe(RELAYER);
    expect(delegation.delegator).toBe(DELEGATOR);
    expect(delegation.caveats).toHaveLength(5);
    expect(delegation.caveats.map(({ enforcer }) => enforcer)).toEqual([
      environment.caveatEnforcers.ExactExecutionEnforcer,
      environment.caveatEnforcers.LimitedCallsEnforcer,
      environment.caveatEnforcers.RedeemerEnforcer,
      environment.caveatEnforcers.TimestampEnforcer,
      FLOOR_ENFORCER,
    ]);

    const floorCaveat = delegation.caveats.at(-1);
    expect(floorCaveat).toBeDefined();
    const [nonce] = decodeAbiParameters(
      [{ type: "uint256" }],
      floorCaveat!.terms,
    );
    expect(nonce).toBe(7n);
  });

  it("encodes a direct DelegationManager redemption", () => {
    const execution = createNativeTransfer(RECIPIENT, parseEther("1"));
    const unsigned = buildRunwayDelegation({
      chainId: 10_143,
      delegator: DELEGATOR,
      relayer: RELAYER,
      floorEnforcer: FLOOR_ENFORCER,
      policyNonce: 1n,
      expiry: 2_000_000_000,
      salt: SALT,
      execution,
    });
    const calldata = encodeRunwayRedemption(
      attachSignature(unsigned, `0x${"22".repeat(65)}`),
      execution,
    );

    expect(calldata.slice(0, 10)).toBe(
      getFunctionSelector("redeemDelegations(bytes[],bytes32[],bytes[])"),
    );
  });
});
