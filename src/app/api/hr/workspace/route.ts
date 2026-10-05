import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/serverAuth";
import { getServerHRWorkspace } from "@/lib/wellbeing/serverHRWorkspace";

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (user.role !== "hr") return NextResponse.json({ error: "HR access required." }, { status: 403 });
  if (user.source !== "supabase") return NextResponse.json({ error: "A verified organization account is required. Local demonstration data is separate." }, { status: 409 });
  const workspace = await getServerHRWorkspace();
  return NextResponse.json(workspace, { status: workspace.available ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
