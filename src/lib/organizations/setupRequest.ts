export const ORGANIZATION_SIZES = ["1-10", "10-50", "50-200", "200-1000", "1000+"] as const;
export type OrganizationSize = typeof ORGANIZATION_SIZES[number];
export type OrganizationSetupSubmission = {
  requestId: string; accountId: string; companyName: string; domain: string; teamSize: OrganizationSize;
};
export type OrganizationSetupRequest = {
  id: string; companyName: string; domain: string; teamSize: OrganizationSize;
  status: "pending" | "approved" | "declined"; createdAt: string;
  reviewedAt: string | null; organizationId: string | null;
};
export class OrganizationSetupValidationError extends Error {}
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
function details(raw: Record<string, unknown>) {
  if (typeof raw.companyName !== "string" || /[\u0000-\u001f\u007f]/.test(raw.companyName) || !raw.companyName.trim() || raw.companyName.trim().length > 200) {
    throw new OrganizationSetupValidationError("Enter an organization name between 1 and 200 characters.");
  }
  const domain = typeof raw.domain === "string" ? raw.domain.trim().toLowerCase() : "";
  if (domain.length > 253 || !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain) || !/[a-z]/.test(domain.split(".").at(-1)!)) {
    throw new OrganizationSetupValidationError("Enter a company domain such as example.com, without a URL or email address.");
  }
  if (!ORGANIZATION_SIZES.includes(raw.teamSize as OrganizationSize)) throw new OrganizationSetupValidationError("Choose a valid organization size.");
  return { companyName: raw.companyName.trim(), domain, teamSize: raw.teamSize as OrganizationSize };
}
export function parseOrganizationSetupSubmission(raw: unknown): OrganizationSetupSubmission {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new OrganizationSetupValidationError("A valid organization request is required.");
  const value = raw as Record<string, unknown>;
  if (Object.keys(value).some(key => !["requestId", "accountId", "companyName", "domain", "teamSize"].includes(key)) || !uuid(value.requestId) || !uuid(value.accountId)) {
    throw new OrganizationSetupValidationError("Reload this page before submitting your organization request.");
  }
  return { requestId: value.requestId.toLowerCase(), accountId: value.accountId.toLowerCase(), ...details(value) };
}
export function parseOrganizationSetupReceipt(raw: unknown): OrganizationSetupRequest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const date = (input: unknown): input is string => typeof input === "string" && /^\d{4}-\d{2}-\d{2}T/.test(input) && Number.isFinite(Date.parse(input));
  if (!uuid(value.id) || !["pending", "approved", "declined"].includes(value.status as string) || !date(value.createdAt)) return null;
  if (value.status === "pending" ? value.reviewedAt !== null || value.organizationId !== null : !date(value.reviewedAt)) return null;
  if (value.status === "approved" ? !uuid(value.organizationId) : value.organizationId !== null) return null;
  try {
    return { id: value.id.toLowerCase(), ...details(value), status: value.status as OrganizationSetupRequest["status"],
      createdAt: value.createdAt, reviewedAt: value.reviewedAt as string | null, organizationId: value.organizationId as string | null };
  } catch { return null; }
}
