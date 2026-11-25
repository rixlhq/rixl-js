export enum DomainStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  EXPIRED = "expired",
}

export interface DomainResponse {
  present?: boolean;
  id: string;
  domain: string;
  /**
   * `undefined` when the gateway response omits the `status` object entirely
   * (e.g. a domain record without a resolved state). Concrete values are
   * `PENDING` or `VERIFIED`; the SDK never returns `EXPIRED` today but it is
   * kept on the enum for forward compatibility with future backend states.
   */
  status?: DomainStatus;
  verification_token?: string;
  expires_at?: string;
  verified_at?: string;
  suggest_join?: boolean;
}

export interface AddDomainRequest {
  domain: string;
}

export interface UpdateSuggestJoinRequest {
  enabled: boolean;
}

export interface SuggestJoinSetting {
  enabled: boolean;
  present?: boolean;
}
