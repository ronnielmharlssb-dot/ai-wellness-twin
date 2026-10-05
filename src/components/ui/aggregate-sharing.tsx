"use client";
import { useEffect, useState } from "react";
import { Card } from "./card";
import { Button } from "./button";

type Membership = { organizationId: string; organizationName: string; enabled: boolean };
export function AggregateSharing() {
  const [memberships, setMemberships] = useState<Membership[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/organizations/aggregate-consent", { signal: controller.signal, cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.memberships)) throw new Error(data.error || "Group sharing is unavailable.");
        setMemberships(data.memberships);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Group sharing is unavailable.");
      }
    })();
    return () => controller.abort();
  }, []);
  const toggle = async (membership: Membership) => {
    setSaving(membership.organizationId);
    setError(null);
    try {
      const response = await fetch("/api/organizations/aggregate-consent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: membership.organizationId, enabled: !membership.enabled }),
      });
      const data = await response.json();
      if (!response.ok || typeof data.enabled !== "boolean") throw new Error(data.error || "Group sharing could not be saved.");
      setMemberships((current) => current?.map((item) => item.organizationId === membership.organizationId ? { ...item, enabled: data.enabled } : item) ?? null);
    } catch (error) { setError(error instanceof Error ? error.message : "Group sharing could not be saved."); }
    finally { setSaving(null); }
  };
  return <Card className="p-6">
    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Share observations in group averages</h2>
    <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-400">Sharing starts disabled. If you enable it, eligible observations from your recorded history may contribute to your organization’s group averages. Each metric requires at least three consenting contributors with 28 prior observed days. HR receives no personal score or individual record. Withdrawing consent excludes your observations from subsequent aggregate requests.</p>
    {error && <p role="alert" className="mt-3 text-xs text-rose-700 dark:text-rose-300">{error}</p>}
    {!error && memberships === null && <p className="mt-3 text-xs text-slate-500">Loading verified memberships...</p>}
    {memberships?.length === 0 && <p className="mt-3 text-xs text-slate-500">No verified organization membership is available. Your observations are not shared.</p>}
    {memberships?.map((membership) => <div key={membership.organizationId} className="mt-4 flex items-center justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
      <div><p className="text-sm font-semibold">{membership.organizationName}</p><p className="mt-1 text-xs text-slate-500">{membership.enabled ? "Group sharing enabled" : "Group sharing disabled"}</p></div>
      <Button variant="outline" disabled={saving !== null} onClick={() => void toggle(membership)}>{saving === membership.organizationId ? "Saving..." : membership.enabled ? "Stop sharing" : "Enable sharing"}</Button>
    </div>)}
  </Card>;
}
