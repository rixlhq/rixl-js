import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {setupAuthTest, cleanupAuthMocks} from "../utils/auth-test-helpers";

const mockVerifyPasskey = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1PasskeyServiceVerifyPasskeyForLogin: (...args: unknown[]) => mockVerifyPasskey(...args),
}));

import {verifyPasskeyForLogin} from "@/passkey";

function fakeAssertionCredential(): PublicKeyCredential {
  const buf = (n: number) => new Uint8Array([n, n + 1, n + 2]).buffer;
  return {
    id: "cred-id",
    type: "public-key",
    rawId: buf(1),
    response: {
      authenticatorData: buf(4),
      clientDataJSON: buf(7),
      signature: buf(10),
      userHandle: null,
    },
  } as unknown as PublicKeyCredential;
}

describe("verifyPasskeyForLogin", () => {
  let mocks: ReturnType<typeof setupAuthTest>;

  beforeEach(() => {
    mocks = setupAuthTest();
    mockVerifyPasskey.mockReset();
    mockVerifyPasskey.mockResolvedValue({
      data: {access_token: "at", refresh_token: "rt", expires_in: 3600},
    });
  });

  afterEach(() => cleanupAuthMocks(mocks));

  it("sends the credential as a base64-encoded JSON string", async () => {
    await verifyPasskeyForLogin("session-1", fakeAssertionCredential());

    const body = mockVerifyPasskey.mock.calls[0][0].body;
    expect(body.session_id).toBe("session-1");
    expect(typeof body.credential).toBe("string");

    const decoded = JSON.parse(atob(body.credential));
    expect(decoded.id).toBe("cred-id");
    expect(decoded.type).toBe("public-key");
    expect(typeof decoded.response.signature).toBe("string");
  });
});
