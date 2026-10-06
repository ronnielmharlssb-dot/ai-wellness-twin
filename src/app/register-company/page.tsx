import Link from "next/link";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import { readOrganizationSetupRequests, OrganizationSetupError } from "@/lib/organizations/setupRequestServer";
import type { OrganizationSetupRequest } from "@/lib/organizations/setupRequest";
import { OrganizationSetupForm } from "@/components/organizations/organization-setup-form";
import { WellnessTwinLogo } from "@/components/ui/wellness-twin-logo";

export default async function RegisterCompanyPage() {
  const user = await getAuthenticatedUser();
  let requests: OrganizationSetupRequest[] = [];
  let error: string | null = null;
  if (user?.source === "supabase") {
    try { requests = await readOrganizationSetupRequests(user); }
    catch (failure) { error = failure instanceof OrganizationSetupError ? failure.message : "Organization setup is temporarily unavailable. Please try again later."; }
  }
  return (
    <main className="min-h-screen bg-[#F7F8FA] dark:bg-[#20201e]">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
        <header className="mb-8 flex flex-col items-center text-center">
          <WellnessTwinLogo size={68} />
          <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">AI WELLNESS TWIN</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Request organization setup</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            A site administrator reviews the organization and your authority to represent it before assigning membership or HR access.
          </p>
        </header>
        <section className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-[#383734] dark:bg-[#2c2b28] sm:p-8">
          {user?.source === "supabase" ? <OrganizationSetupForm accountId={user.id} email={user.email} initialRequests={requests} initialError={error} /> : (
            <div className="space-y-4 text-sm leading-6">
              <h2 className="font-semibold">Start with your personal account</h2>
              <p>Create a personal account or sign in before submitting an organization request. Your email address alone does not establish company ownership or HR authority.</p>
              {user?.source === "demo" && <p>Sample accounts cannot submit organization requests.</p>}
              <div className="flex flex-wrap gap-3">
                <Link href="/register" className="rounded-xl bg-slate-900 px-4 py-2 font-semibold text-white dark:bg-white dark:text-slate-900">Create a personal account</Link>
                <Link href="/login" className="rounded-xl border border-slate-300 px-4 py-2 font-semibold dark:border-slate-600">Sign in</Link>
              </div>
            </div>
          )}
          <p className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-[#383734] dark:text-slate-400">
            Personal observations remain private. Organization requests do not change employee consent or the evidence required to release group observations.
          </p>
        </section>
        <nav className="mt-6 flex justify-center gap-5 text-sm font-semibold">
          <Link href="/" className="hover:underline">Home</Link>
          {user && <Link href={user.role === "hr" ? "/hr" : "/dashboard"} className="hover:underline">Back to your account</Link>}
        </nav>
      </div>
    </main>
  );
}
