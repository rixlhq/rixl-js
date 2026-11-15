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
} from "./authStore";

export {logout} from "./auth/logout";

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
  listPendingMemberships,
  updateActiveMembership,
  listOrganizationMembers,
  inviteMember,
  updateMemberRole,
  deleteMember,
  MembershipRole,
  type AssignableRole,
  MembershipState,
  respondToInvitation,
  resendMemberInvite,
  publicRespondToInvitation,
  type Member,
  type Membership,
  type MembershipApplication,
  type InviteMemberRequest,
  type UpdateMemberRoleRequest,
  type ResendInviteMemberRequest,
} from "./membership";

export {
  updateFullName,
  updateUsername,
  getUserInfo,
  verifyUserOTP,
  setupUserOTP,
  deleteUserOTP,
  getOTPStatus,
  regenerateBackupCodes,
  type OTPSetup,
  type OTPStatusResponse,
  type BackupCodes,
  type UserInfo,
} from "./user";
export {updateOrgName, updateOrgUsername} from "./organization";

export {listSocials, connectSocial, disconnectSocial, type ConnectedProvider, type ProviderType} from "./social/socialConnections";

export {
  registerWithEmail,
  loginWithEmail,
  verifyTOTPForLogin,
  resendEmailVerificationCode,
  initiateEmailChange,
  addEmail,
  verifyEmailWithCode,
  getEmailVerificationStatus,
  sendPasswordResetEmail,
  confirmPasswordReset,
  type VerifyStatusResponse,
  type RegistrationResponse,
  type VerificationSentResponse,
  type LoginOTPVerifyRequest,
  type LoginErrorResponse,
  type LoginErrorCode,
  type OAuth2ErrorResponse,
  type TwoFactorResponse,
  type TwoFactorAuthMethod,
} from "./auth";

// Domain verification exports
export {
  getDomainStatus,
  initiateDomainVerification,
  checkDomainVerification,
  updateAutoJoin,
  removeDomain,
  DomainStatus,
  type DomainResponse,
  type AddDomainRequest,
  type UpdateAutoJoinRequest,
  type AutoJoinSetting,
} from "./domain";

export {getBlogSubscriptionStatus, subscribeToBlog, unsubscribeFromBlog, type BlogSubscriptionStatus} from "./blog";

export {
  beginPasskeyLogin,
  beginPasskeyRegistration,
  decodeRequestOptions,
  deletePasskey,
  finishPasskeyLogin,
  finishPasskeyRegistration,
  listPasskeys,
  PasskeyUnavailableError,
  renamePasskey,
  verifyPasskeyForLogin,
  type Passkey,
  type PasskeyBeginLogin,
  type PasskeyBeginRegistration,
  type PasskeyRegistrationResult,
} from "./passkey";

export {permissions, permissionsResolved, hasPermission, clearPermissions} from "./permissionStore";
export {resolvePermissions, ensurePermissions, invalidatePermissions} from "./permissions/resolve";
export {READ_VERBS, WRITE_VERBS, matches as matchesPermission} from "./permissions/matcher";
