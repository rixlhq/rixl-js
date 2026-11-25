// Browser code: the SDK keeps the sign-in in cookies and each tab's org in
// sessionStorage. It is type-checked here, not run with the other examples.
// console.log stands in for your UI.
import {
  ApiError,
  OrgAccessError,
  connect,
  getOrganization,
  getToken,
  isLogged,
  lastActiveOrgId,
  listOrganizations,
  logout,
  orgContext,
  orgRefusal,
  orgSelectionRequired,
  personalOrgId,
  resolvePermissions,
  selectOrganization,
  updateOrganization,
  type OrgRefusal,
  type WireErrorBody,
} from "@rixl/sdk";

function explain(error: unknown): void {
  if (!(error instanceof OrgAccessError)) {
    // Every other API rejection is an ApiError; `data` is the gateway's error body.
    if (error instanceof ApiError) console.warn(error.status, (error.data as WireErrorBody | undefined)?.error);
    throw error;
  }
  // MEMBERSHIP_SUSPENDED, ORG_DELETED or NOT_A_MEMBER. The user stays signed in.
  console.warn(`Organization ${error.orgId} is unavailable: ${error.reason}`);
}

// Switching and loading permissions fail separately: after a switch the tab is
// on the new org, whether or not its permissions have loaded.
export type OpenResult = "signed-out" | "not-switched" | "ready" | "permissions-pending";

/**
 * Loads the permissions of the tab's org. Until it succeeds every check denies,
 * so show a retry that calls it again.
 *
 * @returns Whether they loaded
 */
export async function loadPermissions(): Promise<boolean> {
  try {
    await resolvePermissions();
    return true;
  } catch (error) {
    // An OrgAccessError also sets orgRefusal, which shows its own screen.
    console.warn("Couldn't load permissions. [Retry]", error);
    return false;
  }
}

/** Switches this tab to `orgId`. Other tabs keep their own org. */
export async function openOrganization(orgId: string): Promise<OpenResult> {
  try {
    await selectOrganization(orgId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return "signed-out";
    explain(error);
    return "not-switched";
  }
  // The switch is done: show the new org from here on, whatever happens next.
  console.log(`This tab is on ${orgId}`);
  // Switching empties the permissions, which belong to the tab's org.
  return (await loadPermissions()) ? "ready" : "permissions-pending";
}

/** The suspension screen's "Try again": a suspended tab keeps its org and refreshes into it. */
export async function retrySuspendedOrg(): Promise<OpenResult> {
  try {
    if (!(await getToken())) return "signed-out";
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return "signed-out";
    explain(error);
    return "not-switched";
  }
  return (await loadPermissions()) ? "ready" : "permissions-pending";
}

/** "Go to my account", and the way back for a tab that lost its org. The SDK never picks an org for you. */
export async function openPersonalOrganization(): Promise<OpenResult> {
  const personal = personalOrgId.get();
  return personal ? openOrganization(personal) : "not-switched";
}

// orgRefusal is set while the tab's org refuses it, and orgContext is empty then.
// Only render from this subscription: a request or refresh in here would be
// refused again and call it again.
function showRefusal(refusal: OrgRefusal | undefined): void {
  if (refusal?.reason === "MEMBERSHIP_SUSPENDED") {
    console.log(`Your membership in ${refusal.orgId} is suspended. [Try again] [Go to my account]`);
  } else if (refusal) {
    console.log(`You can't use ${refusal.orgId} any more (${refusal.reason}). [Go to my account]`);
  } else {
    console.log("Dismiss org refusal screen");
  }
}

/**
 * One page of the org picker. It needs a usable token: from a refused tab, call
 * openPersonalOrganization() first.
 *
 * @returns The token of the next page for "Load more", empty on the last page
 */
export async function showOrganizationPage(pageToken = ""): Promise<string> {
  const {organizations, next_page_token} = await listOrganizations({page_size: 25, page_token: pageToken || undefined});
  for (const {organization, role, state} of organizations) {
    console.log(organization.name, role, state, organization.id === orgContext.get()?.orgId ? "(this tab)" : "");
  }
  if (next_page_token) console.log("[Load more]");
  return next_page_token;
}

/** Reads and renames the tab's org. A route that names an org needs a token for it, so select the org first. */
export async function renameCurrentOrganization(name: string): Promise<void> {
  const orgId = orgContext.get()?.orgId;
  if (!orgId) return;

  const current = await getOrganization(orgId);
  if (current.name === name) return;

  // Only the fields you pass change.
  const updated = await updateOrganization(orgId, {name});
  console.log(`Renamed ${current.name} to ${updated.name}`);
}

/** @returns Whether the tab has a token */
async function connectTab(): Promise<boolean> {
  try {
    // Resolves after a first getToken(), which can reject for the tab's org.
    await connect({baseUrl: "https://api.rixl.com", auth: {}});
    return isLogged.get();
  } catch (error) {
    // A refresh token auth-api refused: the SDK has signed out, so show your sign-in page.
    if (error instanceof ApiError && error.status === 401) return false;

    explain(error);
    // The refusal screen offers a deliberate switch to the personal org.
    return false;
  }
}

/** Ends the browser sign-in and reports whether the server acknowledged the request. */
export async function signOut(): Promise<void> {
  const {revoked} = await logout();
  if (!revoked) console.warn("Auth-api did not acknowledge sign-out");
}

export async function start(): Promise<void> {
  isLogged.listen((logged) => {
    if (!logged) console.log("Show sign-in"); // Includes sign-out from another tab.
  });
  orgRefusal.subscribe(showRefusal);
  if (!(await connectTab())) return;
  if (orgSelectionRequired.get()) {
    console.log("Choose another organization. [Go to my account]");
    // The button calls openPersonalOrganization(). Its token can then list the picker.
    return;
  }

  // Read this in-memory hint immediately after sign-in.
  const hint = lastActiveOrgId.get();
  if (hint && hint !== orgContext.get()?.orgId) await openOrganization(hint);

  await showOrganizationPage();
}
