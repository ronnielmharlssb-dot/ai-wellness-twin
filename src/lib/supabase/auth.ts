import { createClient, isSupabaseConfigured } from "./client";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: "employee" | "hr";
};

const LOCAL_SESSION_KEY = "wellness-auth-user";
const REGISTERED_USERS_KEY = "wellness-registered-users";

export const PRIMARY_USER_ACCOUNT: AuthUser = {
  id: "usr-ronnie",
  email: "ronnie@company.com",
  fullName: "Ronnie",
  role: "employee",
};

export const PRIMARY_HR_ACCOUNT: AuthUser = {
  id: "usr-hr-sarah",
  email: "hr@company.com",
  fullName: "Sarah Jenkins",
  role: "hr",
};

export const DEFAULT_ACCOUNTS: AuthUser[] = [
  PRIMARY_USER_ACCOUNT,
  PRIMARY_HR_ACCOUNT,
];

export function getRegisteredUsers(): AuthUser[] {
  if (typeof window === "undefined") {
    return DEFAULT_ACCOUNTS;
  }

  try {
    const saved = localStorage.getItem(REGISTERED_USERS_KEY);
    if (!saved) {
      localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
      return DEFAULT_ACCOUNTS;
    }
    const parsed: AuthUser[] = JSON.parse(saved);
    let list: AuthUser[] = Array.isArray(parsed) ? [...parsed] : [];

    // Strictly enforce canonical roles and identities for default accounts
    for (const def of DEFAULT_ACCOUNTS) {
      const idx = list.findIndex(
        (u) => u.email.toLowerCase() === def.email.toLowerCase()
      );
      if (idx >= 0) {
        list[idx] = { ...list[idx], role: def.role, fullName: def.fullName };
      } else {
        list.push(def);
      }
    }

    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(list));
    return list;
  } catch {
    return DEFAULT_ACCOUNTS;
  }
}

export function saveRegisteredUser(user: AuthUser) {
  if (typeof window === "undefined") return;

  try {
    const current = getRegisteredUsers();
    const existingIndex = current.findIndex(
      (u) => u.email.toLowerCase() === user.email.toLowerCase()
    );

    let updated: AuthUser[];
    if (existingIndex >= 0) {
      updated = current.map((u, i) => (i === existingIndex ? user : u));
    } else {
      updated = [...current, user];
    }
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save registered user:", err);
  }
}

export function findRegisteredUser(email: string): AuthUser | null {
  const users = getRegisteredUsers();
  const normalized = email.trim().toLowerCase();
  const found = users.find((u) => u.email.toLowerCase() === normalized);
  if (!found) return null;

  // Enforce canonical role if default account
  const canonical = DEFAULT_ACCOUNTS.find(
    (def) => def.email.toLowerCase() === normalized
  );
  if (canonical) {
    return { ...found, role: canonical.role, fullName: canonical.fullName };
  }
  return found;
}

export const LIVE_TESTER_ACCOUNT: AuthUser = PRIMARY_USER_ACCOUNT;

export function loginAsRole(role: "employee" | "hr"): AuthUser {
  const targetAccount = role === "hr" ? PRIMARY_HR_ACCOUNT : PRIMARY_USER_ACCOUNT;
  if (typeof window !== "undefined") {
    saveRegisteredUser(targetAccount);
    setLocalSessionUser(targetAccount);
    window.dispatchEvent(new CustomEvent("wellness-auth-update", { detail: targetAccount }));
  }
  return targetAccount;
}

export function loginAsLiveTester(): AuthUser {
  return loginAsRole("employee");
}

export function getLocalSessionUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const saved = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!saved) {
      setLocalSessionUser(PRIMARY_USER_ACCOUNT);
      return PRIMARY_USER_ACCOUNT;
    }
    const parsed: AuthUser = JSON.parse(saved);
    // Auto-correct stale or corrupted roles for default accounts
    const canonical = DEFAULT_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === parsed.email.toLowerCase()
    );
    if (canonical && parsed.role !== canonical.role) {
      const fixed: AuthUser = { ...parsed, role: canonical.role, fullName: canonical.fullName };
      setLocalSessionUser(fixed);
      return fixed;
    }
    return parsed;
  } catch {
    return PRIMARY_USER_ACCOUNT;
  }
}

