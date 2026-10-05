const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createLoader } = require("./load-typescript.cjs");
const group = { id: "00000000-0000-4000-8000-000000000030", name: "Verified group", organization_id: "00000000-0000-4000-8000-000000000020" };

function workspace(groups, observations, error = null) {
  const load = createLoader({}, { "../supabase/server": { createClient: async () => ({
    from: () => ({ select: () => ({ order: async () => ({ data: groups, error }) }) }),
    rpc: async () => ({ data: observations, error }),
  }) } });
  return load("src/lib/wellbeing/serverHRWorkspace.ts").getServerHRWorkspace();
}
test("the HR serializer returns only authorized group aggregate fields and preserves missing metrics", async () => {
  const row = { group_id: group.id, organization_id: group.organization_id, date: "2026-10-03", working_hours: "8.25",
    meeting_load: null, break_frequency: "4", after_hours_activity: 30, employee_id: "must-not-leak", personal_score: 80 };
  const result = await workspace([group], [row, { ...row, group_id: "other-group" }]);
  assert.equal(result.available, true);
  assert.equal(result.groups[0].observations.length, 1);
  assert.equal(result.groups[0].observations[0].workingHours, 8.25);
  assert.equal(result.groups[0].observations[0].meetingLoad, null);
  assert.equal(JSON.stringify(result).includes("must-not-leak"), false);
  assert.equal(JSON.stringify(result).includes("personal_score"), false);
});
test("backend errors or malformed aggregate values produce unavailable state", async () => {
  assert.equal((await workspace([], [], { message: "Missing migration" })).available, false);
  assert.equal((await workspace([group], [{ group_id: group.id, organization_id: group.organization_id, date: "2026-02-30" }])).available, false);
  assert.equal((await workspace([group], [{ group_id: group.id, organization_id: group.organization_id, date: "2026-10-03", working_hours: "NaN" }])).available, false);
});
test("the HR endpoint rejects anonymous, employee and demo sessions before reading aggregates", async () => {
  let user = null, reads = 0;
  const load = createLoader({}, {
    "@/lib/supabase/serverAuth": { getAuthenticatedUser: async () => user },
    "@/lib/wellbeing/serverHRWorkspace": { getServerHRWorkspace: async () => { reads++; return { available: true, groups: [] }; } },
  });
  const { GET } = load("src/app/api/hr/workspace/route.ts");
  assert.equal((await GET()).status, 401);
  user = { role: "employee", source: "supabase" };
  assert.equal((await GET()).status, 403);
  user = { role: "hr", source: "demo" };
  assert.equal((await GET()).status, 409);
  assert.equal(reads, 0);
  user.source = "supabase";
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(reads, 1);
});
test("HR presentation escapes group labels and does not convert withheld metrics to zero", () => {
  const { default: Overview } = createLoader()("src/app/hr/ServerOverview.tsx");
  const html = renderToStaticMarkup(React.createElement(Overview, { workspace: { available: true, groups: [{ id: group.id,
    name: "<script>private</script>", organizationId: group.organization_id,
    observations: [{ date: "2026-10-03", workingHours: null, meetingLoad: 2, breakFrequency: null, afterHoursActivity: null }] }] } }));
  assert.equal(html.includes("<script>private</script>"), false);
  assert.ok(html.includes("Withheld / unavailable"));
  assert.ok(html.includes("2.00 h"));
  assert.equal(html.includes("0.00 h"), false);
});
