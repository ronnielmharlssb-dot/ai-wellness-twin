import { hasSupabaseConfiguration } from "./publicConfig";

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  role: "employee" | "hr";
  source?: "supabase" | "demo";
};

export const PRIMARY_USER_ACCOUNT: AuthUser = {
  id: "usr-ronnie", email: "ronnie@company.com", fullName: "Ronnie", role: "employee", source: "demo",
};
export const PRIMARY_HR_ACCOUNT: AuthUser = {
  id: "usr-hr-sarah", email: "hr@company.com", fullName: "Sarah Jenkins", role: "hr", source: "demo",
};
export const CALIBRATED_DEMO_ACCOUNT: AuthUser = {
  id: "usr-demo-calibrated", email: "demo@company.com", fullName: "Alex Rivera (Demo)", role: "employee", source: "demo",
};
export const DEFAULT_ACCOUNTS = [PRIMARY_USER_ACCOUNT, PRIMARY_HR_ACCOUNT, CALIBRATED_DEMO_ACCOUNT];

export function isDemoModeEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_DEMO !== "false" &&
    !hasSupabaseConfiguration();
}
