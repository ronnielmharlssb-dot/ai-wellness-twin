"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ORGANIZATION_SIZES, OrganizationSetupValidationError, parseOrganizationSetupSubmission, type OrganizationSetupRequest, type OrganizationSetupSubmission } from "@/lib/organizations/setupRequest";
import { loadOrganizationSetupRequests, submitOrganizationSetupRequest, OrganizationSetupClientError } from "@/lib/organizations/setupRequestClient";

const statusLabels = { pending: "Pending administrator review", approved: "Approved for organization setup", declined: "Not approved" };
export function OrganizationSetupForm({ accountId, email, initialRequests, initialError }: {
  accountId: string; email: string; initialRequests: OrganizationSetupRequest[]; initialError: string | null;
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [companyName, setCompanyName] = useState("");
  const [domain, setDomain] = useState("");
  const [teamSize, setTeamSize] = useState("10-50");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [historyUnavailable, setHistoryUnavailable] = useState(!!initialError);
  const [notice, setNotice] = useState<string | null>(null);
  const attempt = useRef<OrganizationSetupSubmission | null>(null);
  const working = useRef(false);
  const pending = requests.find(request => request.status === "pending");

  async function refresh() {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    try {
      setRequests(await loadOrganizationSetupRequests(accountId));
      setHistoryUnavailable(false);
      setError(null);
      setNotice("Your request history has been refreshed.");
    } catch {
      setHistoryUnavailable(true);
      setError("Your request history is unavailable. Please try again later.");
    } finally { working.current = false; setBusy(false); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (working.current || pending || historyUnavailable) return;
    working.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const submission = parseOrganizationSetupSubmission({ requestId: attempt.current?.requestId ?? crypto.randomUUID(), accountId, companyName, domain, teamSize });
      if (attempt.current && ["companyName", "domain", "teamSize"].some(key => attempt.current![key as keyof OrganizationSetupSubmission] !== submission[key as keyof OrganizationSetupSubmission])) {
        submission.requestId = crypto.randomUUID();
      }
      attempt.current = submission;
      const receipt = await submitOrganizationSetupRequest(submission);
      setRequests(current => [receipt, ...current.filter(request => request.id !== receipt.id)].slice(0, 10));
      setError(null);
      setNotice(receipt.status === "pending" ? "Your request has been saved for administrator review. It does not grant organization or HR access." : "Your saved request status has been confirmed.");
      attempt.current = null;
      setCompanyName(""); setDomain("");
    } catch (failure) {
      setError(failure instanceof OrganizationSetupValidationError || failure instanceof OrganizationSetupClientError ? failure.message : "Your request could not be confirmed. Refresh your request history before trying again.");
    } finally { working.current = false; setBusy(false); }
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500 dark:text-slate-400">Submitting as <strong className="text-slate-800 dark:text-white">{email}</strong>.</p>
      {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200">{notice}</p>}
      {pending ? <p className="text-sm leading-6">You already have an organization request awaiting review. Your personal account remains available while the administrator reviews it.</p> : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="organization-name" className="block text-sm font-semibold">Organization name</label>
            <input id="organization-name" required maxLength={200} value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder="Example Technologies" className="w-full rounded-xl border border-slate-300 bg-transparent px-3.5 py-2.5 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="organization-domain" className="block text-sm font-semibold">Company domain</label>
            <input id="organization-domain" required maxLength={253} value={domain} onChange={event => setDomain(event.target.value)} placeholder="example.com" autoCapitalize="none" className="w-full rounded-xl border border-slate-300 bg-transparent px-3.5 py-2.5 text-sm" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="organization-size" className="block text-sm font-semibold">Organization size</label>
            <select id="organization-size" value={teamSize} onChange={event => setTeamSize(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:bg-[#2c2b28]">
              {ORGANIZATION_SIZES.map(size => <option key={size} value={size}>{size.replaceAll("-", "–")} employees</option>)}
            </select>
          </div>
          <Button type="submit" disabled={busy || historyUnavailable} className="w-full">{busy ? "Saving request…" : "Submit setup request"}</Button>
        </form>
      )}
      <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-[#383734]">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Your recent requests</h2>
          <Button type="button" variant="outline" disabled={busy} onClick={refresh} className="text-xs">Refresh history</Button>
        </div>
        {!historyUnavailable && !requests.length && <p className="text-sm text-slate-500 dark:text-slate-400">You have no saved organization requests.</p>}
        {requests.map(request => <article key={request.id} className="rounded-xl border border-slate-200 p-4 text-sm dark:border-[#383734]">
          <h3 className="font-semibold">{request.companyName}</h3>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{request.domain} · {request.teamSize} employees</p>
          <p className="mt-2 font-medium">{statusLabels[request.status]}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Submitted {request.createdAt.slice(0, 10)} · Reference {request.id}</p>
          {request.status === "approved" && <p className="mt-2 text-xs leading-5">The administrator assigns organization membership and HR access separately.</p>}
        </article>)}
      </div>
    </div>
  );
}
