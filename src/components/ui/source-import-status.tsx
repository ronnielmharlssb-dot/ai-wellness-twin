"use client";

import { useEffect, useState } from "react";
import { sourceImportQueue, type SourceImportState } from "@/lib/integrations/sourceImportQueue";
import type { SourceImportBatch } from "@/lib/integrations/sourceImportStore";

export function SourceImportStatus({ employeeId }: { employeeId: string }) {
  const [state, setState] = useState<SourceImportState>(sourceImportQueue.getState());
  const [review, setReview] = useState<SourceImportBatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => sourceImportQueue.subscribe(setState), []);
  if (state.employeeId !== employeeId || (!state.pending && !state.needsReview && !state.error)) return null;
  const openReview = async () => {
    try { setReview(await sourceImportQueue.getRejected(employeeId)); setError(null); }
    catch { setError("Retained imports could not be read. Retry when device storage is available."); }
  };
  const download = async () => {
    try {
      const batches = await sourceImportQueue.getRejected(employeeId);
      const records = batches.map(({ provider, capturedAt, snapshots, reason }) => ({ provider, capturedAt, snapshots, reason }));
      const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: "application/json" }));
      const link = document.createElement("a"); link.href = url; link.download = "wellness-imports-for-review.json"; link.click(); URL.revokeObjectURL(url);
    } catch { setError("Retained imports could not be exported. Retry when device storage is available."); }
  };
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
      <p role="status">{state.inMemory ? `${state.inMemory} imports are only held in memory. Keep this page open and retry saving them.`
        : state.pending ? `${state.pending} imports are queued on this device. Uploads retry while you are signed in on the dashboard.`
        : state.needsReview ? `${state.needsReview} imports need review.` : "Import storage is currently unavailable. Retry when device storage is available."}</p>
      {state.needsReview > 0 && state.pending > 0 && <p className="mt-1">{state.needsReview} other imports need review.</p>}
      {state.error && <p className="mt-1 text-xs">{state.error}</p>}
      {error && <p role="alert" className="mt-1 text-xs">{error}</p>}
      <div className="mt-2 flex flex-wrap gap-4 text-xs font-semibold">
        {state.pending > 0 && <button type="button" disabled={state.uploading > 0} onClick={() => void sourceImportQueue.retry()} className="disabled:opacity-50">{state.uploading ? "Uploading..." : "Retry queued imports"}</button>}
        {state.needsReview > 0 && <button type="button" onClick={() => void openReview()}>Review retained imports</button>}
      </div>
      {review && <div className="mt-3 space-y-2 border-t border-amber-200 pt-3 dark:border-amber-900">
        <p className="text-xs">Rejected, expired and cancelled imports stay on this device for review. Fresh imports can still upload.</p>
        {review.map((batch) => <p key={batch.id} className="text-xs">{batch.provider === "google_calendar" ? "Calendar" : batch.provider === "github" ? "GitHub" : "Unrecognized source"} · {Number.isFinite(Date.parse(batch.capturedAt)) ? new Date(batch.capturedAt).toLocaleString() : "Unknown capture time"} · {typeof batch.reason === "string" ? batch.reason : "Unrecognized saved metadata. Retained for review."}</p>)}
        <div className="flex gap-4 text-xs font-semibold"><button type="button" onClick={() => void download()}>Download retained imports</button><button type="button" onClick={() => setReview(null)}>Close review</button></div>
      </div>}
    </div>
  );
}
