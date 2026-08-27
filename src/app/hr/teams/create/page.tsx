"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { mockEmployees } from "@/lib/wellbeing/mock-data";

export default function CreateGroupPage() {
  const router = useRouter();

  const [groupName, setGroupName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const toggleMember = (id: string) => {
    setSelectedMembers((current) =>
      current.includes(id)
        ? current.filter((memberId) => memberId !== id)
        : [...current, id]
    );
  };

  const eligibleSelectedCount = mockEmployees.filter(
    (employee) =>
      employee.eligible && selectedMembers.includes(employee.id)
  ).length;

  const groupSizeStatus =
    eligibleSelectedCount >= 3 ? "Ready" : "Needs more members";

  const handleCreateGroup = () => {
    const trimmedName = groupName.trim();

    if (!trimmedName) {
      return;
    }

    const existingGroups = JSON.parse(
      localStorage.getItem("hr-groups") || "[]"
    );

    const isEligible = eligibleSelectedCount >= 3;

    const newGroup = {
      id: crypto.randomUUID(),
      name: trimmedName,
      description: description.trim(),
      members: selectedMembers,
      eligibleMembers: eligibleSelectedCount,

      createdAt: new Date().toISOString(),

      baselineStatus: isEligible
        ? "building"
        : "not-eligible",

      baselineDaysCollected: 0,

      meaningfulChanges: [],
    };

    localStorage.setItem(
      "hr-groups",
      JSON.stringify([...existingGroups, newGroup])
    );

    router.push("/hr/teams");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section>
        <p className="text-sm text-slate-500">
          Team Management
        </p>

        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Create Group
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Create an HR-managed group and select the employees who
          belong to it.
        </p>
      </section>

      <Card className="p-6">
        <div className="space-y-6">
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
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="e.g. Customer Support"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="group-description"
              className="text-sm font-medium text-slate-900"
            >
              Description
              <span className="ml-1 font-normal text-slate-400">
                (optional)
              </span>
            </label>

            <textarea
              id="group-description"
              rows={3}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add a short description for this group."
              className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
            />
          </div>
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
                Aggregate wellbeing results require at least 3
                eligible members.
              </p>
            </div>

            <Badge
              variant={
                eligibleSelectedCount >= 3
                  ? "positive"
                  : "warning"
              }
            >
              {groupSizeStatus}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-medium text-slate-700">
          Privacy Notice
        </p>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          Groups can be created with any number of members, but
          aggregate wellbeing results are only available when at
          least 3 eligible members are present. Individual employee
          wellbeing information is never displayed.
        </p>
      </div>

      <div className="flex items-center justify-end gap-3">
        <Link href="/hr/teams">
          <Button variant="outline">
            Cancel
          </Button>
        </Link>

        <Button
          disabled={!groupName.trim()}
          onClick={handleCreateGroup}
        >
          Create Group
        </Button>
      </div>
    </div>
  );
}