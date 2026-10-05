import type { EmployeeSignal } from "../signals/types";

type GitHubEvent = {
  id: string;
  type: string;
  created_at: string;
};

/** Public GitHub timestamps establish event counts, never coding duration or breaks. */
export async function fetchGitHubSignals(username: string, employeeId: string): Promise<EmployeeSignal[]> {
  const trimmed = username.trim();
  if (!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(trimmed)) {
    throw new Error("Please enter a valid GitHub username.");
  }
  const headers = { Accept: "application/vnd.github+json" };
  const userCheck = await fetch(`https://api.github.com/users/${encodeURIComponent(trimmed)}`, { headers });
  if (userCheck.status === 404) throw new Error(`GitHub account "${trimmed}" was not found.`);
  if (!userCheck.ok) throw new Error(`GitHub account lookup failed (${userCheck.status}). Please retry later.`);
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(trimmed)}/events?per_page=100`, { headers });
  if (!res.ok) throw new Error(`GitHub activity fetch failed (${res.status}). Please retry later.`);
  const events: GitHubEvent[] = await res.json();
  if (!Array.isArray(events)) throw new Error("GitHub returned an invalid activity response.");
  const counts = new Map<string, number>();
  const seen = new Set<string>();
  for (const event of events) {
    if (!event || typeof event.id !== "string" || seen.has(event.id) ||
        !["PushEvent", "PullRequestEvent", "PullRequestReviewEvent", "PullRequestReviewCommentEvent"].includes(event.type)) continue;
    const time = Date.parse(event.created_at);
    if (!Number.isFinite(time) || time > Date.now() || time < Date.now() - 35 * 86400000) continue;
    seen.add(event.id);
    const date = new Date(time).toISOString().slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  // A successful empty feed is different from an API failure. Keep today's event count fresh.
  counts.set(new Date().toISOString().slice(0, 10), counts.get(new Date().toISOString().slice(0, 10)) ?? 0);
  return [...counts].map(([date, count]) => ({
    employeeId, date, source: "github",
    activeMinutes: 0, meetingMinutes: 0, afterHoursMinutes: 0,
    breakCount: 0, appSwitches: 0, observedMetrics: [], githubEventCount: count,
  }));
}
