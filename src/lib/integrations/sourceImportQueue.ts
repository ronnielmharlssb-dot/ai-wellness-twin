"use client";

import { getLocalSessionUser } from "../supabase/auth";
import { saveEmployeeMetricsBatch } from "../wellbeing/employeeMetrics";
import { decodeCloudMetrics } from "../wellbeing/observationCodec";
import { PERMANENT_UPLOAD_FAILURES } from "../telemetry/pendingObservations";
import { markImportState } from "./integrationStore";
import { validateSourceSnapshots, type ImportSource } from "./sourceSnapshotValidator";
import { cancelSourceImports, claimSourceImport, listSourceImports, pruneSourceImportReceipts, retrySourceImports, saveSourceImport, settleSourceImport,
  type SourceImportBatch } from "./sourceImportStore";

export type SourceImportState = { employeeId: string; pending: number; needsReview: number; inMemory: number; uploading: number; error: string | null };
type UploadOutcome = "synced" | "pending" | "needs_review";
export class SourceImportQueue {
  private employeeId = "";
  private running = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing: Promise<void> | null = null;
  private generation = 0;
  private controllers = new Map<string, { employeeId: string; provider: ImportSource; controller: AbortController }>();
  private memory = new Map<string, SourceImportBatch>();
  private originals = new Map<string, SourceImportBatch>();
  private listeners = new Set<(state: SourceImportState) => void>();
  private channel: BroadcastChannel | null = null;
  private state: SourceImportState = { employeeId: "", pending: 0, needsReview: 0, inMemory: 0, uploading: 0, error: null };

