import type { BillingCalculation, BillingInput } from "./types";

export function calculateBilling(input: BillingInput): BillingCalculation {
  if (input.signedGasLimit < 0n || input.receiptGasUsed < 0n) {
    throw new Error("Gas values cannot be negative.");
  }

  if (input.receiptGasUsed > input.signedGasLimit) {
    throw new Error("Receipt gas exceeds the signed gas limit.");
  }

  const gasAboveEstimate =
    input.rpcEstimateGas === undefined
      ? undefined
      : input.signedGasLimit > input.rpcEstimateGas
        ? input.signedGasLimit - input.rpcEstimateGas
        : 0n;

  return {
    billedGas: input.signedGasLimit,
    billedFeeWei:
      input.effectiveGasPrice === undefined
        ? undefined
        : input.signedGasLimit * input.effectiveGasPrice,
    gasAboveEstimate,
    feeAboveEstimateWei:
      gasAboveEstimate === undefined || input.effectiveGasPrice === undefined
        ? undefined
        : gasAboveEstimate * input.effectiveGasPrice,
    receiptMatchesSignedLimit: input.receiptGasUsed === input.signedGasLimit,
  };
}
