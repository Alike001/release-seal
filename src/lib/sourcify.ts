import type { Address } from "viem";

import { monadChain } from "./chain";
import type { SourcifyEvidence } from "./release-seal-types";

const SOURCIFY_API = "https://sourcify-api-monad.blockvision.org";
const SOURCE_TIMEOUT_MS = 8_000;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOrNull(value: unknown) {
  return typeof value === "string" ? value : null;
}

function hasProxyResolution(value: unknown) {
  if (!isRecord(value)) return false;
  if (typeof value.isProxy === "boolean") return value.isProxy;
  if (Array.isArray(value.implementations)) {
    return value.implementations.length > 0;
  }
  return typeof value.proxyType === "string" && value.proxyType.length > 0;
}

export function interpretSourcifyResponse(
  status: number,
  body: unknown,
): SourcifyEvidence {
  if (status === 404) {
    return {
      state: "not-verified",
      match: null,
      runtimeMatch: null,
      verifiedAt: null,
      matchId: null,
      proxyDetected: false,
      detail: "Sourcify has no verified runtime for this address.",
    };
  }
  if (status < 200 || status >= 300 || !isRecord(body)) {
    return unavailableEvidence();
  }

  const runtimeMatch = stringOrNull(body.runtimeMatch);
  const verified = runtimeMatch === "exact_match";
  return {
    state: verified ? "verified" : "not-verified",
    match: stringOrNull(body.match),
    runtimeMatch,
    verifiedAt: stringOrNull(body.verifiedAt),
    matchId: stringOrNull(body.matchId),
    proxyDetected: hasProxyResolution(body.proxyResolution),
    detail: verified
      ? "Sourcify reports an exact runtime match."
      : "Sourcify does not report an exact runtime match.",
  };
}

export function unavailableEvidence(): SourcifyEvidence {
  return {
    state: "unavailable",
    match: null,
    runtimeMatch: null,
    verifiedAt: null,
    matchId: null,
    proxyDetected: false,
    detail: "Sourcify could not be reached. Runtime comparison is unaffected.",
  };
}

export async function fetchSourcifyEvidence(
  address: Address,
  fetcher: typeof fetch = fetch,
): Promise<SourcifyEvidence> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    SOURCE_TIMEOUT_MS,
  );
  const url = `${SOURCIFY_API}/v2/contract/${monadChain.id}/${address}?fields=all`;

  try {
    const response = await fetcher(url, {
      headers: { accept: "application/json" },
      signal: controller.signal,
    });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }
    return interpretSourcifyResponse(response.status, body);
  } catch {
    return unavailableEvidence();
  } finally {
    globalThis.clearTimeout(timeout);
  }
}
