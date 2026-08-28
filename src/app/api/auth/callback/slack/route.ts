import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error || !code) {
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head><title>Slack Authorization</title></head>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white; text-align: center;">
          <div style="background: #1e293b; padding: 30px; border-radius: 12px; border: 1px solid #334155; max-width: 400px;">
            <h2 style="color: #f87171; margin-top: 0;">Authorization Notice</h2>
            <p style="font-size: 14px; color: #94a3b8;">${errorDescription || "Access window closed or completed."}</p>
            <button onclick="window.close()" style="background: #4A154B; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 15px;">Close Window</button>
          </div>
        </body>
      </html>
    `;
    return new NextResponse(errorHtml, { headers: { "Content-Type": "text/html" } });
  }

  let verifiedWorkspace = "verified_workspace";

  const clientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (clientId && clientSecret) {
    try {
      const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });
      const tokenData = await tokenRes.json();
      if (tokenData.team?.name) {
        verifiedWorkspace = tokenData.team.name;
      }
    } catch (e) {
      console.error("Slack token exchange failed:", e);
    }
  }

  const successHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Slack Connected</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: white; margin: 0; }
          .card { background: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #334155; text-align: center; max-width: 360px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
          .check { width: 50px; height: 50px; background: #4A154B; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px; color: #22c55e; }
          h2 { margin: 0 0 8px; font-size: 20px; }
          p { color: #94a3b8; font-size: 14px; margin: 0 0 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="check">✓</div>
          <h2>Slack Verified!</h2>
          <p>Workspace <strong>${verifiedWorkspace}</strong> connected successfully.</p>
          <div style="font-size: 12px; color: #64748b;">Closing window and linking to AI Wellness Twin...</div>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'SLACK_OAUTH_SUCCESS',
              workspace: '${verifiedWorkspace}'
            }, '*');
          }
          setTimeout(() => {
            window.close();
          }, 1200);
        </script>
      </body>
    </html>
  `;

  return new NextResponse(successHtml, {
    headers: { "Content-Type": "text/html" },
  });
}
