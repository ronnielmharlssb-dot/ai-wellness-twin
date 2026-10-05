export const TOOL_MINUTES_STORAGE_KEY = "wellness-tool-minutes-today";

export function recordToolActiveTime(source: string, activeSeconds: number) {
  if (typeof window === "undefined") return;
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const saved = localStorage.getItem(TOOL_MINUTES_STORAGE_KEY);
    let data: { date: string; tools: Record<string, number> } = saved
      ? JSON.parse(saved)
      : { date: todayStr, tools: {} };

    if (data.date !== todayStr) {
      data = { date: todayStr, tools: {} };
    }

    const normSource = source.toLowerCase();
    const currentMins = data.tools[normSource] || 0;
    const additionalMins = activeSeconds / 60;
    data.tools[normSource] = Number((currentMins + additionalMins).toFixed(1));

    localStorage.setItem(TOOL_MINUTES_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("Failed to record tool active time:", err);
  }
}

export function getToolMinutesToday(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const saved = localStorage.getItem(TOOL_MINUTES_STORAGE_KEY);
    if (!saved) return {};
    const data = JSON.parse(saved);
    if (data.date !== todayStr) return {};
    return data.tools || {};
  } catch {
    return {};
  }
}
