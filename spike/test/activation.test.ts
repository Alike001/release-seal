import { describe, expect, it } from "vitest";

import {
  classifyActivation,
  expectedDelegationCode,
} from "../src/activation.js";

const IMPLEMENTATION = "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B";

describe("EIP-7702 activation classification", () => {
  it("recognizes an inactive EOA", () => {
    expect(classifyActivation(undefined, IMPLEMENTATION)).toBe("inactive");
    expect(classifyActivation("0x", IMPLEMENTATION)).toBe("inactive");
  });

  it("recognizes the pinned Stateless DeleGator implementation", () => {
    expect(
      classifyActivation(
        expectedDelegationCode(IMPLEMENTATION),
        IMPLEMENTATION,
      ),
    ).toBe("runway-ready");
  });

  it("rejects unrelated account code", () => {
    expect(classifyActivation("0x60006000", IMPLEMENTATION)).toBe(
      "incompatible",
    );
  });
});
