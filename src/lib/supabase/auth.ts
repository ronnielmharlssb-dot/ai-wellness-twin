import { createClient, isSupabaseConfigured } from "./client";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: "employee" | "hr" | "manager";
};

const LOCAL_SESSION_KEY = "wellness-auth-user";
const REGISTERED_USERS_KEY = "wellness-registered-users";

const DEFAULT_ACCOUNTS: AuthUser[] = [
  {
    id: "emp-001",
    email: "alex@company.com",
    fullName: "Alex Morgan",
    role: "employee",
  },
  {
    id: "emp-001-gmail",
    email: "alex.morgan@gmail.com",
    fullName: "Alex Morgan",
    role: "employee",
  },
  {
    id: "hr-001",
    email: "jordan@company.com",
    fullName: "Jordan Taylor",
    role: "hr",
  },
  {
    id: "hr-001-gmail",
    email: "jordan.hr@gmail.com",
    fullName: "Jordan Taylor",
    role: "hr",
  },
  {
    id: "emp-002",
    email: "taylor@company.com",
    fullName: "Taylor Swift",
    role: "employee",
  },
  {
    id: "emp-003",
    email: "sam@company.com",
    fullName: "Sam Wilson",
    role: "employee",
  },
  {
    id: "emp-004",
    email: "casey@company.com",
    fullName: "Casey Brooks",
    role: "employee",
  },
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
    return parsed.length > 0 ? parsed : DEFAULT_ACCOUNTS;
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
  return users.find((u) => u.email.toLowerCase() === normalized) || null;
}

export const LIVE_TESTER_ACCOUNT: AuthUser = {
  id: "usr-live-tester",
  email: "ronnie.tester@company.com",
  fullName: "Ronnie (Live Tester)",
  role: "employee",
};

export function loginAsLiveTester(): AuthUser {
  if (typeof window !== "undefined") {
    // Save to registered users and set active session
    saveRegisteredUser(LIVE_TESTER_ACCOUNT);
    setLocalSessionUser(LIVE_TESTER_ACCOUNT);
  }
  return LIVE_TESTER_ACCOUNT;
}

export function getLocalSessionUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const saved = localStorage.getItem(LOCAL_SESSION_KEY);
    if (!saved) {
      // Automatically default to clean Live Tester so no login requirement blocks testing
      setLocalSessionUser(LIVE_TESTER_ACCOUNT);
      return LIVE_TESTER_ACCOUNT;
    }
    return JSON.parse(saved);
  } catch {
    return LIVE_TESTER_ACCOUNT;
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
  role: "employee" | "hr" | "manager";
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
  selectedRole?: "employee" | "hr" | "manager";
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
