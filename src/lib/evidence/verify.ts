import { calculateBilling } from "./calculate";
import type { BillingInput, EvidenceChecks, EvidenceState } from "./types";

const requiredChecks: readonly (keyof EvidenceChecks)[] = [
  "chainMatches",
  "codeHashMatches",
  "signedCallMatches",
  "receiptMatchesTransaction",
  "eventMatchesCall",
  "probeBoundaryIsValid",
];

export function determineEvidenceState(
  checks: EvidenceChecks,
  billing: BillingInput,
): EvidenceState {
  if (!checks.transactionSucceeded) return "reverted";

  try {
    calculateBilling(billing);
  } catch {
    return "conflicting-evidence";
  }

  if (
    billing.effectiveGasPrice === undefined ||
    billing.probeWorkGas === undefined
  ) {
    return "cannot-verify";
  }

  if (requiredChecks.some((check) => !checks[check])) {
    return "conflicting-evidence";
  }

  return checks.blockFinalized ? "evidence-verified" : "pending";
}
