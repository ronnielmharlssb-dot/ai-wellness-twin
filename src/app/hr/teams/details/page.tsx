"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

import { getGroupObservations } from "@/lib/wellbeing/storage";

import {
  getBaselineDays,
  getBaselineStatus,
} from "@/lib/wellbeing/baseline";

import {
  detectMeaningfulChanges,
} from "@/lib/wellbeing/changeDetection";

type Group = {
  id: string;
  name: string;
  members: string[];
  eligibleMembers: number;

  createdAt?: string;

  baselineStatus?:
    | "not-eligible"
    | "building"
    | "established";

  baselineDaysCollected?: number;

  meaningfulChanges?: ChangeResult[];
};

type ChangeResult = {
  metric:
    | "afterHoursActivity"
    | "meetingLoad"
    | "workPatternShift";

  baselineValue: number;
  currentValue: number;
  percentageChange: number;
  meaningful: boolean;
};

function formatMetricName(
  metric: ChangeResult["metric"]
) {
  switch (metric) {
    case "afterHoursActivity":
      return "After-hours activity";

    case "meetingLoad":
      return "Meeting load";

    case "workPatternShift":
      return "Work-pattern shift";
  }
}

function TeamDetailContent() {
  const searchParams = useSearchParams();

  const [group, setGroup] = useState<Group | null>(null);

  const [baselineDays, setBaselineDays] =
    useState(0);

  const [baselineStatus, setBaselineStatus] =
    useState<
      "not-eligible" | "building" | "established"
    >("building");

  const [changes, setChanges] = useState<
    ChangeResult[]
  >([]);

  const [observationSource, setObservationSource] =
  useState<"demo" | "imported" | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  useEffect(() => {
    const teamId = searchParams.get("team");

    if (!teamId) {
      setIsLoading(false);
      return;
    }

    try {
      const savedGroups = JSON.parse(
        localStorage.getItem("hr-groups") || "[]"
      );

      const foundGroup = savedGroups.find(
        (item: Group) => item.id === teamId
      );

      if (!foundGroup) {
        setGroup(null);
        return;
      }

      setGroup(foundGroup);

      const isEligible =
        foundGroup.eligibleMembers >= 3;

      if (!isEligible) {
        setBaselineDays(0);
        setBaselineStatus("not-eligible");
        setChanges([]);
        return;
      }

      const observations =
  getGroupObservations(foundGroup.id);

const sortedObservations = [...observations].sort(
  (a, b) => a.date.localeCompare(b.date)
);

// Source is only used for the demo-data notice.
// It does not affect baseline calculation.
const hasDemoData = observations.some(
  (observation) => observation.source === "demo"
);

const hasImportedData = observations.some(
  (observation) => observation.source === "imported"
);

if (hasDemoData && !hasImportedData) {
  setObservationSource("demo");
} else {
  setObservationSource(null);
}

// The first 28 observations establish the baseline.
const baselineObservations =
  sortedObservations.slice(0, 28);

const days =
  getBaselineDays(baselineObservations);

setBaselineDays(days);

const status =
  getBaselineStatus(baselineObservations);

setBaselineStatus(status);

// Do not detect changes until there is an observation
// after the 28-day baseline.
if (sortedObservations.length <= 28) {
  setChanges([]);
  return;
}

// Observation #29 onward can be compared to the
// established baseline.
const currentObservation =
  sortedObservations[
    sortedObservations.length - 1
  ];

const detectedChanges =
  detectMeaningfulChanges(
    baselineObservations,
    currentObservation
  );

setChanges(
  detectedChanges.filter(
    (change) => change.meaningful
  )
);
    } catch (error) {
      console.error(
        "Failed to load team details:",
        error
      );

      setGroup(null);
    } finally {
      setIsLoading(false);
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Loading group...
          </p>
        </Card>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="mx-auto max-w-5xl">
        <Card className="p-6">
          <h1 className="text-lg font-semibold text-slate-900">
            Group not found
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            This group could not be found.
          </p>
        </Card>
      </div>
    );
  }

  const isEligible =
    group.eligibleMembers >= 3;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {observationSource === "demo" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">
            Demo data
          </p>

          <p className="mt-1 text-sm leading-5 text-amber-800">
            The current wellbeing observations are synthetic
            test data and are not based on real employee activity.
          </p>
        </div>
      )}

      
      <section>
        <p className="text-sm text-slate-500">
          Team Overview
        </p>

        <div className="mt-1 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {group.name}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              {group.eligibleMembers} eligible members
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Badge
              variant={
                isEligible
                  ? "positive"
                  : "warning"
              }
            >
              {isEligible
                ? "Eligible"
                : "Not eligible"}
            </Badge>

            <Link
              href={`/hr/teams/edit?team=${group.id}`}
            >
              <Button variant="outline">
                Edit Group
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Baseline Status
        </h2>

        <div className="mt-4">
          <Badge
            variant={
              baselineStatus === "established"
                ? "positive"
                : baselineStatus === "not-eligible"
                ? "warning"
                : "neutral"
            }
          >
            {baselineStatus === "not-eligible"
              ? "Not Eligible"
              : baselineStatus === "building"
              ? "Building Baseline"
              : "Baseline Established"}
          </Badge>
        </div>

        {baselineStatus === "not-eligible" && (
          <p className="mt-4 text-sm leading-6 text-slate-500">
            At least 3 eligible members are required
            before a baseline can be established.
          </p>
        )}

        {baselineStatus === "building" && (
          <>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              This group is currently establishing
              its baseline work pattern.
            </p>

            <p className="mt-3 text-sm font-medium text-slate-700">
              {baselineDays} / 28 days collected
            </p>
          </>
        )}

        {baselineStatus === "established" && (
  <>
    <p className="mt-4 text-sm leading-6 text-slate-500">
      This group has enough historical data
      to support meaningful change detection.
    </p>

    <p className="mt-3 text-sm font-medium text-slate-700">
      28-day baseline established
    </p>
  </>
)}
      </Card>

      {baselineStatus === "established" && (
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Meaningful Changes
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Recent group-level patterns that differ
            meaningfully from the established baseline.
          </p>

          {changes.length === 0 ? (
            <div className="mt-5 rounded-xl bg-slate-50 px-4 py-4">
              <p className="text-sm text-slate-600">
                No meaningful changes detected.
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {changes.map((change) => (
                <div
                  key={change.metric}
                  className="rounded-xl border border-slate-200 px-4 py-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-slate-900">
                      {formatMetricName(
                        change.metric
                      )}
                    </p>

                    <Badge variant="warning">
                      {change.percentageChange > 0
                        ? "+"
                        : ""}
                      {change.percentageChange.toFixed(
                        1
                      )}
                      %
                    </Badge>
                  </div>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Current activity is{" "}
                    {Math.abs(
                      change.percentageChange
                    ).toFixed(1)}
                    %{" "}
                    {change.percentageChange >= 0
                      ? "higher"
                      : "lower"}{" "}
                    than the established baseline.
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Possible Areas to Explore
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Context HR may choose to explore further.
        </p>

        {changes.length === 0 ? (
          <p className="mt-5 text-sm text-slate-500">
            No areas to explore based on current
            group-level data.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {changes.map((change) => (
              <div
                key={change.metric}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-600"
              >
                {change.metric ===
                  "afterHoursActivity" &&
                  "Workload distribution and after-hours coverage"}

                {change.metric ===
                  "meetingLoad" &&
                  "Meeting scheduling and meeting load"}

                {change.metric ===
                  "workPatternShift" &&
                  "Recent changes in work patterns"}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-medium text-slate-700">
          Privacy Notice
        </p>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          This view contains aggregate group-level
          information only. Individual employee
          wellbeing information is never shown.
        </p>
      </div>
    </div>
  );
}

export default function TeamDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl">
          <Card className="p-6">
            <p className="text-sm text-slate-500">Loading group...</p>
          </Card>
        </div>
      }
    >
      <TeamDetailContent />
    </Suspense>
  );
}