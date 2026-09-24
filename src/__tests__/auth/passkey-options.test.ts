import {describe, it, expect} from "vite-plus/test";
import {decodeRequestOptions} from "@/passkey";

// base64url-encoded values as the gateway sends them inside the options JSON.
const CHALLENGE = "N3XqkRt-xXNNyBhUQ86K97KnQgNmG5CtFjExqTvJCJg";
const CRED_ID = "vzlpZuyss8YqSTUHyaETmw";

function encodeEnvelope(publicKey: object): string {
  return btoa(JSON.stringify({publicKey}));
}

describe("decodeRequestOptions", () => {
  it("decodes a base64-encoded JSON envelope from the gateway", () => {
    const raw = encodeEnvelope({
      challenge: CHALLENGE,
      allowCredentials: [{type: "public-key", id: CRED_ID}],
      timeout: 300000,
    });

    const result = decodeRequestOptions(raw);

    expect(result.challenge).toBeInstanceOf(ArrayBuffer);
    expect(result.allowCredentials?.[0].id).toBeInstanceOf(ArrayBuffer);
    expect(result.timeout).toBe(300000);
  });

  it("accepts an already-parsed publicKey envelope", () => {
    const raw = {publicKey: {challenge: CHALLENGE, allowCredentials: []}};

    const result = decodeRequestOptions(raw);

    expect(result.challenge).toBeInstanceOf(ArrayBuffer);
    expect(result.allowCredentials).toEqual([]);
  });

  it("defaults allowCredentials to an empty array when absent", () => {
    const result = decodeRequestOptions(encodeEnvelope({challenge: CHALLENGE}));

    expect(result.allowCredentials).toEqual([]);
  });
});
