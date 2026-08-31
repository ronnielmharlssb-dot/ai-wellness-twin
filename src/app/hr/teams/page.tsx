"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Users,
  UserPlus,
  Mail,
  Copy,
  Check,
  ShieldCheck,
} from "lucide-react";
import {
  getInvitations,
  createInvitation,
  revokeInvitation,
  type Invitation,
} from "@/lib/invitations/invitationManager";

type Group = {
  id: string;
  name: string;
  members: string[];
  eligibleMembers: number;
};

const DEFAULT_HR_GROUPS: Group[] = [
  {
    id: "grp_engineering",
    name: "Engineering",
    members: ["team@company.com", "ronnie.tester@company.com"],
    eligibleMembers: 2,
  },
];

export default function TeamsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<"employee" | "hr">("employee");
  const [inviteTeam, setInviteTeam] = useState("Engineering");
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const loadData = () => {
    try {
      const saved = localStorage.getItem("hr-groups");
      if (saved) {
        const parsed = JSON.parse(saved);
        setGroups(Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_HR_GROUPS);
      } else {
        localStorage.setItem("hr-groups", JSON.stringify(DEFAULT_HR_GROUPS));
        setGroups(DEFAULT_HR_GROUPS);
      }
      setInvitations(getInvitations());
    } catch (error) {
      console.error("Failed to load groups:", error);
      setGroups(DEFAULT_HR_GROUPS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const { inviteUrl } = createInvitation({
      email: inviteEmail.trim(),
      fullName: inviteName.trim(),
      role: inviteRole,
      assignedTeam: inviteTeam,
    });

    setGeneratedInviteUrl(inviteUrl);
    setInvitations(getInvitations());
  };

  const handleCopyLink = (url: string, tokenId: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(tokenId);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleRevoke = (tokenId: string) => {
    revokeInvitation(tokenId);
    setInvitations(getInvitations());
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 dark:text-[#9a9893]">
            <Link href="/hr" className="hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
              Workforce Portal
            </Link>
            <span>›</span>
            <span className="text-slate-700 dark:text-slate-200">Teams & Onboarding</span>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Teams & Onboarding
          </h1>

          <p className="mt-1 text-xs text-slate-500 dark:text-[#a6a6a6] max-w-2xl">
            Manage department group boundaries ($k \ge 3$) and issue single-use employee invitation links.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setShowInviteModal(true);
              setGeneratedInviteUrl(null);
              setInviteEmail("");
              setInviteName("");
            }}
            className="flex items-center gap-2 text-xs bg-[#60cdff] text-black font-bold hover:bg-[#4cc2ff]"
          >
            <UserPlus className="h-4 w-4" />
            <span>Invite Employee</span>
          </Button>

          <Link href="/hr/teams/create">
            <Button variant="outline" className="text-xs border-slate-200 dark:border-[#383734]">
              Create Group
            </Button>
          </Link>
        </div>
      </div>

      {/* Invite Employee Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#383734] dark:bg-[#2c2b28] space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#383734]">
              <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                <Mail className="h-5 w-5 text-sky-500" />
                <h2 className="text-base font-bold">Issue Single-Use Invitation</h2>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                ✕ Close
              </button>
            </div>

            {!generatedInviteUrl ? (
              <form onSubmit={handleCreateInvite} className="space-y-3.5">
                <p className="text-xs text-slate-500 dark:text-[#a6a6a6] leading-5">
                  Generate a non-transferable, single-use registration link. The link automatically burns upon account creation.
                </p>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                    Employee Work Email
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="e.g. maya.lin@company.com"
                    required
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition focus:border-slate-400 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                    Full Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="e.g. Maya Lin"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none transition focus:border-slate-400 dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                      Role
                    </label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "employee" | "hr")}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                    >
                      <option value="employee">Employee</option>
                      <option value="hr">HR Administrator</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700 dark:text-[#cfcfce]">
                      Assigned Group
                    </label>
                    <input
                      type="text"
                      value={inviteTeam}
                      onChange={(e) => setInviteTeam(e.target.value)}
                      placeholder="e.g. Engineering"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none dark:border-[#383734] dark:bg-[#181817] dark:text-white"
                    />
                  </div>
                </div>

                <div className="pt-3">
                  <Button type="submit" className="w-full text-xs font-bold bg-[#60cdff] text-black hover:bg-[#4cc2ff]">
                    Generate Single-Use Invite Link
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4 py-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Single-Use Invitation Generated</span>
                </div>

                <p className="text-xs text-slate-500 dark:text-[#a6a6a6] leading-5">
                  Send this unique link directly to <strong>{inviteEmail}</strong>. It will be burned as soon as they set their password:
                </p>

                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs dark:border-[#383734] dark:bg-[#181817]">
                  <input
                    type="text"
                    readOnly
                    value={generatedInviteUrl}
                    className="flex-1 bg-transparent text-[11px] text-slate-700 outline-none dark:text-slate-200"
                  />
                  <Button
                    onClick={() => handleCopyLink(generatedInviteUrl, "modal")}
                    className="shrink-0 flex items-center gap-1 text-[11px] py-1 px-2.5"
                  >
                    {copiedToken === "modal" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedToken === "modal" ? "Copied!" : "Copy"}</span>
                  </Button>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                  className="w-full text-xs"
                >
                  Done
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Single-Use Invitation Management Table */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Single-Use Invitations Roster
            </h2>
            <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
              One invite per account policy. Links are permanently burned upon redemption.
            </p>
          </div>

          <Badge variant="positive">One-Invite, One-Account</Badge>
        </div>

        <Card className="overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-[#383734]">
            {invitations.map((inv) => {
              const isBurned = inv.isUsed || inv.status === "redeemed";
              const isRevoked = inv.status === "revoked";
              const isPending = !isBurned && !isRevoked;
              const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
              const url = `${origin}/register?token=${inv.id}`;

              return (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {inv.fullName || "Unassigned Name"}
                      </p>
                      <span className="text-slate-400 dark:text-[#888884]">
                        ({inv.email})
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-[#a6a6a6]">
                      {inv.assignedTeam} • {inv.role === "hr" ? "HR Admin" : "Employee"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        isPending
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                          : isBurned
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {isPending ? "Pending (Unused)" : isBurned ? "Redeemed (Burned)" : "Revoked"}
                    </span>

                    {/* Actions */}
                    {isPending && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          onClick={() => handleCopyLink(url, inv.id)}
                          className="flex items-center gap-1 text-[11px] py-1 px-2.5"
                        >
                          {copiedToken === inv.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedToken === inv.id ? "Copied" : "Copy Link"}</span>
                        </Button>

                        <Button
                          variant="ghost"
                          onClick={() => handleRevoke(inv.id)}
                          className="text-[11px] text-rose-600 hover:bg-rose-50 py-1 px-2.5 dark:text-rose-400 dark:hover:bg-rose-950/40"
                        >
                          Revoke
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      {/* Managed Teams Section */}
      <section className="space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Active Organizational Groups ($k \ge 3$)
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
            Only groups meeting the $k$-anonymity threshold ($k \ge 3$) publish aggregate reflections.
          </p>
        </div>

        {isLoading ? (
          <Card className="p-6">
            <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">Loading groups...</p>
          </Card>
        ) : groups.length === 0 ? (
          <Card className="p-8 text-center space-y-3">
            <p className="text-sm font-bold text-slate-900 dark:text-white">No groups created yet</p>
            <p className="text-xs text-slate-500 dark:text-[#a6a6a6] max-w-md mx-auto">
              Create an organizational group to monitor aggregate workforce pacing without individual inspection.
            </p>
            <Link href="/hr/teams/create">
              <Button className="text-xs">Create Group</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((group) => {
              const isEligible = group.eligibleMembers >= 3;

              return (
                <Card key={group.id} className="p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        {group.name}
                      </h3>
                      <Badge variant={isEligible ? "positive" : "warning"}>
                        {isEligible ? "Eligible" : "k < 3 Warning"}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-[#a6a6a6]">
                      {group.eligibleMembers} active members calibrated
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-3 dark:border-[#383734] flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 dark:text-[#888884]">
                      {isEligible ? "Aggregate Active" : "Masked for Privacy"}
                    </span>
                    <Link href={`/hr/teams/details?id=${group.id}`} className="text-xs font-semibold text-sky-600 hover:underline dark:text-[#60cdff]">
                      View Trends →
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}