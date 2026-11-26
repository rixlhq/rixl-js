// Auth state exports
export {
  isLogged,
  getToken,
  login,
  authError,
  clearAuthError,
  requiresAction,
  limitedAccessToken,
  setLimitedAccessState,
  clearLimitedAccessState,
  selectOrganization,
} from "./authStore";

export {personalOrgId} from "./sign-in-cookies";

export {orgContext, orgRefusal, orgSelectionRequired, lastActiveOrgId, type OrgContext} from "./tab-org";
export {OrgAccessError, type OrgAccessReason, type OrgRefusal} from "./api/org-access-error";
export {ApiError, type ApiErrorContext, type WireErrorBody} from "./api/types";

export {logout, type LogoutResult} from "./auth/logout";

export {user} from "./userStore";

// Type exports
export type {User, TokenResponse, LimitedScopeTokenResponse, RequiresAction} from "./types";

// Initialization exports
export {initClient, type AuthClientConfig} from "./init";

// Provider exports
export {type GoogleProviderConfig, type AppleProviderConfig, type TelegramProviderConfig, type GitHubProviderConfig} from "./providers";

export {
  leaveOrganization,
  listActiveMemberships,
  listOrganizationMembers,
  updateMemberRole,
  MembershipRole,
  type AssignableRole,
  MembershipState,
  listMyInvitations,
  listOrganizationInvitations,
  lookupInvitation,
  createInvitation,
  resendInvitation,
  acceptInvitation,
  type Member,
  type Membership,
  type Invitation,
  type InvitationList,
  type InvitationLookup,
  type InvitationPageParams,
  type InvitationState,
  type ListInvitationsParams,
} from "./membership";

export {
  updateFullName,
  getUserInfo,
  verifyUserOTP,
  setupUserOTP,
  getOTPStatus,
  regenerateBackupCodes,
  type OTPSetup,
  type OTPStatusResponse,
  type BackupCodes,
  type UserInfo,
} from "./user";
export {
  getOrganization,
  listOrganizations,
  updateOrganization,
  type Organization,
  type OrganizationMembership,
  type OrganizationList,
  type ListOrganizationsParams,
  type OrganizationUpdate,
} from "./organization";

export {listSocials, connectSocial, disconnectSocial, type ConnectedProvider, type ProviderType} from "./social/socialConnections";

export {
  registerWithEmail,
  loginWithEmail,
  verifyTOTPForLogin,
  resendEmailVerificationCode,
  initiateEmailChange,
  addEmail,
  verifyEmailWithCode,
  verifyEmailChange,
  getEmailVerificationStatus,
  sendPasswordResetEmail,
  confirmPasswordReset,
  type VerifyStatusResponse,
  type VerifyEmailResponse,
  type VerifyEmailWithCodeParams,
  type RegistrationResponse,
  type VerificationSentResponse,
  type LoginErrorResponse,
  type LoginErrorCode,
  type TwoFactorResponse,
  type TwoFactorAuthMethod,
} from "./auth";

// Domain verification exports
export {
  getDomainStatus,
  initiateDomainVerification,
  checkDomainVerification,
  updateSuggestJoin,
  DomainStatus,
  type DomainResponse,
  type SuggestJoinSetting,
} from "./domain";

export {getBlogSubscriptionStatus, type BlogSubscriptionStatus} from "./blog";

export {
  beginPasskeyLogin,
  beginPasskeyRegistration,
  decodeRequestOptions,
  finishPasskeyLogin,
  finishPasskeyRegistration,
  listPasskeys,
  PasskeyUnavailableError,
  verifyPasskeyForLogin,
  type Passkey,
  type PasskeyBeginLogin,
  type PasskeyBeginRegistration,
  type PasskeyRegistrationResult,
} from "./passkey";

export {permissions, permissionsResolved, hasPermission, clearPermissions} from "./permissionStore";
export {resolvePermissions, ensurePermissions, invalidatePermissions} from "./permissions/resolve";
export {READ_VERBS, WRITE_VERBS, matches as matchesPermission} from "./permissions/matcher";
