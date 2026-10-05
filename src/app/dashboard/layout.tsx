import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import DashboardShell from "./DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== "employee") redirect("/hr");
  return <DashboardShell authenticatedUser={user}>{children}</DashboardShell>;
}
