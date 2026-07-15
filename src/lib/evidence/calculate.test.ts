import { describe, expect, it } from "vitest";

import { calculateBilling } from "./calculate";
import { determineEvidenceState } from "./verify";

const evidence = {
  chainMatches: true,
  codeHashMatches: true,
  signedCallMatches: true,
  receiptMatchesTransaction: true,
  eventMatchesCall: true,
  probeBoundaryIsValid: true,
  transactionSucceeded: true,
  blockFinalized: true,
};

describe("Gas Mirror billing calculation", () => {
  it("bills the signed limit and computes only deterministic deltas", () => {
    expect(
      calculateBilling({
        rpcEstimateGas: 82_410n,
        signedGasLimit: 110_000n,
        receiptGasUsed: 110_000n,
        effectiveGasPrice: 17n,
        probeWorkGas: 50_000n,
      }),
    ).toEqual({
      billedGas: 110_000n,
      billedFeeWei: 1_870_000n,
      gasAboveEstimate: 27_590n,
      feeAboveEstimateWei: 469_030n,
      receiptMatchesSignedLimit: true,
    });
  });

  it("rejects a receipt that exceeds the signed limit", () => {
    expect(() =>
      calculateBilling({ signedGasLimit: 10n, receiptGasUsed: 11n }),
    ).toThrow("Receipt gas exceeds");
  });

  it("withholds verification until finality and all required evidence exist", () => {
    const billing = {
      signedGasLimit: 110_000n,
      receiptGasUsed: 110_000n,
      effectiveGasPrice: 17n,
      probeWorkGas: 50_000n,
    };

    expect(
      determineEvidenceState({ ...evidence, blockFinalized: false }, billing),
    ).toBe("pending");
    expect(
      determineEvidenceState({ ...evidence, eventMatchesCall: false }, billing),
    ).toBe("conflicting-evidence");
    expect(
      determineEvidenceState(evidence, {
        ...billing,
        effectiveGasPrice: undefined,
      }),
    ).toBe("cannot-verify");
  });
});
