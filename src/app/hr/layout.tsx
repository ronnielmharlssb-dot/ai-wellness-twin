import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import HRShell from "./HRShell";
import ServerOverview from "./ServerOverview";
import { getServerHRWorkspace } from "@/lib/wellbeing/serverHRWorkspace";

export default async function HRLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (user.role !== "hr") redirect("/dashboard");
  const content = user.source === "demo" ? children : <ServerOverview workspace={await getServerHRWorkspace()} />;
  return <HRShell authenticatedUser={user}>{content}</HRShell>;
}
