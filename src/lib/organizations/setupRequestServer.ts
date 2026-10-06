import { createClient } from "../supabase/server";
import type { AuthUser } from "../supabase/authTypes";
import { parseOrganizationSetupReceipt, type OrganizationSetupRequest, type OrganizationSetupSubmission } from "./setupRequest";

const unavailable = "Organization setup is temporarily unavailable. Please try again later or contact the site administrator.";
export class OrganizationSetupError extends Error {
  constructor(public readonly status: 403 | 409 | 503, message = unavailable) { super(message); }
}
function receipt(raw: unknown, user: AuthUser): OrganizationSetupRequest {
  if (!raw || typeof raw !== "object") throw new OrganizationSetupError(503);
  const value = raw as Record<string, unknown>;
  if (value.requester_id !== user.id) throw new OrganizationSetupError(503);
  const parsed = parseOrganizationSetupReceipt({ id: value.id, companyName: value.company_name, domain: value.domain, teamSize: value.team_size,
    status: value.status, createdAt: value.created_at, reviewedAt: value.reviewed_at, organizationId: value.organization_id });
  if (!parsed) throw new OrganizationSetupError(503);
  return parsed;
}
function requireRealAccount(user: AuthUser) {
  if (user.source !== "supabase") throw new OrganizationSetupError(403, "Organization setup requires a verified personal account.");
}
export async function readOrganizationSetupRequests(user: AuthUser): Promise<OrganizationSetupRequest[]> {
  requireRealAccount(user);
  try {
    const client = await createClient();
    if (!client) throw new OrganizationSetupError(503);
    const { data, error } = await client.from("organization_setup_requests")
      .select("id,requester_id,company_name,domain,team_size,status,created_at,reviewed_at,organization_id")
      .eq("requester_id", user.id).order("created_at", { ascending: false }).limit(10);
    if (error || !Array.isArray(data) || data.length > 10) throw new OrganizationSetupError(503);
    return data.map(row => receipt(row, user));
  } catch (error) { throw error instanceof OrganizationSetupError ? error : new OrganizationSetupError(503); }
}
export async function saveOrganizationSetupRequest(user: AuthUser, submission: OrganizationSetupSubmission): Promise<OrganizationSetupRequest> {
  requireRealAccount(user);
  if (submission.accountId !== user.id) throw new OrganizationSetupError(409, "Your signed-in account changed. Reload this page before submitting.");
  try {
    const client = await createClient();
    if (!client) throw new OrganizationSetupError(503);
    const { data, error } = await client.rpc("submit_organization_setup_request", {
      p_request_id: submission.requestId, p_company_name: submission.companyName, p_domain: submission.domain, p_team_size: submission.teamSize,
    });
    if (error?.code === "23505") throw new OrganizationSetupError(409, "This request conflicts with an existing request. Refresh your request history before trying again.");
    if (error?.code === "42501") throw new OrganizationSetupError(403, "Verify your account and sign in again before requesting organization setup.");
    if (error) throw new OrganizationSetupError(503);
    const result = receipt(data, user);
    if (result.id !== submission.requestId || result.companyName !== submission.companyName || result.domain !== submission.domain || result.teamSize !== submission.teamSize) throw new OrganizationSetupError(503);
    return result;
  } catch (error) { throw error instanceof OrganizationSetupError ? error : new OrganizationSetupError(503); }
}
