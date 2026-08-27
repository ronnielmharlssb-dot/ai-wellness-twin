"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLocalSessionUser, signOutUser, type AuthUser } from "@/lib/supabase/auth";

export function UserHeaderButton({ defaultRole = "employee" }: { defaultRole?: "employee" | "hr" }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    setUser(getLocalSessionUser());
  }, []);

  const initial = user?.fullName
    ? user.fullName.charAt(0).toUpperCase()
    : defaultRole === "hr"
    ? "J"
    : "A";

  const handleLogout = async () => {
    await signOutUser();
    router.push("/login");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowMenu((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        aria-label="User profile menu"
      >
        {initial}
      </button>

      {showMenu && (
        <div className="absolute right-0 top-11 z-50 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
          <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {user?.fullName || (defaultRole === "hr" ? "Jordan" : "Alex")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {user?.email || (defaultRole === "hr" ? "jordan@company.com" : "alex@company.com")}
            </p>
            <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {user?.role || defaultRole}
            </span>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
