import {describe, it, expect, beforeEach, afterEach, vi} from "vite-plus/test";
import {setupAuthTest, cleanupAuthMocks} from "../utils/auth-test-helpers";

const mockListPasskeys = vi.fn();

vi.mock("../../generated/sdk.gen", () => ({
  authV1PasskeyServiceListPasskeys: (...args: unknown[]) => mockListPasskeys(...args),
}));

import {listPasskeys} from "@/passkey";

// Wire shape: the gateway sends passkeys in snake_case.
const wirePasskey = (overrides: Record<string, unknown> = {}) => ({
  id: "P0tNO3eQMK",
  name: "Chrome on macOS",
  credential_id: "T8jew8CN5NuvOgWOAqe9UXl8l4Q",
  aaguid: "-_wwBxVOTsyMC24CBVfXvQ",
  transports: [],
  backup_state: true,
  created_at: "2026-07-23T10:03:39.214495Z",
  last_used_at: "2026-07-23T15:01:35.675882Z",
  ...overrides,
});

describe("listPasskeys", () => {
  let mocks: ReturnType<typeof setupAuthTest>;

  beforeEach(() => {
    mocks = setupAuthTest();
    mockListPasskeys.mockReset();
  });

  afterEach(() => cleanupAuthMocks(mocks));

  it("maps the snake_case wire passkey to the public shape", async () => {
    mockListPasskeys.mockResolvedValue({data: {passkeys: [wirePasskey()]}});

    const result = await listPasskeys();

    expect(result).toEqual([
      {
        id: "P0tNO3eQMK",
        name: "Chrome on macOS",
        credential_id: "T8jew8CN5NuvOgWOAqe9UXl8l4Q",
        aaguid: "-_wwBxVOTsyMC24CBVfXvQ",
        backup_state: true,
        created_at: "2026-07-23T10:03:39.214495Z",
        last_used_at: "2026-07-23T15:01:35.675882Z",
        transports: [],
      },
    ]);
  });

  it("returns an empty array when the account has no passkeys", async () => {
    mockListPasskeys.mockResolvedValue({data: {passkeys: []}});

    expect(await listPasskeys()).toEqual([]);
  });
});
