export type EvidenceState =
  | "pending"
  | "evidence-verified"
  | "cannot-verify"
  | "conflicting-evidence"
  | "reverted"
  | "replaced";

export type BillingInput = {
  rpcEstimateGas?: bigint;
  signedGasLimit: bigint;
  receiptGasUsed: bigint;
  effectiveGasPrice?: bigint;
  probeWorkGas?: bigint;
};

export type BillingCalculation = {
  billedGas: bigint;
  billedFeeWei?: bigint;
  gasAboveEstimate?: bigint;
  feeAboveEstimateWei?: bigint;
  receiptMatchesSignedLimit: boolean;
};

export type EvidenceChecks = {
  chainMatches: boolean;
  codeHashMatches: boolean;
  signedCallMatches: boolean;
  receiptMatchesTransaction: boolean;
  eventMatchesCall: boolean;
  probeBoundaryIsValid: boolean;
  transactionSucceeded: boolean;
  blockFinalized: boolean;
};
