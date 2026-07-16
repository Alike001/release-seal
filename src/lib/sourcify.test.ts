import { describe, expect, it } from "vitest";

import { interpretSourcifyResponse } from "./sourcify";

describe("Sourcify evidence mapping", () => {
  it("requires an exact runtime match for source verified", () => {
    expect(
      interpretSourcifyResponse(200, {
        match: "exact_match",
        runtimeMatch: "exact_match",
        verifiedAt: "2026-07-16T12:00:00Z",
        matchId: "123",
        proxyResolution: null,
      }),
    ).toMatchObject({
      state: "verified",
      runtimeMatch: "exact_match",
      proxyDetected: false,
    });
  });

  it("keeps absent verification separate from service failure", () => {
    expect(interpretSourcifyResponse(404, {})).toMatchObject({
      state: "not-verified",
    });
    expect(interpretSourcifyResponse(503, {})).toMatchObject({
      state: "unavailable",
    });
  });

  it("preserves proxy evidence without changing source state", () => {
    expect(
      interpretSourcifyResponse(200, {
        runtimeMatch: "exact_match",
        proxyResolution: {
          isProxy: true,
          proxyType: "EIP1967Proxy",
          implementations: ["0x1234"],
        },
      }),
    ).toMatchObject({ state: "verified", proxyDetected: true });

    expect(
      interpretSourcifyResponse(200, {
        runtimeMatch: "exact_match",
        proxyResolution: {
          isProxy: false,
          proxyType: null,
          implementations: [],
        },
      }),
    ).toMatchObject({ state: "verified", proxyDetected: false });
  });
});
