import {describe, it, expect, beforeEach} from "vite-plus/test";
import {clearPkceVerifier, getPkceVerifier, pkceChallenge} from "@/pkce";

describe("PKCE", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("derives the RFC 7636 S256 challenge", async () => {
    await expect(pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).resolves.toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("keeps the same verifier until it is cleared", () => {
    const verifier = getPkceVerifier("telegram");

    expect(getPkceVerifier("telegram")).toBe(verifier);
    clearPkceVerifier("telegram");
    expect(getPkceVerifier("telegram")).not.toBe(verifier);
  });

  it("generates a URL-safe verifier of at least 43 characters", () => {
    expect(getPkceVerifier("telegram")).toMatch(/^[A-Za-z0-9_-]{43,}$/);
  });
});
