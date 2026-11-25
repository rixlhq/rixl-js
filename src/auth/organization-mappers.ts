import type {AuthV1Organization} from "../generated/types.gen";

/** An organization. Its `id` is never a user ID. */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  image_id: string;
  /** The user's own org, which sign-in issues tokens for. */
  personal: boolean;
  internal: boolean;
  created_at?: string;
}

export const toOrganization = (wire?: AuthV1Organization | null): Organization => {
  const data = wire ?? {};
  return {
    id: data.id ?? "",
    name: data.name ?? "",
    slug: data.slug ?? "",
    image_id: data.image_id ?? "",
    personal: data.personal ?? false,
    internal: data.internal ?? false,
    created_at: data.created_at ?? undefined,
  };
};
