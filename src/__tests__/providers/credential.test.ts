import {describe, it, expect} from "vite-plus/test";
import {credentialFields} from "@/providers/credential";

describe("credentialFields", () => {
  it("sends a token on its own", () => {
    expect(credentialFields({token: "id-token"})).toEqual({token: "id-token"});
  });

  it("sends an authorization code with its verifier and redirect URI", () => {
    expect(
      credentialFields({authorizationCode: {code: "auth-code", codeVerifier: "verifier", redirectUri: "https://app.example.com/login"}})
    ).toEqual({token: "auth-code", code_verifier: "verifier", redirect_uri: "https://app.example.com/login"});
  });
});
