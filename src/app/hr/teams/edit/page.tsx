"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mockEmployees } from "@/lib/wellbeing/mock-data";

type Group = {
  id: string;
  name: string;
  members: string[];
  eligibleMembers: number;
  createdAt: string;
  baselineStatus:
    | "not-eligible"
    | "building"
    | "established";
  baselineDaysCollected: number;
  meaningfulChanges: Array<{
    metric: string;
    baselineValue: number;
    currentValue: number;
    percentageChange: number;
    meaningful: boolean;
  }>;
};

function EditGroupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [group, setGroup] = useState<Group | null>(null);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

      if (foundGroup) {
        setGroup(foundGroup);
        setGroupName(foundGroup.name);
        setSelectedMembers(foundGroup.members);
      }
    } catch (error) {
      console.error("Failed to load group:", error);
    } finally {
      setIsLoading(false);
    }
  }, [searchParams]);

  const toggleMember = (id: string) => {
    setSelectedMembers((current) =>
      current.includes(id)
        ? current.filter((memberId) => memberId !== id)
        : [...current, id]
    );
  };

  const eligibleSelectedCount = mockEmployees.filter(
    (employee) =>
      employee.eligible &&
      selectedMembers.includes(employee.id)
  ).length;

  const handleSave = () => {
    if (!group) {
      return;
    }

    const trimmedName = groupName.trim();

    if (!trimmedName) {
      return;
    }

    try {
      const savedGroups: Group[] = JSON.parse(
        localStorage.getItem("hr-groups") || "[]"
      );

      const updatedGroups = savedGroups.map((item) => {
        if (item.id !== group.id) {
          return item;
        }

        const memberCountChanged =
          JSON.stringify(item.members) !==
          JSON.stringify(selectedMembers);

        return {
          ...item,
          name: trimmedName,
          members: selectedMembers,
          eligibleMembers: eligibleSelectedCount,

          baselineStatus:
            eligibleSelectedCount < 3
              ? "not-eligible"
              : memberCountChanged
              ? "building"
              : item.baselineStatus,

          baselineDaysCollected:
            eligibleSelectedCount < 3
              ? 0
              : memberCountChanged
              ? 0
              : item.baselineDaysCollected,
        };
      });

      localStorage.setItem(
        "hr-groups",
        JSON.stringify(updatedGroups)
      );

      router.push(
        `/hr/teams/details?team=${encodeURIComponent(group.id)}`
      );
    } catch (error) {
      console.error("Failed to save group:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl">
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
      <div className="mx-auto max-w-4xl">
        <Card className="p-6">
          <h1 className="text-lg font-semibold text-slate-900">
            Group not found
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            The group you are trying to edit could not be found.
          </p>

          <div className="mt-5">
            <Link href="/hr/teams">
              <Button variant="outline">
                Back to Teams
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section>
        <p className="text-sm text-slate-500">
          Team Management
        </p>

        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Edit Group
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Update the group name or change which employees belong
          to this group.
        </p>
      </section>

      <Card className="p-6">
        <div>
          <label
            htmlFor="group-name"
            className="text-sm font-medium text-slate-900"
          >
            Group name
          </label>

          <input
            id="group-name"
            type="text"
            value={groupName}
            onChange={(event) =>
              setGroupName(event.target.value)
            }
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </div>
      </Card>

      <Card className="p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Members
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Select the employees who belong to this group.
            </p>
          </div>

          <Badge
            variant={
              eligibleSelectedCount >= 3
                ? "positive"
                : "warning"
            }
          >
            {eligibleSelectedCount} eligible
          </Badge>
        </div>

        <div className="mt-5 divide-y divide-slate-100 rounded-xl border border-slate-200">
          {mockEmployees.map((employee) => {
            const selected = selectedMembers.includes(employee.id);

            return (
              <label
                key={employee.id}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleMember(employee.id)}
                  className="h-4 w-4 rounded border-slate-300"
                />

                <span className="text-sm text-slate-700">
                  {employee.name}
                </span>

                {!employee.eligible && (
                  <span className="text-xs text-slate-400">
                    Not eligible
                  </span>
                )}
              </label>
            );
          })}
        </div>

        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-900">
                Group size
              </p>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                At least 3 eligible members are required for
                aggregate wellbeing insights.
              </p>
            </div>

            <Badge
              variant={
                eligibleSelectedCount >= 3
                  ? "positive"
                  : "warning"
              }
            >
              {eligibleSelectedCount >= 3
                ? "Ready"
                : "Needs more members"}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-medium text-slate-700">
          Baseline Notice
        </p>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          Changing the members of a group may restart its baseline
          collection period so that future comparisons remain
          meaningful.
        </p>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href={`/hr/teams/details?team=${encodeURIComponent(group.id)}`}>
          <Button variant="outline">
            Cancel
          </Button>
        </Link>

        <Button
          disabled={!groupName.trim()}
          onClick={handleSave}
        >
          Save Changes
        </Button>
      </div>
    </div>
  );
}

export default function EditGroupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl">
          <Card className="p-6">
            <p className="text-sm text-slate-500">Loading group...</p>
          </Card>
        </div>
      }
    >
      <EditGroupContent />
    </Suspense>
  );
}