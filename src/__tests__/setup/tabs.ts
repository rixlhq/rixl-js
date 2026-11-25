/**
 * Browser tabs for tests: each is its own copy of the SDK with its own
 * sessionStorage, and all share the cookie jar. A test file using them mocks
 * "../../generated/sdk.gen", and "../../auth/api/types" with one module, so an
 * error from the fake server passes every tab's instanceof checks.
 */
import {vi} from "vite-plus/test";
import {resetSharedRuntime} from "./shared-runtime-reset";

/** The channel tabs announce a sign-out on. */
export const LOGOUT_CHANNEL = "__rixl_auth_logout";

export const createTabStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, String(value)),
    removeItem: (key) => void values.delete(key),
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
};

/** Loads the SDK as a page load would. Passing a tab's storage again reloads that tab. */
export const openTab = async (storage = createTabStorage()) => {
  resetSharedRuntime();
  vi.resetModules();
  vi.stubGlobal("sessionStorage", storage);

  const auth = await import("../../auth/authStore");
  const tokens = await import("../../auth/api/tokens");
  const org = await import("../../auth/tab-org");
  const permissions = await import("../../auth/permissionStore");
  const resolve = await import("../../auth/permissions/resolve");
  const errors = await import("../../auth/api/org-access-error");
  const login = await import("../../auth/auth/login");
  const users = await import("../../auth/userStore");
  const cookies = await import("../../auth/sign-in-cookies");
  const stored = await import("../../auth/stored-sign-in");
  const {verifyUserOTP} = await import("../../auth/user");
  const {connectSocialInternal} = await import("../../auth/social/socialConnections");
  const signOut = await import("../../auth/auth/logout");
  (await import("../../auth/initialization")).initDeferred.resolve();

  const persistTestReissue = (data: {access_token: string; refresh_token: string; expires_in: number}) => {
    const orgId = org.tabOrgId.get()!;
    return tokens.persistRotatedTokens(data, {
      signIn: cookies.signInMarker.get(),
      orgId,
      tabOrg: orgId,
    });
  };

  return {
    storage,
    /** Switches the global sessionStorage to this tab before using it. */
    use: () => {
      vi.stubGlobal("sessionStorage", storage);
      return {
        ...auth,
        ...tokens,
        ...org,
        ...permissions,
        ...resolve,
        ...errors,
        ...login,
        ...users,
        ...signOut,
        ...cookies,
        ...stored,
        verifyUserOTP,
        connectSocialInternal,
        persistTestReissue,
      };
    },
  };
};

export type Tab = Awaited<ReturnType<typeof openTab>>;

/** Collects what other tabs announce, from a channel of its own. */
export const listenForLogout = () => {
  const channel = new BroadcastChannel(LOGOUT_CHANNEL);
  const heard: unknown[] = [];
  channel.addEventListener("message", (event) => heard.push(event.data));
  return {
    /** For asserting silence: what was announced, once delivery has had time to happen. */
    announced: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return heard;
    },
    close: () => channel.close(),
  };
};