  public getState() { return { ...this.state }; }
  public subscribe(listener: (state: SourceImportState) => void) {
    this.listeners.add(listener); listener(this.getState());
    return () => { this.listeners.delete(listener); };
  }
  private owns(employeeId: string) {
    const user = getLocalSessionUser();
    return user?.id === employeeId && user.role === "employee" && user.source === "supabase";
  }
  private requireOwner(employeeId: string) {
    if (!this.owns(employeeId)) throw new Error("Your active employee account changed. This import is retained for its original account.");
  }
  private notify() {
    this.listeners.forEach((listener) => listener(this.getState()));
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("wellness-import-queue-update", { detail: { employeeId: this.employeeId } }));
  }
  private async refresh(employeeId: string) {
    if (!this.owns(employeeId) || this.employeeId !== employeeId) return;
    const memory = [...this.memory.values()].filter((batch) => batch.employeeId === employeeId);
    try {
      const stored = await listSourceImports(employeeId);
      if (!this.owns(employeeId) || this.employeeId !== employeeId) return;
      const all = [...stored, ...memory];
      this.state = { employeeId, pending: all.filter((batch) => batch.status === "pending").length,
        needsReview: all.filter((batch) => batch.status !== "pending" && batch.status !== "acknowledged").length, inMemory: memory.length,
        uploading: [...this.controllers.values()].filter((request) => request.employeeId === employeeId).length,
        error: memory.length ? "Some imports could not be saved on this device. Keep this page open and retry." :
          stored.find((batch) => batch.status === "pending" && batch.reason)?.reason ?? null };
    } catch {
      if (this.employeeId !== employeeId) return;
      this.state = { ...this.state, employeeId, inMemory: memory.length, uploading: [...this.controllers.values()].filter((request) => request.employeeId === employeeId).length,
        pending: Math.max(this.state.pending, memory.filter((batch) => batch.status === "pending").length),
        needsReview: Math.max(this.state.needsReview, memory.filter((batch) => batch.status === "rejected").length),
        error: "Persistent import storage is unavailable. Keep this page open and retry." };
    }
    this.notify();
  }
  public start(employeeId: string) {
    if (this.running && this.employeeId === employeeId) return;
    this.stop();
    if (!this.owns(employeeId)) return;
    this.employeeId = employeeId; this.running = true;
    this.state = { employeeId, pending: 0, needsReview: 0, inMemory: 0, uploading: 0, error: null };
    window.addEventListener("online", this.wake);
    window.addEventListener("wellness-auth-update", this.handleIdentity);
    window.addEventListener("storage", this.handleStorage);
    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel("wellness-source-imports");
      this.channel.onmessage = (event) => { if (event.data?.employeeId === this.employeeId) void this.flush(); };
    }
    this.timer = setInterval(() => { void this.flush(); }, 30000);
    void this.flush();
  }
  public stop() {
    this.running = false; this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.wake);
      window.removeEventListener("wellness-auth-update", this.handleIdentity);
      window.removeEventListener("storage", this.handleStorage);
    }
    this.controllers.forEach(({ controller }) => controller.abort());
    this.channel?.close(); this.channel = null;
    this.employeeId = "";
    this.state = { employeeId: "", pending: 0, needsReview: 0, inMemory: 0, uploading: 0, error: null };
    this.notify();
  }
  private handleIdentity = () => { if (!this.owns(this.employeeId)) this.stop(); else void this.retry(); };
  private handleStorage = (event: StorageEvent) => { if (event.key === "wellness-auth-user" || event.key === null) this.handleIdentity(); };
  private wake = () => { void this.retry(); };
  public async enqueue(employeeId: string, provider: ImportSource, snapshots: unknown, capturedAt: string) {
    this.requireOwner(employeeId);
    const batch: SourceImportBatch = { version: 1, id: crypto.randomUUID(), employeeId, provider, capturedAt,
      snapshots: validateSourceSnapshots(snapshots, employeeId, provider, capturedAt),
      enqueuedAt: new Date().toISOString(), status: "pending", attempts: 0, nextAttemptAt: 0 };
    this.originals.set(batch.id, batch);
    try { await saveSourceImport(batch); }
    catch { this.memory.set(batch.id, batch); }
    this.requireOwner(employeeId);
    this.channel?.postMessage({ employeeId });
    await this.refresh(employeeId);
    return batch.id;
  }
  private async persistMemory(employeeId: string) {
    for (const batch of this.memory.values()) {
      if (batch.employeeId !== employeeId) continue;
      this.requireOwner(employeeId);
      await saveSourceImport(batch);
      this.memory.delete(batch.id);
    }
  }
  public hasUnsavedImports(employeeId: string) {
    this.requireOwner(employeeId);
    return [...this.memory.values()].some((batch) => batch.employeeId === employeeId);
  }
  public async upload(employeeId: string, id?: string): Promise<UploadOutcome> {
    this.requireOwner(employeeId);
    try { await this.persistMemory(employeeId); }
    catch { await this.refresh(employeeId); return "pending"; }
    const owner = crypto.randomUUID();
    const batch = await claimSourceImport(employeeId, owner, Date.now(), id);
    if (!batch) {
      if (!id) return "pending";
      const existing = (await listSourceImports(employeeId)).find((item) => item.id === id);
      if (existing?.status === "acknowledged") { this.originals.delete(id); return "synced"; }
      if (!existing) {
        const original = this.originals.get(id);
        if (original && original.employeeId === employeeId) this.memory.set(id, original);
        await this.refresh(employeeId);
      }
      return existing?.status === "rejected" ? "needs_review" : "pending";
    }
    let outcome: UploadOutcome = "pending";
    const controller = new AbortController();
    this.controllers.set(batch.id, { employeeId, provider: batch.provider, controller });
    await this.refresh(employeeId);
    try {
      this.requireOwner(employeeId);
      try {
        if (batch.version !== 1) throw new Error("Unrecognized saved import format.");
        validateSourceSnapshots(batch.snapshots, employeeId, batch.provider, batch.capturedAt);
      } catch (error) {
        await settleSourceImport(employeeId, batch.id, owner, { status: "rejected", nextAttemptAt: 0,
          reason: error instanceof Error ? error.message : "Invalid saved import. Retained for review." });
        if (this.owns(employeeId)) markImportState(employeeId, batch.provider, batch.capturedAt, "needs_review");
        this.originals.delete(batch.id);
        return "needs_review";
      }
      const response = await fetch("/api/telemetry/source-snapshots", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshots: batch.snapshots, capturedAt: batch.capturedAt }),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) });
      this.requireOwner(employeeId);
      if (!response.ok && PERMANENT_UPLOAD_FAILURES.has(response.status)) {
        await settleSourceImport(employeeId, batch.id, owner, { status: "rejected", nextAttemptAt: 0,
          reason: `Server rejected this import (${response.status}). Retained for review.` });
        markImportState(employeeId, batch.provider, batch.capturedAt, "needs_review");
        this.originals.delete(batch.id);
        return "needs_review";
      }
      if (!response.ok) throw new Error(`Import upload failed (${response.status}). Retained for retry.`);
      const result = await response.json();
      this.requireOwner(employeeId);
      if (!result.success) throw new Error("Invalid import acknowledgement. Retained for retry.");
      const metrics = decodeCloudMetrics(result.dailyMetrics, employeeId);
      const dates = new Set(batch.snapshots.map((snapshot) => snapshot.date));
      if (metrics.length !== dates.size || metrics.some((metric) => !dates.has(metric.date))) throw new Error("Incomplete import acknowledgement. Retained for retry.");
      // No draft metrics enter assessment before a valid cloud acknowledgement.
      saveEmployeeMetricsBatch(metrics);
      markImportState(employeeId, batch.provider, batch.capturedAt, "synced");
      if (await settleSourceImport(employeeId, batch.id, owner, { status: "acknowledged" })) {
        outcome = "synced"; this.originals.delete(batch.id);
      }
      window.dispatchEvent(new CustomEvent("wellness-telemetry-update"));
    } catch (error) {
      const cancelled = controller.signal.aborted || !this.owns(employeeId);
      await settleSourceImport(employeeId, batch.id, owner, { status: "pending",
        reason: cancelled ? "Upload interrupted. Retained for its original employee account." : error instanceof Error ? error.message : "Import upload failed. Retained for retry.",
        nextAttemptAt: cancelled ? 0 : Date.now() + Math.min(300000, 5000 * 2 ** Math.min(batch.attempts, 6)) });
    } finally {
      this.controllers.delete(batch.id);
      await this.refresh(employeeId);
    }
    return outcome;
  }
  public flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (!this.running || !this.owns(this.employeeId)) return Promise.resolve();
    const employeeId = this.employeeId, generation = this.generation;
    this.flushing = (async () => {
      try {
        await pruneSourceImportReceipts(employeeId);
        await this.persistMemory(employeeId);
        for (let count = 0; count < 50 && this.running && this.generation === generation && this.owns(employeeId); count++) {
          const pending = (await listSourceImports(employeeId)).filter((batch) => batch.status === "pending" && batch.nextAttemptAt <= Date.now() && (batch.leaseUntil ?? 0) <= Date.now());
          if (!pending.length) break;
          if (await this.upload(employeeId, pending[0].id) === "pending") break;
        }
      } catch { /* A failed durable write/read is surfaced by refresh and retried. */ }
      finally { await this.refresh(employeeId); }
    })().finally(() => {
      this.flushing = null;
      if (this.running && this.generation !== generation) void this.flush();
    });
    return this.flushing;
  }
  public async retry() {
    const employeeId = this.employeeId;
    if (!this.owns(employeeId)) return;
    try { await retrySourceImports(employeeId); }
    catch { /* Memory persistence may still recover on flush. */ }
    await this.flush();
  }
  public async cancelProvider(employeeId: string, provider: ImportSource) {
    this.requireOwner(employeeId);
    this.controllers.forEach((request) => { if (request.employeeId === employeeId && request.provider === provider) request.controller.abort(); });
    await cancelSourceImports(employeeId, provider);
    for (const batch of this.memory.values()) if (batch.employeeId === employeeId && batch.provider === provider) {
      batch.status = "rejected"; batch.reason = "Account unlinked. Upload cancelled; observations retained for review.";
    }
    await this.refresh(employeeId);
  }
  public async getRejected(employeeId: string): Promise<SourceImportBatch[]> {
    this.requireOwner(employeeId);
    let stored: SourceImportBatch[];
    try { stored = await listSourceImports(employeeId); }
    catch (error) {
      if (![...this.memory.values()].some((batch) => batch.employeeId === employeeId && batch.status === "rejected")) throw error;
      stored = [];
    }
    this.requireOwner(employeeId);
    return [...stored, ...this.memory.values()].filter((batch) => batch.employeeId === employeeId && batch.status !== "pending" && batch.status !== "acknowledged");
  }
}
export const sourceImportQueue = new SourceImportQueue();
