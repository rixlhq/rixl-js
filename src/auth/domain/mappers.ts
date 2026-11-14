import type {AuthV1DomainResponse, AuthV1AutoJoinSetting} from "../../generated/types.gen";
import {DomainStatus, type DomainResponse, type AutoJoinSetting} from "./types";

// DomainStatus is a nested oneOf (pending | verified) plus a shared auto_join
// flag; flatten it into the library's DomainResponse. When the gateway omits
// `status` entirely we leave the flattened `status` field undefined instead
// of defaulting to PENDING — the two states carry very different meanings
// and PENDING would incorrectly imply a verification is in flight.
type WireDomainStatus = NonNullable<AuthV1DomainResponse["status"]>;

const verifiedOf = (status?: WireDomainStatus) => (status && "verified" in status ? status.verified : undefined);
const pendingOf = (status?: WireDomainStatus) => (status && "pending" in status ? status.pending : undefined);

function flattenStatus(verified: unknown, pending: unknown): DomainStatus | undefined {
  if (verified) return DomainStatus.VERIFIED;
  if (pending) return DomainStatus.PENDING;
  return undefined;
}

export function toDomainResponse(data: AuthV1DomainResponse): DomainResponse {
  const status = data.status;
  const verified = verifiedOf(status);
  const pending = pendingOf(status);
  const flattenedStatus = flattenStatus(verified, pending);
  return {
    present: data.present,
    id: data.id ?? "",
    domain: data.domain ?? "",
    status: flattenedStatus,
    verification_token: pending?.verification_token,
    expires_at: pending?.expires_at,
    verified_at: verified?.verified_at,
    auto_join: status?.auto_join,
  };
}

export function toAutoJoinSetting(data: AuthV1AutoJoinSetting): AutoJoinSetting {
  return {
    enabled: data.enabled ?? false,
    present: data.present,
  };
}
