const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader, memoryStorage, plain } = require("./load-typescript.cjs");
function fixture() {
  let user = { id: "employee-1", fullName: "Employee One", email: "one@example.com", role: "employee" };
  const localStorage = memoryStorage(), events = [];
  const load = createLoader({ localStorage, window: { dispatchEvent: event => events.push(event) },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } } },
    { "../supabase/auth": { getLocalSessionUser: () => user } });
  return { settings: load("src/lib/settings/userSettings.ts"), load, localStorage, events,
    user: () => user, switchTo: value => { user = value; } };
}
test("collection settings and private profile preferences are scoped to the signed-in account", () => {
  const f = fixture();
  f.settings.saveUserSettings({ profile: { jobTitle: "Private title", timezone: "Asia/Singapore" },
    telemetry: { heartbeatTrackerEnabled: false }, twin: { workdayStart: "10:00" } }, "employee-1");
  f.switchTo({ id: "employee-2", fullName: "Employee Two", email: "two@example.com", role: "employee" });
  const other = f.settings.getUserSettings();
  assert.equal(other.profile.jobTitle, ""); assert.equal(other.profile.fullName, "Employee Two");
  assert.equal(other.twin.workdayStart, "09:00"); assert.equal(other.telemetry.heartbeatTrackerEnabled, true);
  assert.throws(() => f.settings.saveUserSettings({ telemetry: { heartbeatTrackerEnabled: true } }, "employee-1"), /account changed/);
  assert.throws(() => f.settings.getUserSettings("employee-1"), /account changed/);
  assert.equal(f.events.length, 1);
});
test("legacy unscoped preferences remain unchanged and collection waits for account-specific preferences", () => {
  const f = fixture(), raw = JSON.stringify({ profile: { fullName: "Other user" }, telemetry: { heartbeatTrackerEnabled: false } });
  f.localStorage.setItem("wellness-user-settings-v1", raw);
  const snapshot = f.settings.getUserSettingsSnapshot();
  assert.equal(snapshot.status, "legacy"); assert.equal(snapshot.settings.profile.fullName, "Employee One");
  assert.equal(snapshot.settings.telemetry.heartbeatTrackerEnabled, false);
  f.settings.saveUserSettings({ telemetry: { heartbeatTrackerEnabled: true } }, "employee-1");
  assert.equal(f.settings.getUserSettingsSnapshot().status, "saved");
  assert.equal(f.localStorage.getItem("wellness-user-settings-v1"), raw);
});
test("invalid saved preferences fail closed without fabricating the default profile or collecting", () => {
  const f = fixture(), key = f.settings.userSettingsKey("employee-1");
  for (const value of ["bad json", JSON.stringify({ version: 2, userId: "employee-2", settings: {} }),
    JSON.stringify({ version: 2, userId: "employee-1", settings: { telemetry: { heartbeatTrackerEnabled: "false" } } })]) {
    f.localStorage.setItem(key, value);
    const snapshot = f.settings.getUserSettingsSnapshot();
    assert.equal(snapshot.status, "invalid"); assert.equal(snapshot.settings.telemetry.heartbeatTrackerEnabled, false);
    assert.equal(snapshot.settings.profile.fullName, "Employee One"); assert.equal(f.localStorage.getItem(key), value);
  }
});
test("read or write failure cannot enable collection or emit a successful settings event", () => {
  const f = fixture();
  const read = f.localStorage.getItem;
  f.localStorage.getItem = () => { throw new Error("blocked"); };
  assert.equal(f.settings.getUserSettings().telemetry.heartbeatTrackerEnabled, false);
  assert.equal(f.settings.getUserSettings().telemetry.autoCaptureAfterHours, false);
  assert.throws(() => f.settings.saveUserSettings({ telemetry: { heartbeatTrackerEnabled: true } }, "employee-1"), /could not be read/);
  assert.equal(f.events.length, 0);
  f.localStorage.getItem = read;
  f.localStorage.setItem = () => { throw new Error("quota"); };
  assert.throws(() => f.settings.saveUserSettings({ telemetry: { heartbeatTrackerEnabled: true } }, "employee-1"), /quota/);
  assert.equal(f.events.length, 0);
});
test("validation rejects invalid timezones, time bounds, duplicate days and malformed numeric preferences", () => {
  const f = fixture();
  for (const patch of [{ profile: { timezone: "UTC+08:00 (Singapore / Manila)" } }, { twin: { workdayStart: "24:00" } },
    { twin: { workdayStart: "18:00", workdayEnd: "18:00" } }, { twin: { workDays: ["Mon", "Mon"] } },
    { twin: { workDays: ["Notaday"] } }, { telemetry: { inactivityThresholdMinutes: 0 } },
    { telemetry: { inactivityThresholdMinutes: Infinity } }, { telemetry: { heartbeatTrackerEnabled: "false" } },
    { twin: { maxDailyMeetingHours: -1 } }, { hidden: true }]) {
    assert.throws(() => f.settings.saveUserSettings(patch, "employee-1"));
  }
  assert.equal(f.events.length, 0);
});
test("profile preferences cannot rewrite verified identity; default objects cannot be mutated by callers", () => {
  const f = fixture();
  const saved = f.settings.saveUserSettings({ profile: { fullName: "Impersonation", email: "other@example.com" } }, "employee-1");
  assert.equal(saved.profile.fullName, "Employee One"); assert.equal(saved.profile.email, "one@example.com");
  const first = f.settings.getUserSettings(); first.twin.workDays.push("Sun");
  assert.deepEqual(plain(f.settings.getUserSettings().twin.workDays), ["Mon","Tue","Wed","Thu","Fri"]);
  f.switchTo(null); assert.equal(f.settings.getUserSettings().profile.fullName, "");
  assert.equal(f.settings.getUserSettings().telemetry.heartbeatTrackerEnabled, false);
  assert.throws(() => f.settings.saveUserSettings({}), /Sign in/);
});
test("timezone and overnight workdays classify the same instant consistently", () => {
  const { workSchedulePosition: position } = createLoader()("src/lib/settings/workSchedule.ts");
  const singapore = { timeZone: "Asia/Singapore", workdayStart: "09:00", workdayEnd: "18:00", workDays: ["Mon"] };
  assert.equal(position(Date.parse("2026-10-05T01:00:00Z"), singapore).inWorkHours, true);
  assert.equal(position(Date.parse("2026-10-05T00:59:59Z"), singapore).inWorkHours, false);
  const night = { ...singapore, workdayStart: "22:00", workdayEnd: "06:00" };
  assert.equal(position(Date.parse("2026-10-05T18:00:00Z"), night).inWorkHours, true); // Tuesday 02:00 belongs to Monday.
  assert.equal(position(Date.parse("2026-10-05T22:00:00Z"), night).inWorkHours, false); // Tuesday 06:00 ends the shift.
});
test("calendar timezone classification honors daylight saving while keeping actual UTC interval lengths", () => {
  const parse = createLoader()("src/lib/integrations/calendarConnector.ts").parseCalendarBlocksToSignals;
  const events = [{ start: "2026-03-08T06:30:00Z", end: "2026-03-08T07:30:00Z" }];
  const result = parse("employee-1", events, { now: Date.parse("2026-03-09T00:00:00Z"), timeZone: "America/New_York",
    workdayStart: "22:00", workdayEnd: "06:00", workDays: ["Sat"] });
  assert.equal(result[0].meetingMinutes, 60); assert.equal(result[0].afterHoursMinutes, 0);
});
test("calendar classification respects selected workdays and disabled after-hours stays unknown", () => {
  const load = createLoader(), parse = load("src/lib/integrations/calendarConnector.ts").parseCalendarBlocksToSignals;
  const events = [{ start: "2026-10-04T10:00:00Z", end: "2026-10-04T11:00:00Z" }];
  const options = { now: Date.parse("2026-10-05T00:00:00Z"), timeZone: "UTC", workdayStart: "09:00", workdayEnd: "18:00", workDays: ["Mon"] };
  assert.equal(parse("employee-1", events, options)[0].afterHoursMinutes, 60);
  const unknown = parse("employee-1", events, { ...options, afterHoursObserved: false })[0];
  assert.equal(unknown.meetingMinutes, 60); assert.equal(unknown.afterHoursMinutes, 0);
  assert.deepEqual(plain(unknown.observedMetrics), ["meetingLoad"]);
  const snapshot = load("src/lib/signals/metricsMapper.ts").signalToMetrics(unknown);
  const validate = load("src/lib/integrations/sourceSnapshotValidator.ts").validateSourceSnapshots;
  const now = Date.parse("2026-10-05T00:00:00Z");
  assert.equal(validate([snapshot], "employee-1", "google_calendar", new Date(now).toISOString(), now).length, 1);
  assert.throws(() => validate([{ ...snapshot, afterHoursActivity: 1 }], "employee-1", "google_calendar", new Date(now).toISOString(), now));
});
