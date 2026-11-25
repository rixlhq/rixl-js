import type {AuthV1DomainResponse, AuthV1SuggestJoinSetting} from "../../generated/types.gen";
import {DomainStatus, type DomainResponse, type SuggestJoinSetting} from "./types";

// DomainStatus holds at most one of pending and verified, plus a shared
// suggest_join flag; flatten it into the library's DomainResponse. When the
// gateway omits `status` entirely we leave the flattened `status` field
// undefined instead of defaulting to PENDING — the two states carry very
// different meanings and PENDING would incorrectly imply a verification is in
// flight.
function flattenStatus(verified: unknown, pending: unknown): DomainStatus | undefined {
  if (verified) return DomainStatus.VERIFIED;
  if (pending) return DomainStatus.PENDING;
  return undefined;
}

export function toDomainResponse(data: AuthV1DomainResponse): DomainResponse {
  const status = data.status;
  const verified = status?.verified;
  const pending = status?.pending;
  const flattenedStatus = flattenStatus(verified, pending);
  return {
    present: data.present,
    id: data.id ?? "",
    domain: data.domain ?? "",
    status: flattenedStatus,
    verification_token: pending?.verification_token,
    expires_at: pending?.expires_at,
    verified_at: verified?.verified_at,
    suggest_join: status?.suggest_join,
  };
}

export function toSuggestJoinSetting(data: AuthV1SuggestJoinSetting): SuggestJoinSetting {
  return {
    enabled: data.enabled ?? false,
    present: data.present,
  };
}
