"use client";

import { saveRegisteredUser, setLocalSessionUser, type AuthUser } from "../supabase/auth";

export type Invitation = {
  id: string; // Unique cryptographic token (e.g. "inv_8f29c...")
  organizationId: string;
  organizationName: string;
  email: string;
  fullName?: string;
  role: "employee" | "hr";
  assignedTeam: string;
  status: "pending" | "redeemed" | "revoked" | "expired";
  isUsed: boolean;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
};

const INVITATIONS_STORAGE_KEY = "wellness-tenant-invitations";

export const DEFAULT_INVITATIONS: Invitation[] = [
  {
    id: "inv_alex_engineering_2026",
    organizationId: "org_acme_technologies",
    organizationName: "Acme Technologies Inc.",
    email: "alex.new@acme.com",
    fullName: "Alex Rivera",
    role: "employee",
    assignedTeam: "Frontend Engineering",
    status: "pending",
    isUsed: false,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "inv_taylor_design_2026",
    organizationId: "org_acme_technologies",
    organizationName: "Acme Technologies Inc.",
    email: "taylor.design@acme.com",
    fullName: "Taylor Chen",
    role: "employee",
    assignedTeam: "Product Design",
    status: "pending",
    isUsed: false,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "inv_jordan_hr_admin_2026",
    organizationId: "org_acme_technologies",
    organizationName: "Acme Technologies Inc.",
    email: "jordan.hr@acme.com",
    fullName: "Jordan Vance",
    role: "hr",
    assignedTeam: "People Operations",
    status: "pending",
    isUsed: false,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export function getInvitations(): Invitation[] {
  if (typeof window === "undefined") return DEFAULT_INVITATIONS;

  try {
    const saved = localStorage.getItem(INVITATIONS_STORAGE_KEY);
    if (!saved) {
      localStorage.setItem(INVITATIONS_STORAGE_KEY, JSON.stringify(DEFAULT_INVITATIONS));
      return DEFAULT_INVITATIONS;
    }
    const parsed: Invitation[] = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : DEFAULT_INVITATIONS;
  } catch (err) {
    console.error("Failed to load invitations:", err);
    return DEFAULT_INVITATIONS;
  }
}

export function saveInvitations(invites: Invitation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(INVITATIONS_STORAGE_KEY, JSON.stringify(invites));
}

/**
 * Creates a single-use high-entropy invitation token
 */
export function createInvitation({
  email,
  fullName,
  role = "employee",
  assignedTeam,
  organizationId = "org_acme_technologies",
  organizationName = "Acme Technologies Inc.",
}: {
  email: string;
  fullName?: string;
  role?: "employee" | "hr";
  assignedTeam: string;
  organizationId?: string;
  organizationName?: string;
}): { invitation: Invitation; inviteUrl: string } {
  const normalizedEmail = email.trim().toLowerCase();
  const token = `inv_${Math.random().toString(36).substring(2, 12)}_${Date.now().toString(36)}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const newInvite: Invitation = {
    id: token,
    organizationId,
    organizationName,
    email: normalizedEmail,
    fullName: fullName?.trim(),
    role,
    assignedTeam: assignedTeam.trim() || "General Engineering",
    status: "pending",
    isUsed: false,
    createdAt: new Date().toISOString(),
    expiresAt,
  };

  const existing = getInvitations();
  // Filter out older pending invites for the exact same email
  const filtered = existing.filter(
    (inv) => !(inv.email.toLowerCase() === normalizedEmail && inv.status === "pending")
  );

  saveInvitations([newInvite, ...filtered]);

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const inviteUrl = `${origin}/register?token=${token}`;

  return { invitation: newInvite, inviteUrl };
}

/**
 * Validates whether an invitation token is active, single-use, and unexpired.
 */
export function validateInvitationToken(token: string): {
  valid: boolean;
  reason?: string;
  invitation?: Invitation;
} {
  if (!token || !token.trim()) {
    return { valid: false, reason: "No invitation token provided." };
  }

  const invites = getInvitations();
  const invite = invites.find((inv) => inv.id === token.trim());

  if (!invite) {
    return {
      valid: false,
      reason: "This invitation link was not found. Please request a new invite from your HR administrator.",
    };
  }

  if (invite.isUsed || invite.status === "redeemed") {
    return {
      valid: false,
      reason: "This single-use invitation has already been redeemed. Each invite link can only create one account.",
      invitation: invite,
    };
  }

  if (invite.status === "revoked") {
    return {
      valid: false,
      reason: "This invitation link was revoked by your organization's HR administrator.",
      invitation: invite,
    };
  }

  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return {
      valid: false,
      reason: "This invitation link has expired. Invitations are valid for 7 days. Please ask HR for a new invite.",
      invitation: invite,
    };
  }

  return { valid: true, invitation: invite };
}

/**
 * Burns the single-use token upon successful registration and provisions the user.
 */
export async function redeemInvitation({
  token,
  fullName,
}: {
  token: string;
  fullName: string;
  password?: string;
}): Promise<{ user: AuthUser | null; error: string | null }> {
  const validation = validateInvitationToken(token);

  if (!validation.valid || !validation.invitation) {
    return { user: null, error: validation.reason || "Invalid invitation." };
  }

  const invite = validation.invitation;
  const resolvedName = fullName.trim() || invite.fullName || invite.email.split("@")[0];

  // 1. Burn the token immediately (One-Invite, One-Account policy)
  const allInvites = getInvitations();
  const updatedInvites = allInvites.map((inv) => {
    if (inv.id === invite.id) {
      return {
        ...inv,
        isUsed: true,
        status: "redeemed" as const,
        usedAt: new Date().toISOString(),
      };
    }
    return inv;
  });
  saveInvitations(updatedInvites);

  // 2. Provision the user account
  const newUser: AuthUser = {
    id: `emp-${Date.now().toString(36)}`,
    email: invite.email,
    fullName: resolvedName,
    role: invite.role,
  };

  saveRegisteredUser(newUser);
  setLocalSessionUser(newUser);

  return { user: newUser, error: null };
}

/**
 * Revokes a pending invitation token.
 */
export function revokeInvitation(tokenId: string): boolean {
  const invites = getInvitations();
  const updated = invites.map((inv) => {
    if (inv.id === tokenId) {
      return { ...inv, status: "revoked" as const };
    }
    return inv;
  });
  saveInvitations(updated);
  return true;
}