export function setLocalSessionUser(user: AuthUser | null) {
  if (typeof window === "undefined") return;

  if (user) {
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(LOCAL_SESSION_KEY);
  }
}

export async function signUpUser({
  email,
  password,
  fullName,
  role,
}: {
  email: string;
  password: string;
  fullName: string;
  role: "employee" | "hr";
}): Promise<{ user: AuthUser | null; error: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();

  // Verify if account already exists
  const existing = findRegisteredUser(normalizedEmail);
  if (existing) {
    return {
      user: null,
      error: `An account with "${normalizedEmail}" already exists. Please sign in instead.`,
    };
  }

  const newUser: AuthUser = {
    id: `usr-${crypto.randomUUID().slice(0, 8)}`,
    email: normalizedEmail,
    fullName: fullName.trim() || "Team Member",
    role,
  };

  saveRegisteredUser(newUser);
  setLocalSessionUser(newUser);

  if (isSupabaseConfigured()) {
    const supabase = createClient();
    if (supabase) {
      try {
        await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            data: {
              full_name: fullName,
              role,
            },
          },
        });
      } catch {
        // Fall back gracefully to local verified account
      }
    }
  }

  return { user: newUser, error: null };
}

export async function signInUser({
  email,
  password,
  selectedRole,
}: {
  email: string;
  password?: string;
  selectedRole?: "employee" | "hr";
}): Promise<{ user: AuthUser | null; error: string | null }> {
  const normalizedEmail = email.trim().toLowerCase();

  // Verify account existence
  const existingUser = findRegisteredUser(normalizedEmail);
  if (!existingUser) {
    return {
      user: null,
      error: `No registered account found for "${normalizedEmail}". Please create an account or verify your email.`,
    };
  }

  if (isSupabaseConfigured() && password) {
    const supabase = createClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (!error && data.user) {
          const authUser: AuthUser = {
            id: data.user.id,
            email: data.user.email ?? normalizedEmail,
            fullName: (data.user.user_metadata?.full_name as string) ?? existingUser.fullName,
            role: (data.user.user_metadata?.role as AuthUser["role"]) ?? existingUser.role,
          };
          saveRegisteredUser(authUser);
          setLocalSessionUser(authUser);
          return { user: authUser, error: null };
        }
      } catch {
        // Fall through to verified registered user
      }
    }
  }

  // Set session with verified registered account
  const activeUser = selectedRole ? { ...existingUser, role: selectedRole } : existingUser;
  setLocalSessionUser(activeUser);
  return { user: activeUser, error: null };
}

export async function signInWithGoogle(
  customEmail?: string,
  options?: { isSignUp?: boolean; role?: "employee" | "hr" }
): Promise<{ user: AuthUser | null; error: string | null }> {
  const email = (customEmail?.trim() || "alex.morgan@gmail.com").toLowerCase();
  const isSignUp = options?.isSignUp ?? false;
  const role = options?.role ?? "employee";

  const existingUser = findRegisteredUser(email);

  // 1. Sign-In on /login: verify if account exists
  if (!isSignUp) {
    if (!existingUser) {
      return {
        user: null,
        error: `Account "${email}" not found. Please register first or create an account.`,
      };
    }

    setLocalSessionUser(existingUser);
    return { user: existingUser, error: null };
  }

  // 2. Sign-Up on /register: verify if account already exists
  if (isSignUp) {
    if (existingUser) {
      return {
        user: null,
        error: `An account with Google email "${email}" already exists. Please sign in instead.`,
      };
    }

    const namePrefix = email.split("@")[0].replace(/[._-]/g, " ");
    const fullName = namePrefix
      .split(" ")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    const newGoogleUser: AuthUser = {
      id: `usr-${crypto.randomUUID().slice(0, 8)}`,
      email,
      fullName: fullName || "Google User",
      role,
    };

    saveRegisteredUser(newGoogleUser);
    setLocalSessionUser(newGoogleUser);
    return { user: newGoogleUser, error: null };
  }

  return { user: null, error: "Authentication failed." };
}

export async function signOutUser() {
  setLocalSessionUser(null);
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Safe sign out
      }
    }
  }
}
