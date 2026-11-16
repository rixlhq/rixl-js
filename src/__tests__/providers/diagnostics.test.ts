import {describe, it, expect, vi} from "vite-plus/test";
import {logProviderExchangeFailure} from "../../auth/providers/diagnostics";
import {AuthProvider} from "../../auth/providers/types";

const base64url = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const unsignedJwt = (claims: object) => `${base64url({alg: "none"})}.${base64url(claims)}.`;

describe("logProviderExchangeFailure", () => {
  it("prints array and object claims as JSON, not [object Object]", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const token = unsignedJwt({iss: {url: "https://accounts.google.com"}, aud: ["web", "ios"], nonce: "n-1", email: "a@b.c"});

    logProviderExchangeFailure(AuthProvider.GOOGLE, token, new Error("401"));

    const [, details] = error.mock.calls[0] as [string, {request: {credential: Record<string, string>}}];
    expect(details.request.credential).toMatchObject({
      iss: '{"url":"https://accounts.google.com"}',
      aud: '["web","ios"]',
      nonce: "n-1",
      email: "a@b.c",
    });
  });
});
