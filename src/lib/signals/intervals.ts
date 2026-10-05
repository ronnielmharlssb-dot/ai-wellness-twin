export type Interval = [number, number];

/** Duration is the union of observed intervals, even when collectors overlap. */
export function unionIntervals(intervals: Interval[]): Interval[] {
  const result: Interval[] = [];
  for (const [start, end] of [...intervals].sort((a, b) => a[0] - b[0])) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const previous = result[result.length - 1];
    if (previous && start <= previous[1]) previous[1] = Math.max(previous[1], end);
    else result.push([start, end]);
  }
  return result;
}

export function intervalSeconds(intervals: Interval[]): number {
  return unionIntervals(intervals).reduce((total, [start, end]) => total + (end - start) / 1000, 0);
}
