import { keccak256, type Hex } from "viem";

import type {
  ArtifactErrorCode,
  ArtifactEvidence,
  ArtifactParseResult,
} from "./release-seal-types";

export const MAX_ARTIFACT_BYTES = 5 * 1024 * 1024;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetadata(value: unknown, rawValue: unknown) {
  if (isRecord(value)) return value;

  const candidate = typeof value === "string" ? value : rawValue;
  if (typeof candidate !== "string") return undefined;

  try {
    const parsed: unknown = JSON.parse(candidate);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function hasReferences(value: unknown) {
  return isRecord(value) && Object.keys(value).length > 0;
}

function readCompilationTarget(metadata: UnknownRecord | undefined) {
  if (!metadata || !isRecord(metadata.settings)) return undefined;
  const target = metadata.settings.compilationTarget;
  if (!isRecord(target)) return undefined;
  const [entry] = Object.entries(target);
  return entry ? `${entry[0]}:${String(entry[1])}` : undefined;
}

function readCompilerVersion(metadata: UnknownRecord | undefined) {
  if (!metadata || !isRecord(metadata.compiler)) return undefined;
  return typeof metadata.compiler.version === "string"
    ? metadata.compiler.version
    : undefined;
}

function readOptimizer(metadata: UnknownRecord | undefined) {
  if (!metadata || !isRecord(metadata.settings)) return undefined;
  const optimizer = metadata.settings.optimizer;
  if (!isRecord(optimizer) || typeof optimizer.enabled !== "boolean") {
    return undefined;
  }
  if (!optimizer.enabled) return "DISABLED";
  return typeof optimizer.runs === "number"
    ? `ENABLED · ${optimizer.runs.toLocaleString("en-US")} RUNS`
    : "ENABLED";
}

function failure(
  code: ArtifactErrorCode,
  message: string,
): ArtifactParseResult {
  return { ok: false, error: { code, message } };
}

export function normalizeRuntimeBytecode(value: string): Hex | undefined {
  const withoutPrefix = value.startsWith("0x") ? value.slice(2) : value;
  if (
    withoutPrefix.length === 0 ||
    withoutPrefix.length % 2 !== 0 ||
    !/^[0-9a-fA-F]+$/.test(withoutPrefix)
  ) {
    return undefined;
  }
  return `0x${withoutPrefix.toLowerCase()}` as Hex;
}

export function parseFoundryArtifact(
  bytes: Uint8Array,
  filename: string,
): ArtifactParseResult {
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
    return failure(
      "file-too-large",
      "The artifact is larger than the 5 MB local parsing limit.",
    );
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return failure("invalid-utf8", "The artifact is not valid UTF-8 text.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return failure("malformed-json", "The selected file is not valid JSON.");
  }

  if (!isRecord(parsed) || !isRecord(parsed.deployedBytecode)) {
    return failure(
      "missing-runtime",
      "The artifact has no deployedBytecode object to compare.",
    );
  }

  const deployedBytecode = parsed.deployedBytecode;
  if (hasReferences(deployedBytecode.linkReferences)) {
    return failure(
      "linked-libraries",
      "This build contains linked-library references. ReleaseSeal will not guess the deployed addresses.",
    );
  }
  if (hasReferences(deployedBytecode.immutableReferences)) {
    return failure(
      "immutable-references",
      "This build contains immutable runtime transformations that the first release does not normalize.",
    );
  }
  if (typeof deployedBytecode.object !== "string") {
    return failure(
      "missing-runtime",
      "The artifact has no deployed runtime bytecode.",
    );
  }

  const runtime = normalizeRuntimeBytecode(deployedBytecode.object);
  if (!runtime) {
    return failure(
      "invalid-runtime",
      "The deployed runtime must be non-empty, even-length hexadecimal bytecode.",
    );
  }

  const metadata = parseMetadata(parsed.metadata, parsed.rawMetadata);
  const value: ArtifactEvidence = {
    filename,
    artifactFileHash: keccak256(bytes),
    runtime,
    runtimeHash: keccak256(runtime),
    runtimeBytes: (runtime.length - 2) / 2,
    compilationTarget: readCompilationTarget(metadata),
    compilerVersion: readCompilerVersion(metadata),
    optimizer: readOptimizer(metadata),
  };

  return { ok: true, value };
}
