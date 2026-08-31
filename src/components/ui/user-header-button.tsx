"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Settings, LogOut } from "lucide-react";
import { getLocalSessionUser, signOutUser, type AuthUser } from "@/lib/supabase/auth";

export function UserHeaderButton({ defaultRole = "employee" }: { defaultRole?: "employee" | "hr" }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUser(getLocalSessionUser());

    const handleAuthUpdate = () => {
      setUser(getLocalSessionUser());
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };

    window.addEventListener("wellness-auth-update", handleAuthUpdate);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("wellness-auth-update", handleAuthUpdate);
      document.removeEventListener("mousedown", handleClickOutside);
    };
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
    <div className="relative" ref={menuRef}>
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
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
              {user?.fullName || (defaultRole === "hr" ? "Jordan" : "Alex")}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 truncate">
              {user?.email || (defaultRole === "hr" ? "jordan@company.com" : "alex@company.com")}
            </p>
            <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {user?.role || defaultRole}
            </span>
          </div>

          <div className="py-1 space-y-0.5">
            <Link
              href="/settings"
              onClick={() => setShowMenu(false)}
              className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <Settings className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
              <span>Settings</span>
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
