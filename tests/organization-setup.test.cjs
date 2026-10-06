const test = require("node:test");
const assert = require("node:assert/strict");
const { createLoader, plain } = require("./load-typescript.cjs");
const actor = { id: "00000000-0000-0000-0000-000000000001", source: "supabase", role: "employee" };
const submission = { accountId: actor.id, requestId: "10000000-0000-0000-0000-000000000001", companyName: "Example", domain: "example.com", teamSize: "1-10" };
const row = { id: submission.requestId, requester_id: actor.id, company_name: "Example", domain: "example.com", team_size: "1-10", status: "pending", created_at: "2026-10-06T00:00:00Z", reviewed_at: null, organization_id: null };
function fixture(user = actor, response = { data: row, error: null }) {
  const calls = [];
  const query = { select: fields => { calls.push(["select", fields]); return query; }, eq: (...args) => { calls.push(["eq", ...args]); return query; }, order: (...args) => { calls.push(["order", ...args]); return query; }, limit: count => { calls.push(["limit", count]); return Promise.resolve(response); } };
  const client = { rpc: async (...args) => { calls.push(["rpc", ...args]); return response; }, from: table => { calls.push(["from", table]); return query; } };
  const load = createLoader({}, {
    "../supabase/server": { createClient: async () => client },
    "@/lib/supabase/serverAuth": { getAuthenticatedUser: async () => { calls.push(["auth"]); return user; }, isSameOriginRequest: createLoader()("src/lib/http/requestOrigin.ts").isSameOriginRequest },
  });
  return { calls, route: load("src/app/api/organizations/setup-requests/route.ts"), server: load("src/lib/organizations/setupRequestServer.ts"), retired: load("src/app/api/organizations/verify-kyb/route.ts") };
}
const request = (body = submission, origin = "https://wellness.example") => new Request("https://wellness.example/api/organizations/setup-requests", { method: "POST", headers: origin ? { origin } : {}, body: typeof body === "string" ? body : JSON.stringify(body) });

test("organization mutations reject origin first, anonymous and demo accounts without database writes", async () => {
  const foreign = fixture();
  assert.equal((await foreign.route.POST(request(submission, "https://other.example"))).status, 403);
  assert.deepEqual(foreign.calls, []);
  for (const [user, status] of [[null, 401], [{ ...actor, source: "demo" }, 403]]) {
    const f = fixture(user);
    assert.equal((await f.route.POST(request())).status, status);
    assert.equal((await f.route.GET()).status, status);
    assert.ok(!f.calls.some(call => call[0] === "rpc" || call[0] === "from"));
  }
});
test("untrusted authority, oversized requests and account switches cannot submit", async () => {
  for (const [body, status] of [[{ ...submission, role: "hr" }, 400], [{ ...submission, verified: true }, 400], ["not-json", 400], ["x".repeat(17000), 413], [{ ...submission, accountId: "00000000-0000-0000-0000-000000000002" }, 409]]) {
    const f = fixture();
    const response = await f.route.POST(request(body));
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.ok(!f.calls.some(call => call[0] === "rpc"));
  }
});
test("only a matching committed receipt can report organization submission success", async () => {
  const f = fixture({ ...actor, role: "hr" });
  const response = await f.route.POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(plain(f.calls.find(call => call[0] === "rpc")), ["rpc", "submit_organization_setup_request", { p_request_id: submission.requestId, p_company_name: "Example", p_domain: "example.com", p_team_size: "1-10" }]);
  assert.equal((await response.json()).request.status, "pending");
  for (const data of [null, { ...row, requester_id: "other" }, { ...row, domain: "other.com" }, { ...row, status: "approved" }]) {
    assert.equal((await fixture(actor, { data, error: null }).route.POST(request())).status, 503);
  }
});
test("database failures are sanitized and request history rechecks ownership", async () => {
  for (const [code, status] of [["23505", 409], ["42501", 403], ["42P01", 503]]) {
    const response = await fixture(actor, { data: null, error: { code, message: "secret provider diagnostic" } }).route.POST(request());
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /secret provider diagnostic/);
  }
  const f = fixture(actor, { data: [row], error: null });
  assert.equal((await f.route.GET()).status, 200);
  assert.ok(f.calls.some(call => call[0] === "eq" && call[1] === "requester_id" && call[2] === actor.id));
  assert.ok(f.calls.some(call => call[0] === "limit" && call[1] === 10));
  assert.equal((await fixture(actor, { data: [{ ...row, requester_id: "other" }], error: null }).route.GET()).status, 503);
});
test("retired business verification never reads or verifies submitted tax data", async () => {
  for (const [user, expected] of [[null, 401], [actor, 410], [{ ...actor, role: "hr" }, 410]]) {
    const f = fixture(user);
    const req = request("not-json");
    req.json = () => { throw Error("Must not parse tax data"); };
    assert.equal((await f.retired.POST(req)).status, expected);
    assert.ok(!f.calls.some(call => call[0] === "rpc"));
  }
});
test("browser acknowledgements reject wrong accounts, missing receipts and network failures", async () => {
  const receipt = { id: row.id, companyName: row.company_name, domain: row.domain, teamSize: row.team_size, status: row.status, createdAt: row.created_at, reviewedAt: null, organizationId: null };
  const body = { success: true, accountId: actor.id, request: receipt };
  for (const result of [{ ...body, accountId: "other" }, { ...body, request: null }, { ...body, request: { ...receipt, companyName: "Other" } }, { success: true }]) {
    const client = createLoader({ fetch: async () => Response.json(result) })("src/lib/organizations/setupRequestClient.ts");
    await assert.rejects(client.submitOrganizationSetupRequest(submission), /could not be confirmed/);
  }
  const failed = createLoader({ fetch: async () => { throw Error("private diagnostic"); } })("src/lib/organizations/setupRequestClient.ts");
  await assert.rejects(failed.submitOrganizationSetupRequest(submission), error => !error.message.includes("private diagnostic"));
  const valid = createLoader({ fetch: async () => Response.json(body) })("src/lib/organizations/setupRequestClient.ts");
  assert.equal((await valid.submitOrganizationSetupRequest(submission)).id, submission.requestId);
});
