import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedUser, isSameOriginRequest } from "@/lib/supabase/serverAuth";

const response = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
async function employee() {
  const user = await getAuthenticatedUser();
  if (!user) return { error: response({ error: "Authentication required." }, 401) };
  if (user.role !== "employee") return { error: response({ error: "Employee access required." }, 403) };
  if (user.source !== "supabase") return { error: response({ error: "Group sharing requires a verified organization account." }, 409) };
  return { user };
}
export async function GET() {
  const auth = await employee();
  if (auth.error) return auth.error;
  try {
    const client = await createClient();
    if (!client) throw new Error("Unavailable backend.");
    const { data, error } = await client.from("organization_members")
      .select("organization_id,shares_aggregates,organizations(name)")
      .eq("user_id", auth.user!.id).eq("role", "employee").eq("active", true);
    if (error || !Array.isArray(data)) throw new Error("Unavailable memberships.");
    const memberships = data.map((row) => {
      const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
      if (!uuid.test(row.organization_id) || typeof row.shares_aggregates !== "boolean" || typeof organization?.name !== "string") throw new Error("Invalid membership.");
      return { organizationId: row.organization_id, organizationName: organization.name.slice(0, 200), enabled: row.shares_aggregates };
    });
    return response({ memberships });
  } catch { return response({ error: "Organization sharing is unavailable. Your stored consent has not changed." }, 503); }
}
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return response({ error: "Invalid request origin." }, 403);
  const auth = await employee();
  if (auth.error) return auth.error;
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2048) return response({ error: "Request is too large." }, 413);
    body = JSON.parse(raw);
    if (!body || Array.isArray(body) || Object.keys(body).some((key) => !["organizationId", "enabled"].includes(key)) ||
      !uuid.test(body.organizationId) || typeof body.enabled !== "boolean") throw new Error("Invalid consent.");
  } catch { return response({ error: "A verified organization ID and a boolean sharing preference are required." }, 400); }
  try {
    const client = await createClient();
    if (!client) throw new Error("Unavailable backend.");
    const { data, error } = await client.from("organization_members").update({ shares_aggregates: body.enabled })
      .eq("organization_id", body.organizationId).eq("user_id", auth.user!.id).eq("role", "employee").eq("active", true)
      .select("organization_id,shares_aggregates");
    if (error || !Array.isArray(data)) throw new Error("Consent could not be saved.");
    if (data.length !== 1) return response({ error: "No active employee membership was found for this organization." }, 403);
    return response({ organizationId: body.organizationId, enabled: data[0].shares_aggregates });
  } catch { return response({ error: "Sharing preference could not be saved. Please retry." }, 503); }
}
