import type { Address, Hex } from "viem";

export type ArtifactEvidence = {
  filename: string;
  artifactFileHash: Hex;
  runtime: Hex;
  runtimeHash: Hex;
  runtimeBytes: number;
  compilationTarget?: string;
  compilerVersion?: string;
  optimizer?: string;
};

export type ArtifactErrorCode =
  | "file-too-large"
  | "invalid-utf8"
  | "malformed-json"
  | "missing-runtime"
  | "invalid-runtime"
  | "linked-libraries"
  | "immutable-references";

export type ArtifactParseResult =
  | { ok: true; value: ArtifactEvidence }
  | {
      ok: false;
      error: { code: ArtifactErrorCode; message: string };
    };

export type RuntimeComparison =
  | {
      outcome: "exact";
      expectedRuntimeHash: Hex;
      observedRuntimeHash: Hex;
      expectedBytes: number;
      observedBytes: number;
    }
  | {
      outcome: "differs";
      expectedRuntimeHash: Hex;
      observedRuntimeHash: Hex;
      expectedBytes: number;
      observedBytes: number;
      firstDifferenceOffset: number;
    }
  | {
      outcome: "no-code";
      expectedRuntimeHash: Hex;
      expectedBytes: number;
    };

export type SourcifyState = "verified" | "not-verified" | "unavailable";

export type SourcifyEvidence = {
  state: SourcifyState;
  match: string | null;
  runtimeMatch: string | null;
  verifiedAt: string | null;
  matchId: string | null;
  proxyDetected: boolean;
  detail: string;
};

export type LiveComparison = {
  address: Address;
  runtime: RuntimeComparison;
  source: SourcifyEvidence;
};
