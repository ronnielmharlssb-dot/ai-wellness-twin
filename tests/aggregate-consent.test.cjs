const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader } = require("./load-typescript.cjs");
const organizationId = "00000000-0000-4000-8000-000000000020";
test("consent changes require the employee's session and bind database updates to that employee", async () => {
  let user = null, updates = 0, found = true;
  const filters = {};
  const query = { eq: (key, value) => { filters[key] = value; return query; },
    select: async () => ({ data: found ? [{ organization_id: organizationId, shares_aggregates: true }] : [], error: null }) };
  const load = createLoader({}, {
    "@/lib/supabase/serverAuth": { getAuthenticatedUser: async () => user, isSameOriginRequest: (request) => request.headers.get("origin") === "http://localhost" },
    "@/lib/supabase/server": { createClient: async () => ({ from: (table) => ({ update: (changes) => {
      assert.equal(table, "organization_members");
      assert.deepEqual(Object.keys(changes), ["shares_aggregates"]);
      updates++; return query;
    } }) }) },
  });
  const { POST } = load("src/app/api/organizations/aggregate-consent/route.ts");
  const request = (body = { organizationId, enabled: true }, origin = "http://localhost") => new Request("http://localhost/api/organizations/aggregate-consent", { method: "POST", headers: { origin }, body: JSON.stringify(body) });
  assert.equal((await POST(request())).status, 401);
  user = { id: "employee-1", role: "hr", source: "supabase" };
  assert.equal((await POST(request())).status, 403);
  user.role = "employee";
  user.source = "demo";
  assert.equal((await POST(request())).status, 409);
  user.source = "supabase";
  assert.equal((await POST(request({}, "https://other.example"))).status, 403);
  assert.equal((await POST(request({ organizationId, enabled: true, userId: "employee-2" }))).status, 400);
  assert.equal(updates, 0);
  assert.equal((await POST(request())).status, 200);
  assert.deepEqual(filters, { organization_id: organizationId, user_id: "employee-1", role: "employee", active: true });
  found = false;
  assert.equal((await POST(request())).status, 403);
});
