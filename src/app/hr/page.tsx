"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { getGroupObservations } from "@/lib/wellbeing/storage";
import {
  detectMeaningfulChanges,
} from "@/lib/wellbeing/changeDetection";

type Group = {
  id: string;
  name: string;
  members: string[];
  eligibleMembers: number;
};

type OrgSummary = {
  totalGroups: number;
  eligibleGroups: number;
  totalEligibleMembers: number;
  establishedGroups: number;
  meaningfulChangesCount: number;
  overallStatus: "Steady & Balanced" | "Noticing Changes" | "Workload Review Recommended";
  overallVariant: "positive" | "warning" | "neutral";
  afterHoursSummary: string;
  meetingLoadSummary: string;
  breakFrequencySummary: string;
};

export default function HRDashboardPage() {
  const [summary, setSummary] = useState<OrgSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedGroups: Group[] = JSON.parse(
        localStorage.getItem("hr-groups") || "[]"
      );

      const eligible = savedGroups.filter(
        (group) => group.eligibleMembers >= 3
      );

      const totalEligibleMembers = eligible.reduce(
        (acc, group) => acc + group.eligibleMembers,
        0
      );

      let establishedCount = 0;
      let totalChangesCount = 0;
      let afterHoursElevated = false;
      let meetingLoadElevated = false;

      eligible.forEach((group) => {
        const observations = getGroupObservations(group.id).sort((a, b) =>
          a.date.localeCompare(b.date)
        );

        if (observations.length > 28) {
          establishedCount++;
          const baselineObs = observations.slice(0, 28);
          const currentObs = observations[observations.length - 1];
          const changes = detectMeaningfulChanges(baselineObs, currentObs);
          const meaningful = changes.filter((c) => c.meaningful);

          totalChangesCount += meaningful.length;

          if (meaningful.some((c) => c.metric === "afterHoursActivity" && c.percentageChange > 0)) {
            afterHoursElevated = true;
          }
          if (meaningful.some((c) => c.metric === "meetingLoad" && c.percentageChange > 0)) {
            meetingLoadElevated = true;
          }
        }
      });

      let overallStatus: OrgSummary["overallStatus"] = "Steady & Balanced";
      let overallVariant: OrgSummary["overallVariant"] = "positive";

      if (totalChangesCount > 3 || (afterHoursElevated && meetingLoadElevated)) {
        overallStatus = "Workload Review Recommended";
        overallVariant = "warning";
      } else if (totalChangesCount > 0) {
        overallStatus = "Noticing Changes";
        overallVariant = "neutral";
      }

      setSummary({
        totalGroups: savedGroups.length,
        eligibleGroups: eligible.length,
        totalEligibleMembers,
        establishedGroups: establishedCount,
        meaningfulChangesCount: totalChangesCount,
        overallStatus,
        overallVariant,
        afterHoursSummary: afterHoursElevated
          ? "Activity outside typical hours is elevated in some groups."
          : "After-hours activity is aligned with organizational baselines.",
        meetingLoadSummary: meetingLoadElevated
          ? "Meeting time has increased across active groups."
          : "Meeting loads remain consistent with typical team schedules.",
        breakFrequencySummary:
          "Team rest and break rhythms remain generally stable.",
      });
    } catch (error) {
      console.error("Failed to load HR overview data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl">
        <Card className="p-6">
          <p className="text-sm text-slate-500">Loading workforce overview...</p>
        </Card>
      </div>
    );
  }

  const hasGroups = summary && summary.totalGroups > 0;
  const hasEligible = summary && summary.eligibleGroups > 0;

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
            <span className="text-slate-700 dark:text-slate-200">Overview</span>
          </div>

          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Organizational Wellbeing
          </h1>

          <p className="mt-1 text-xs text-slate-500 dark:text-[#a6a6a6] max-w-2xl">
            High-level overview of team wellbeing trends based on aggregate, anonymized patterns ($k \ge 3$).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/hr/teams">
            <Button variant="outline" className="text-xs border-slate-200 dark:border-[#383734]">
              Manage Teams
            </Button>
          </Link>
          <Link href="/hr/teams/create">
            <Button className="text-xs">
              + Create Team
            </Button>
          </Link>
        </div>
      </div>

      {!hasGroups ? (
        <Card className="p-8">
          <h2 className="text-base font-bold text-slate-900">
            No organizational groups configured
          </h2>
          <p className="mt-2 max-w-xl text-xs leading-5 text-slate-500">
            Create an HR-managed group to begin viewing aggregate, privacy-safe wellbeing patterns.
          </p>
          <div className="mt-5">
            <Link href="/hr/teams/create">
              <Button className="text-xs">Create your first group</Button>
            </Link>
          </div>
        </Card>
      ) : !hasEligible ? (
        <Card className="p-7">
          <h2 className="text-base font-bold text-slate-900">
            Groups Require at Least 3 Eligible Members
          </h2>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-slate-500">
            To protect individual employee privacy (k-anonymity), aggregate wellbeing insights are only generated for groups with 3 or more eligible members.
          </p>
          <div className="mt-5">
            <Link href="/hr/teams">
              <Button variant="outline" className="text-xs">Manage Teams</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <>
          {/* Workforce Snapshot */}
          <section>
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">
                Workforce Snapshot
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                A high-level view of current organizational patterns across {summary.eligibleGroups} eligible team(s).
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="p-6">
                <p className="text-xs font-semibold text-slate-500">
                  Workforce Rhythm
                </p>
                <div className="mt-4">
                  <Badge variant={summary.overallVariant}>
                    {summary.overallStatus}
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  {summary.establishedGroups} of {summary.eligibleGroups} group(s) baseline established
                </p>
              </Card>

              <Card className="p-6">
                <p className="text-xs font-semibold text-slate-500">
                  Active Coverage
                </p>
                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {summary.totalEligibleMembers}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Eligible employees in aggregate views
                </p>
              </Card>

              <Card className="p-6">
                <p className="text-xs font-semibold text-slate-500">
                  Detected Group Shifts
                </p>
                <p className="mt-3 text-2xl font-bold text-slate-900">
                  {summary.meaningfulChangesCount}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Meaningful changes across teams
                </p>
              </Card>

              <Card className="p-6">
                <p className="text-xs font-semibold text-slate-500">
                  Privacy Protection
                </p>
                <div className="mt-4">
                  <Badge variant="positive">
                    Enforced (k ≥ 3)
                  </Badge>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Individual data is never displayed
                </p>
              </Card>
            </div>
          </section>

          {/* Organizational Summary */}
          <Card className="p-6">
            <h2 className="text-base font-bold text-slate-900">
              Organizational Summary
            </h2>

            <p className="mt-3 max-w-3xl text-xs leading-6 text-slate-600">
              {summary.overallStatus === "Steady & Balanced"
                ? "Workforce wellbeing remains generally stable across eligible teams. Behavioral patterns align closely with established organizational baselines."
                : summary.overallStatus === "Noticing Changes"
                ? "Workforce patterns show emerging shifts from established baselines in select teams. Monitoring these trends over upcoming reporting cycles is recommended."
                : "Workload and recovery indicators differ meaningfully from established baselines across multiple groups. Reviewing meeting loads and workload distribution is recommended."}
            </p>
          </Card>

          {/* Meaningful Changes Feed */}
          <section>
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">
                Key Behavioral Dimensions
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Aggregate patterns compared with established organizational baselines.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-900">
                  After-Hours Activity
                </h3>
                <p className="mt-2.5 text-xs leading-5 text-slate-500">
                  {summary.afterHoursSummary}
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-900">
                  Meeting Load
                </h3>
                <p className="mt-2.5 text-xs leading-5 text-slate-500">
                  {summary.meetingLoadSummary}
                </p>
              </Card>

              <Card className="p-6">
                <h3 className="text-sm font-semibold text-slate-900">
                  Workload & Recovery
                </h3>
                <p className="mt-2.5 text-xs leading-5 text-slate-500">
                  {summary.breakFrequencySummary}
                </p>
              </Card>
            </div>
          </section>
        </>
      )}

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-bold text-slate-700">
          Privacy Notice
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          This overview displays aggregate, anonymized trends only. Individual employee activity, scores, or personal patterns are never accessible to HR or management.
        </p>
      </div>
    </div>
  );
}