import { createClient } from "../supabase/server";

export type HRAggregateDay = {
  date: string; workingHours: number | null; meetingLoad: number | null;
  breakFrequency: number | null; afterHoursActivity: number | null;
};
export type HRWorkspace = {
  available: boolean;
  groups: Array<{ id: string; name: string; organizationId: string; observations: HRAggregateDay[] }>;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unavailable = (): HRWorkspace => ({ available: false, groups: [] });

/** The caller must first verify an HR session. RLS/RPC enforce tenant ownership. */
export async function getServerHRWorkspace(): Promise<HRWorkspace> {
  try {
    const client = await createClient();
    if (!client) return unavailable();
    const [groups, observations] = await Promise.all([
      client.from("hr_groups").select("id,name,organization_id").order("name"),
      client.rpc("get_hr_group_observations"),
    ]);
    if (groups.error || observations.error || !Array.isArray(groups.data) || !Array.isArray(observations.data)) return unavailable();
    const result: HRWorkspace = { available: true, groups: [] };
    for (const group of groups.data) {
      if (!uuid.test(group.id) || !uuid.test(group.organization_id) || typeof group.name !== "string") return unavailable();
      result.groups.push({ id: group.id, name: group.name.slice(0, 200), organizationId: group.organization_id, observations: [] });
    }
    const metric = (value: unknown, max: number): number | null => {
      if (value === null) return null;
      if ((typeof value !== "number" && typeof value !== "string") || value === "") throw new Error("Invalid aggregate.");
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || number > max) throw new Error("Invalid aggregate.");
      return number;
    };
    for (const row of observations.data) {
      const group = result.groups.find((item) => item.id === row.group_id && item.organizationId === row.organization_id);
      if (!group) continue;
      if (typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date)) ||
          new Date(row.date).toISOString().slice(0, 10) !== row.date || group.observations.some((day) => day.date === row.date)) return unavailable();
      group.observations.push({ date: row.date, workingHours: metric(row.working_hours, 24),
        meetingLoad: metric(row.meeting_load, 24), breakFrequency: metric(row.break_frequency, 1000),
        afterHoursActivity: metric(row.after_hours_activity, 1440) });
    }
    for (const group of result.groups) group.observations.sort((a, b) => b.date.localeCompare(a.date));
    return result;
  } catch { return unavailable(); }
}
