/**
 * The org this tab acts in. Each tab holds its own: only the org ID is kept, in
 * sessionStorage, so a reload stays on it.
 */
import {atom, computed, type WritableAtom} from "nanostores";
import {shared} from "../shared-runtime";
import type {OrgRefusal} from "./api/org-access-error";
import {GLOBAL_PREFIX} from "./constants";
import {clearPermissions} from "./permissionStore";
import {accessToken, expireAt, isLogged} from "./token-atoms";
import {isCurrentSignIn} from "./sign-in-cookies";
import {commit} from "./store-commit";
import {decodeOrgClaims} from "./utils/jwt";

/**
 * The org of this tab's access token. A tab whose org is refused has none, also
 * while it keeps a suspended org: orgRefusal names the org then.
 */
export interface OrgContext {
  orgId: string;
  /** The membership role, for display only. Authorize with permissions. */
  role: string;
}

const TAB_ORG_KEY = `${GLOBAL_PREFIX}_orgId`;
const TAB_REFUSAL_KEY = `${GLOBAL_PREFIX}_orgRefusal`;
const TAB_LEFT_ORG_KEY = `${GLOBAL_PREFIX}_leftOrg`;
const TAB_SIGN_IN_KEY = `${GLOBAL_PREFIX}_orgSignIn`;

// sessionStorage is missing during SSR and throws in sandboxed frames; the tab then keeps its org in memory only.
const withTabStorage = <T>(use: (storage: Storage) => T): T | undefined => {
  try {
    return use(sessionStorage);
  } catch {
    return undefined;
  }
};

const tabValue = (name: string, key: string): WritableAtom<string | undefined> =>
  shared(name, () => {
    const store = atom<string | undefined>(withTabStorage((storage) => storage.getItem(key)) ?? undefined);
    store.subscribe((value) => withTabStorage((storage) => (value ? storage.setItem(key, value) : storage.removeItem(key))));
    return store;
  });

/** The marker of the sign-in that everything this tab holds belongs to. */
export const tabSignIn: WritableAtom<string | undefined> = tabValue("tabSignIn", TAB_SIGN_IN_KEY);

/** The org this tab refreshes into. Unset until the tab gets its first token. */
export const tabOrgId: WritableAtom<string | undefined> = tabValue("tabOrgId", TAB_ORG_KEY);

const leftOrg = tabValue("leftOrg", TAB_LEFT_ORG_KEY);

/** Whether this signed-in tab needs another selection after leaving its org. */
export const orgSelectionRequired = shared("orgSelectionRequired", () =>
  computed([isLogged, leftOrg], (logged, orgId) => logged && Boolean(orgId))
);

export const getLeftOrg = (): string | undefined => leftOrg.get();

/**
 * A refusal of the tab's own org. A removal or deletion outlives a reload so
 * the tab does not fall back to the personal org.
 */
const refusalStore = shared("orgRefusal", () => {
  const stored = withTabStorage((storage) => JSON.parse(storage.getItem(TAB_REFUSAL_KEY) ?? "null") as OrgRefusal | null);
  const store = atom<OrgRefusal | undefined>(stored ?? undefined);
  store.subscribe((value) =>
    withTabStorage((storage) => (value ? storage.setItem(TAB_REFUSAL_KEY, JSON.stringify(value)) : storage.removeItem(TAB_REFUSAL_KEY)))
  );
  return store;
});

export const orgRefusal = shared("visibleOrgRefusal", () =>
  computed([isLogged, refusalStore], (logged, refusal) => (logged ? refusal : undefined))
);

export const getLostOrg = (): OrgRefusal | undefined => {
  const refusal = refusalStore.get();
  return refusal?.reason === "MEMBERSHIP_SUSPENDED" ? undefined : refusal;
};

export const orgContext: WritableAtom<OrgContext | undefined> = shared("orgContext", () => atom<OrgContext | undefined>(undefined));

/**
 * The org the user last worked in, as this tab's sign-in reported it. A hint:
 * the tab stays on the sign-in token's org until selectOrganization().
 */
export const lastActiveOrgId: WritableAtom<string | undefined> = shared("lastActiveOrgId", () => atom<string | undefined>(undefined));

/** The user and org the held permissions were resolved for. */
const permissionScope = shared("permissionScope", () => ({current: undefined as string | undefined}));

/** Moves the tab to the org a new access token is for. */
export const adoptTokenOrg = (accessToken: string): void => {
  const claims = decodeOrgClaims(accessToken);
  if (!claims) return;

  // The first token of a page load has no earlier scope to retire, and clearing
  // then would discard the permission request that asked for the token.
  const scope = `${claims.userId}:${claims.orgId}`;
  if (permissionScope.current !== undefined && permissionScope.current !== scope) clearPermissions();
  permissionScope.current = scope;

  refusalStore.set(undefined);
  leftOrg.set(undefined);
  tabOrgId.set(claims.orgId);
  orgContext.set({orgId: claims.orgId, role: claims.role});
};

/**
 * Has the next token empty the permissions even if it is for the same org: the
 * role may have changed. They are emptied before orgContext announces the token,
 * so a subscriber that resolves them then keeps its answer.
 */
export const retirePermissionScope = (): void => {
  permissionScope.current = "";
};

/** Leaves the tab without an org, as before its first token. */
export const forgetTabOrg = (): void => {
  permissionScope.current = undefined;
  refusalStore.set(undefined);
  leftOrg.set(undefined);
  tabOrgId.set(undefined);
  orgContext.set(undefined);
};

/** Keeps a voluntary departure distinct from an org the tab has never selected. */
export const leaveTabOrg = (orgId: string, signIn: string | undefined): void => {
  if ((tabOrgId.get() ?? getLostOrg()?.orgId) !== orgId || !isCurrentSignIn(signIn)) return;

  commit(() => {
    accessToken.set(undefined);
    expireAt.set(0);
    clearPermissions();
    forgetTabOrg();
    leftOrg.set(orgId);
  });
};

/**
 * Records that the tab's org refused it. The tab leaves an org it was removed
 * from, or that was deleted. A suspended membership can come back, so the tab
 * keeps that org for its next refresh.
 */
export const dropRefusedOrg = ({reason, orgId}: OrgRefusal): void =>
  // Heard of without the refusal, a cleared org reads as a tab that never had one, which uses the personal org.
  commit(() => {
    if (reason !== "MEMBERSHIP_SUSPENDED") forgetTabOrg();
    orgContext.set(undefined);
    clearPermissions();
    refusalStore.set({reason, orgId});
  });
