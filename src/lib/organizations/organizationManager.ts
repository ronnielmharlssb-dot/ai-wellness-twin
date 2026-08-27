"use client";

import { saveRegisteredUser, setLocalSessionUser, type AuthUser } from "../supabase/auth";

export type Organization = {
  id: string;              // e.g. "org_technova_2026"
  name: string;            // "TechNova Systems Inc."
  domain: string;          // "technova.com"
  websiteUrl: string;      // "https://technova.com"
  registrationNumber?: string; // e.g. Tax ID / Business Reg No. (EIN/SEC)
  teamSize: string;        // "10-50", "50-200", "200-1000", "1000+"
  industry?: string;       // "Technology / Software"
  adminEmail: string;      // "jordan.hr@technova.com"
  adminName: string;       // "Jordan Taylor"
  verificationStatus: "verified" | "pending_verification" | "rejected";
  verificationCode?: string; // 6-digit OTP code (e.g. "849201")
  createdAt: string;
  verifiedAt?: string;
};

const ORGANIZATIONS_STORAGE_KEY = "wellness-organizations-registry";

// Disallowed free, disposable, or consumer email providers
export const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "mail.com",
  "protonmail.com",
  "proton.me",
  "zoho.com",
  "yandex.com",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "guerrillamail.com",
  "10minutemail.com",
  "sharklasers.com",
  "getnada.com",
]);

export const DEFAULT_ORGANIZATIONS: Organization[] = [
  {
    id: "org_acme_technologies",
    name: "Acme Technologies Inc.",
    domain: "acme.com",
    websiteUrl: "https://acme.com",
    registrationNumber: "US-EIN-9842104",
    teamSize: "50-200",
    industry: "Software & Technology",
    adminEmail: "jordan@company.com",
    adminName: "Jordan Taylor",
    verificationStatus: "verified",
    createdAt: "2026-08-01T00:00:00.000Z",
    verifiedAt: "2026-08-01T00:05:00.000Z",
  },
];

export function getOrganizations(): Organization[] {
  if (typeof window === "undefined") return DEFAULT_ORGANIZATIONS;

  try {
    const saved = localStorage.getItem(ORGANIZATIONS_STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(ORGANIZATIONS_STORAGE_KEY, JSON.stringify(DEFAULT_ORGANIZATIONS));
      return DEFAULT_ORGANIZATIONS;
    }
    const parsed: Organization[] = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ORGANIZATIONS;
  } catch (err) {
    console.error("Failed to load organizations:", err);
    return DEFAULT_ORGANIZATIONS;
  }
}

export function saveOrganizations(orgs: Organization[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ORGANIZATIONS_STORAGE_KEY, JSON.stringify(orgs));
}

/**
 * Validates that an email belongs to a legitimate corporate domain
 * rather than a public consumer email provider.
 */
export function isCorporateEmail(email: string): { valid: boolean; domain: string; reason?: string } {
  if (!email || !email.includes("@")) {
    return { valid: false, domain: "", reason: "Invalid email format." };
  }

  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) {
    return { valid: false, domain: "", reason: "Invalid email structure." };
  }

  const domain = parts[1];

  if (FREE_EMAIL_DOMAINS.has(domain)) {
    return {
      valid: false,
      domain,
      reason: `Corporate work email required. Public consumer domains (@${domain}) cannot register an enterprise corporate tenant.`,
    };
  }

  // Basic domain syntax check (must have at least one dot and valid characters)
  if (!domain.includes(".") || domain.length < 4 || domain.startsWith(".") || domain.endsWith(".")) {
    return {
      valid: false,
      domain,
      reason: `Invalid corporate domain structure (@${domain}).`,
    };
  }

  return { valid: true, domain };
}

/**
 * Registers a new company tenant in "pending_verification" status and generates a 6-digit OTP.
 */
export async function registerCompany({
  companyName,
  domain,
  websiteUrl,
  registrationNumber,
  teamSize = "10-50",
  industry = "Technology",
  adminName,
  adminEmail,
}: {
  companyName: string;
  domain?: string;
  websiteUrl?: string;
  registrationNumber?: string;
  teamSize?: string;
  industry?: string;
  adminName: string;
  adminEmail: string;
}): Promise<{ organization: Organization; adminUser: AuthUser; verificationCode: string }> {
  const normalizedEmail = adminEmail.trim().toLowerCase();
  
  // 1. Validate corporate domain
  const domainCheck = isCorporateEmail(normalizedEmail);
  if (!domainCheck.valid) {
    throw new Error(domainCheck.reason || "Corporate work email required.");
  }

  const rawDomain = domain?.trim() || domainCheck.domain;
  const rawWebsite = websiteUrl?.trim() || `https://${rawDomain}`;
  const orgSlug = companyName.toLowerCase().replace(/[^a-z0-9]/g, "_");
  const orgId = `org_${orgSlug}_${Date.now().toString(36)}`;
  
  // Generate 6-digit verification PIN (e.g. 849201)
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  const newOrg: Organization = {
    id: orgId,
    name: companyName.trim(),
    domain: rawDomain,
    websiteUrl: rawWebsite,
    registrationNumber: registrationNumber?.trim() || undefined,
    teamSize,
    industry,
    adminEmail: normalizedEmail,
    adminName: adminName.trim(),
    verificationStatus: "pending_verification",
    verificationCode,
    createdAt: new Date().toISOString(),
  };

  // 2. Save Organization
  const existingOrgs = getOrganizations();
  saveOrganizations([newOrg, ...existingOrgs]);

  // 3. Provision Primary HR Admin Account
  const newAdminUser: AuthUser = {
    id: `hr-${Date.now().toString(36)}`,
    email: normalizedEmail,
    fullName: adminName.trim(),
    role: "hr",
  };

  saveRegisteredUser(newAdminUser);
  setLocalSessionUser(newAdminUser);

  return { organization: newOrg, adminUser: newAdminUser, verificationCode };
}

/**
 * Confirms corporate domain ownership via the 6-digit OTP code.
 */
export function verifyCompanyDomain(
  organizationId: string,
  enteredCode: string
): { success: boolean; organization?: Organization; error?: string } {
  const orgs = getOrganizations();
  const org = orgs.find((o) => o.id === organizationId);

  if (!org) {
    return { success: false, error: "Organization not found." };
  }

  if (org.verificationStatus === "verified") {
    return { success: true, organization: org };
  }

  if (org.verificationCode !== enteredCode.trim()) {
    return { success: false, error: "Incorrect 6-digit verification code. Please check your corporate email and try again." };
  }

  const updatedOrg: Organization = {
    ...org,
    verificationStatus: "verified",
    verifiedAt: new Date().toISOString(),
  };

  const updatedList = orgs.map((o) => (o.id === organizationId ? updatedOrg : o));
  saveOrganizations(updatedList);

  return { success: true, organization: updatedOrg };
}

/**
 * Resends a fresh 6-digit verification code.
 */
export function resendVerificationCode(organizationId: string): string | null {
  const orgs = getOrganizations();
  const org = orgs.find((o) => o.id === organizationId);
  if (!org) return null;

  const newCode = Math.floor(100000 + Math.random() * 900000).toString();
  const updatedOrg: Organization = {
    ...org,
    verificationCode: newCode,
  };

  saveOrganizations(orgs.map((o) => (o.id === organizationId ? updatedOrg : o)));
  return newCode;
}
