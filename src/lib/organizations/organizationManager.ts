"use client";

import { isDemoModeEnabled } from "../supabase/authTypes";

export type Organization = { id: string; name: string; domain: string; source: "demo" };
export const DEFAULT_ORGANIZATIONS: Organization[] = [
  { id: "org_ronnie_enterprise", name: "Ronnie Enterprise", domain: "company.com", source: "demo" },
];

/** Read-only sample labels; browser registries never establish a real organization. */
export function getOrganizations(): Organization[] {
  if (!isDemoModeEnabled()) return [];
  return DEFAULT_ORGANIZATIONS.map(organization => ({ ...organization }));
}
