export enum DomainStatus {
  PENDING = "pending",
  VERIFIED = "verified",
}

export interface DomainResponse {
  present?: boolean;
  id: string;
  domain: string;
  /** Unset when the gateway response has no resolved state. */
  status?: DomainStatus;
  verification_token?: string;
  expires_at?: string;
  verified_at?: string;
  suggest_join?: boolean;
}

export interface SuggestJoinSetting {
  enabled: boolean;
  present?: boolean;
}
