import type { EmployeeSignal } from "../signals/types";

type GitHubEvent = {
  id: string;
  type: string;
  created_at: string;
  payload?: Record<string, unknown>;
};

export async function fetchGitHubSignals(
  username: string,
  employeeId: string
): Promise<EmployeeSignal[]> {
  const trimmed = username.trim();
  if (!trimmed) {
    throw new Error("Please enter a valid GitHub username.");
  }

  // 1. Verify if the GitHub account actually exists
  const userCheck = await fetch(`https://api.github.com/users/${encodeURIComponent(trimmed)}`, {
    headers: { Accept: "application/vnd.github.v3+json" },
  });

  if (userCheck.status === 404) {
    throw new Error(`GitHub account "${trimmed}" was not found. Please check your username spelling.`);
  }

  // 2. Fetch public event timestamps
  try {
    const res = await fetch(`https://api.github.com/users/${encodeURIComponent(trimmed)}/events?per_page=100`, {
      headers: {
        Accept: "application/vnd.github.v3+json",
      },
    });

    const events: GitHubEvent[] = res.ok ? await res.json() : [];
    const todayStr = new Date().toISOString().split("T")[0];

    if (!Array.isArray(events) || events.length === 0) {
      return [
        {
          employeeId,
          date: todayStr,
          activeMinutes: 0,
          meetingMinutes: 0,
          afterHoursMinutes: 0,
          breakCount: 0,
          appSwitches: 0,
          source: "github",
        },
      ];
    }

    // Group real public events by calendar date
    const eventsByDate = new Map<string, Date[]>();
    events.forEach((e) => {
      if (!e.created_at) return;
      const d = new Date(e.created_at);
      if (isNaN(d.getTime())) return;
      const dateStr = d.toISOString().split("T")[0];
      const list = eventsByDate.get(dateStr) || [];
      list.push(d);
      eventsByDate.set(dateStr, list);
    });

    // Ensure today is always present in output
    if (!eventsByDate.has(todayStr)) {
      eventsByDate.set(todayStr, []);
    }

    const signals: EmployeeSignal[] = [];

    eventsByDate.forEach((timestamps, dateStr) => {
      if (timestamps.length === 0) {
        signals.push({
          employeeId,
          date: dateStr,
          activeMinutes: 0,
          meetingMinutes: 0,
          afterHoursMinutes: 0,
          breakCount: 0,
          appSwitches: 0,
          source: "github",
        });
        return;
      }

      timestamps.sort((a, b) => a.getTime() - b.getTime());
      const firstEvent = timestamps[0];
      const lastEvent = timestamps[timestamps.length - 1];
      const spanMinutes = Math.round((lastEvent.getTime() - firstEvent.getTime()) / (1000 * 60));
      const activeMinutes = Math.min(
        540,
        Math.max(15, spanMinutes > 0 ? spanMinutes + 30 : timestamps.length * 20)
      );

      let afterHoursCount = 0;
      timestamps.forEach((t) => {
        const hour = t.getHours();
        if (hour < 9 || hour >= 19) {
          afterHoursCount++;
        }
      });
      const afterHoursMinutes = Math.min(180, afterHoursCount * 25);

      signals.push({
        employeeId,
        date: dateStr,
        activeMinutes,
        meetingMinutes: 0,
        afterHoursMinutes,
        breakCount: Math.min(6, Math.max(1, Math.floor(activeMinutes / 90))),
        appSwitches: timestamps.length * 4,
        source: "github",
      });
    });

    return signals;
  } catch (error) {
    if (error instanceof Error && error.message.includes("was not found")) {
      throw error;
    }
    console.warn("GitHub API fetch notice:", error);
    const todayStr = new Date().toISOString().split("T")[0];
    return [
      {
        employeeId,
        date: todayStr,
        activeMinutes: 0,
        meetingMinutes: 0,
        afterHoursMinutes: 0,
        breakCount: 0,
        appSwitches: 0,
        source: "github",
      },
    ];
  }
}
