import { NextResponse } from "next/server";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
function scriptJson(value: unknown) { return JSON.stringify(value).replace(/</g, "\\u003c"); }

/** Query parameters and provider identities never become executable HTML or JS. */
export function popupResponse(origin: string, provider: string, message: string, data?: Record<string, unknown>, status = 200) {
  const successScript = data ? `if (window.opener) window.opener.postMessage(${scriptJson(data)}, ${scriptJson(origin)}); setTimeout(() => window.close(), 1200);` : "";
  return new NextResponse(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(provider)} connection</title></head>
    <body style="font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#fff;margin:0">
      <main style="max-width:380px;padding:32px;text-align:center;border:1px solid #334155;border-radius:16px;background:#1e293b">
        <h1 style="font-size:20px">${escapeHtml(provider)} ${data ? "connected" : "connection notice"}</h1>
        <p style="font-size:14px;color:#cbd5e1">${escapeHtml(message)}</p>
        <button onclick="window.close()" style="padding:8px 16px;border:0;border-radius:8px">Close window</button>
      </main><script>${successScript}</script>
    </body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
