import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import { SessionGate } from "@/components/ui/session-gate";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  return <SessionGate user={user}>{children}</SessionGate>;
}
