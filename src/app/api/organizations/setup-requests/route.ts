import { NextResponse } from "next/server";
import { getAuthenticatedUser, isSameOriginRequest } from "@/lib/supabase/serverAuth";
import { readBoundedJson, RequestBodyError } from "@/lib/http/readBoundedJson";
import { parseOrganizationSetupSubmission, OrganizationSetupValidationError } from "@/lib/organizations/setupRequest";
import { readOrganizationSetupRequests, saveOrganizationSetupRequest, OrganizationSetupError } from "@/lib/organizations/setupRequestServer";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
function failure(error: unknown) {
  if (error instanceof OrganizationSetupError) return json({ success: false, error: error.message }, error.status);
  if (error instanceof RequestBodyError) return json({ success: false, error: error.message }, error.status);
  if (error instanceof OrganizationSetupValidationError) return json({ success: false, error: error.message }, 400);
  return json({ success: false, error: "Organization setup is temporarily unavailable. Please try again later." }, 503);
}
export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return json({ success: false, error: "Sign in to view your organization setup requests." }, 401);
    return json({ success: true, accountId: user.id, requests: await readOrganizationSetupRequests(user) });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return json({ success: false, error: "Invalid request origin." }, 403);
  try {
    const user = await getAuthenticatedUser();
    if (!user) return json({ success: false, error: "Sign in before requesting organization setup." }, 401);
    if (user.source !== "supabase") return json({ success: false, error: "Organization setup requires a verified personal account." }, 403);
    const submission = parseOrganizationSetupSubmission(await readBoundedJson(request));
    return json({ success: true, accountId: user.id, request: await saveOrganizationSetupRequest(user, submission) });
  } catch (error) { return failure(error); }
}
