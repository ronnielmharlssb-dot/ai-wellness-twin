import { parseOrganizationSetupReceipt, type OrganizationSetupRequest, type OrganizationSetupSubmission } from "./setupRequest";
const unavailable = "Your request could not be confirmed. Refresh your request history before trying again.";
export class OrganizationSetupClientError extends Error {}

export async function loadOrganizationSetupRequests(accountId: string): Promise<OrganizationSetupRequest[]> {
  const response = await fetch("/api/organizations/setup-requests", { cache: "no-store", signal: AbortSignal.timeout(15000) });
  const result = await response.json();
  if (!response.ok || result.success !== true || result.accountId !== accountId || !Array.isArray(result.requests) || result.requests.length > 10) throw new Error(unavailable);
  const requests = result.requests.map(parseOrganizationSetupReceipt);
  if (requests.some((request: OrganizationSetupRequest | null) => !request)) throw new Error(unavailable);
  return requests as OrganizationSetupRequest[];
}
export async function submitOrganizationSetupRequest(submission: OrganizationSetupSubmission): Promise<OrganizationSetupRequest> {
  try {
    const response = await fetch("/api/organizations/setup-requests", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(submission), signal: AbortSignal.timeout(15000) });
    const result = await response.json();
    if (!response.ok) throw new OrganizationSetupClientError(response.status === 409 ? "Your account or pending request changed. Refresh your request history before trying again." : unavailable);
    const receipt = result.success === true && result.accountId === submission.accountId ? parseOrganizationSetupReceipt(result.request) : null;
    if (!receipt || receipt.id !== submission.requestId || receipt.companyName !== submission.companyName || receipt.domain !== submission.domain || receipt.teamSize !== submission.teamSize) throw new OrganizationSetupClientError(unavailable);
    return receipt;
  } catch (error) { throw error instanceof OrganizationSetupClientError ? error : new OrganizationSetupClientError(unavailable); }
}
