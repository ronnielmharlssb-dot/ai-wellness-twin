"use client";
import { getLocalSessionUser } from "../supabase/auth";
import { saveEmployeeMetricsBatch } from "../wellbeing/employeeMetrics";
import { decodeHeartbeatAcknowledgement } from "./heartbeatAcknowledgement";
import { sanitizeAndValidateHeartbeat, type ValidatedHeartbeat } from "./serverSanitizer";
import { readPendingObservations, PERMANENT_UPLOAD_FAILURES, type RejectedObservation } from "./pendingObservations";
import { claimHeartbeatRow, listHeartbeatRows, retryHeartbeatRows, saveHeartbeatRows, settleHeartbeatRow, type HeartbeatQueueRow } from "./heartbeatQueueStore";

export type HeartbeatQueueState = { pendingEvents: number; rejectedEvents: number; memoryOnlyEvents: number; error: string | null; lastHeartbeat: string | null };
async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}
async function packetRow(event: ValidatedHeartbeat): Promise<HeartbeatQueueRow> {
  const validated = sanitizeAndValidateHeartbeat(event);
  if (!validated.data) return reviewRow(event.employeeId, { observation: event, reason: validated.error ?? "Invalid observation.", rejectedAt: new Date().toISOString() });
  event = validated.data;
  return { id: "event:" + JSON.stringify([event.employeeId, event.source, event.eventId]), employeeId: event.employeeId,
    observation: event, fingerprint: await hash(JSON.stringify(event)), status: "pending", createdAt: Date.now(), attempts: 0, nextAttemptAt: 0 };
}
async function reviewRow(employeeId: string, review: RejectedObservation): Promise<HeartbeatQueueRow> {
  const fingerprint = await hash(JSON.stringify(review.observation));
  return { id: "review:" + JSON.stringify([employeeId, fingerprint]), employeeId, fingerprint, observation: review.observation,
    status: "rejected", createdAt: Date.now(), attempts: 0, nextAttemptAt: 0, reason: review.reason, rejectedAt: review.rejectedAt };
}
/** Account-wide durable queues. Leases coordinate tabs; server event IDs make crash replays safe. */
export class HeartbeatQueueService {
  private employeeId = "";
  private generation = 0;
  private running = false;
  private paused = true;
  private owner = "";
  private ready: Promise<void> = Promise.resolve();
  private writes: Promise<void> = Promise.resolve();
  private flight: Promise<void> | null = null;
  private controller: AbortController | null = null;
  private memory = new Map<string, HeartbeatQueueRow>();
  private persisted: HeartbeatQueueRow[] = [];
  private legacyNeedsRecovery = false;
  private state: HeartbeatQueueState = { pendingEvents: 0, rejectedEvents: 0, memoryOnlyEvents: 0, error: null, lastHeartbeat: null };
  private listeners = new Set<() => void>();
  public subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private own(employeeId = this.employeeId) {
    const user = getLocalSessionUser();
    return user?.role === "employee" && user.id === employeeId;
  }
  public getState(): HeartbeatQueueState {
    return this.own() ? { ...this.state } : { pendingEvents: 0, rejectedEvents: 0, memoryOnlyEvents: 0, error: null, lastHeartbeat: null };
  }
  private notify() {
    const rows = new Map(this.persisted.map(row => [row.id, row]));
    for (const row of this.memory.values()) if (row.employeeId === this.employeeId && !rows.has(row.id)) rows.set(row.id, row);
    this.state.pendingEvents = [...rows.values()].filter(row => row.status === "pending").length;
    this.state.rejectedEvents = [...rows.values()].filter(row => row.status === "rejected").length;
    this.state.memoryOnlyEvents = [...this.memory.values()].filter(row => row.employeeId === this.employeeId && !this.persisted.some(saved => saved.id === row.id)).length;
    this.listeners.forEach(listener => listener());
  }
  private active(id: string, generation: number) { return this.running && this.own(id) && this.employeeId === id && this.generation === generation; }
  public start(employeeId: string, paused: boolean) {
    if (this.running || !this.own(employeeId)) return;
    this.employeeId = employeeId; this.owner = crypto.randomUUID(); this.running = true; this.paused = paused;
    this.persisted = []; this.state.error = null; this.state.lastHeartbeat = null;
    const generation = ++this.generation;
    this.ready = this.recoverLegacy(employeeId, generation);
    window.addEventListener("online", this.onOnline);
    window.addEventListener("storage", this.onStorage);
    window.addEventListener("wellness-auth-update", this.onAuthUpdate);
    this.notify();
    if (!paused) void this.flush();
  }
  public stop() {
    this.running = false; this.paused = true; ++this.generation;
    this.controller?.abort();
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("storage", this.onStorage);
    window.removeEventListener("wellness-auth-update", this.onAuthUpdate);
    this.notify();
  }
  public setPaused(paused: boolean) { this.paused = paused; if (paused) this.controller?.abort(); else void this.flush(); }
  private onOnline = () => { void this.retry(); };
  private onAuthUpdate = () => { if (!this.own()) this.stop(); };
  private onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === "wellness-auth-user") {
      if (!this.own()) this.stop();
    }
  };
  public enqueue(event: ValidatedHeartbeat) {
    if (!this.own(event.employeeId) || event.employeeId !== this.employeeId) return;
    event = structuredClone(event);
    const id = "event:" + JSON.stringify([event.employeeId, event.source, event.eventId]);
    this.memory.set(id, { id, employeeId: event.employeeId, observation: event, fingerprint: "", status: "pending",
      createdAt: Date.now(), attempts: 0, nextAttemptAt: 0 });
    this.notify();
    // Serialize captures so completion includes every preceding device write.
    this.writes = this.writes.then(async () => {
      const row = await packetRow(event); this.memory.set(row.id, row); this.notify();
      try {
        await saveHeartbeatRows([row]); this.memory.delete(row.id);
        if (this.running && this.employeeId === row.employeeId && this.own()) await this.refresh(row.employeeId, this.generation);
      }
      catch { this.state.error = "Observations are held in memory because device storage failed. Keep this page open to retry."; }
    }).catch(() => { this.state.error = "Observations could not be prepared for storage. Keep this page open to retry."; })
      .finally(() => this.notify());
  }
  private async recoverLegacy(employeeId: string, generation: number) {
    this.legacyNeedsRecovery = false;
    try {
      const prefix = "wellness-heartbeat-queue:" + employeeId + ":";
      const keys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string =>
        !!key && key.startsWith(prefix) && /^[a-zA-Z0-9_-]+$/.test(key.slice(prefix.length)));
      for (const key of keys) {
        if (!this.active(employeeId, generation)) return;
        const parsed = readPendingObservations(localStorage.getItem(key), employeeId);
        const rows = await Promise.all([...parsed.pending.map(packetRow), ...parsed.rejected.map(review => reviewRow(employeeId, review))]);
        for (const row of rows) this.memory.set(row.id, row);
        await saveHeartbeatRows(rows);
        for (const row of rows) this.memory.delete(row.id);
        // Older app tabs do not participate in database transactions. Preserve the
        // legacy bytes as a read-only backup rather than race their localStorage writes.
      }
      await this.refresh(employeeId, generation);
    } catch {
      this.legacyNeedsRecovery = true;
      if (this.active(employeeId, generation)) this.state.error = "Saved observations could not be fully recovered. Original queues remain on this device; keep this page open to retry.";
    }
    if (this.active(employeeId, generation)) this.notify();
  }
  private async refresh(employeeId: string, generation: number) {
    const rows = await listHeartbeatRows(employeeId, false);
    if (this.active(employeeId, generation)) { this.persisted = rows; this.notify(); }
  }
  public getRejectedObservations(): RejectedObservation[] {
    if (!this.own()) return [];
    const rows = new Map(this.persisted.map(row => [row.id, row]));
    for (const row of this.memory.values()) if (row.employeeId === this.employeeId && !rows.has(row.id)) rows.set(row.id, row);
    return structuredClone([...rows.values()].filter(row => row.status === "rejected").map(row => ({
      observation: row.observation, reason: row.reason ?? "Saved observation needs review.", rejectedAt: row.rejectedAt ?? new Date(row.createdAt).toISOString(),
    })));
  }
  public flush(): Promise<void> {
    if (this.flight) return this.flight;
    const id = this.employeeId, generation = this.generation;
    this.flight = this.runFlush(id, generation).finally(() => { this.flight = null; });
    return this.flight;
  }
  public async retry(): Promise<void> {
    const employeeId = this.employeeId, generation = this.generation;
    if (!this.active(employeeId, generation) || this.paused) return;
    try { await retryHeartbeatRows(employeeId); } catch { /* Memory-only packets remain retryable. */ }
    if (!this.active(employeeId, generation)) return;
    for (const [id, row] of this.memory) if (row.employeeId === employeeId && row.status === "pending") this.memory.set(id, { ...row, nextAttemptAt: 0 });
    await this.flush();
  }
  private async runFlush(employeeId: string, generation: number) {
    if (!this.active(employeeId, generation)) return;
    await this.ready; await this.writes;
    if (this.legacyNeedsRecovery && this.active(employeeId, generation)) await this.recoverLegacy(employeeId, generation);
    if (!this.active(employeeId, generation) || this.paused) return;
    let storageError = false;
    try {
      const unsaved = await Promise.all([...this.memory.values()].filter(row => row.employeeId === employeeId).map(async row =>
        row.fingerprint ? row : packetRow(row.observation as ValidatedHeartbeat)));
      for (const row of unsaved) this.memory.set(row.id, row);
      if (unsaved.length) {
        await saveHeartbeatRows(unsaved);
        for (const row of unsaved) this.memory.delete(row.id);
      }
    } catch { storageError = true; }
    try {
      while (this.active(employeeId, generation) && !this.paused) {
        await this.writes;
        let row: HeartbeatQueueRow | null = null, durable = false;
        try { row = await claimHeartbeatRow(employeeId, this.owner, Date.now()); durable = !!row; }
        catch { storageError = true; }
        if (!this.active(employeeId, generation) || this.paused) break;
        if (!row) row = [...this.memory.values()].find(row => row.employeeId === employeeId && row.status === "pending" && row.nextAttemptAt <= Date.now()) ?? null;
        if (!row) break;
        const validation = sanitizeAndValidateHeartbeat(row.observation);
        let outcome: { status: "acknowledged" } | { status: "pending" | "rejected"; reason: string; nextAttemptAt: number };
        let metrics: ReturnType<typeof decodeHeartbeatAcknowledgement> | null = null;
        if (!validation.data || validation.data.employeeId !== employeeId || validation.data.organizationId !== "personal:" + employeeId ||
            validation.data.source !== "workstation" || await hash(JSON.stringify(validation.data)) !== row.fingerprint) {
          outcome = { status: "rejected", reason: validation.error ?? "Invalid saved observation scope or source.", nextAttemptAt: 0 };
        } else {
          const controller = new AbortController(); this.controller = controller;
          try {
            const response = await fetch("/api/telemetry/heartbeat", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify(validation.data), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
            if (!this.active(employeeId, generation) || this.paused) break;
            if (!response.ok) {
              if (PERMANENT_UPLOAD_FAILURES.has(response.status)) outcome = { status: "rejected", reason: "Server rejected this observation (" + response.status + "). Retained for review.", nextAttemptAt: 0 };
              else throw new Error("Observation upload failed (" + response.status + "). Retained for retry.");
            } else {
              metrics = decodeHeartbeatAcknowledgement(await response.json(), validation.data, getLocalSessionUser()?.source !== "demo");
              if (!this.active(employeeId, generation) || this.paused) break;
              outcome = { status: "acknowledged" };
            }
          } catch (error) {
            if (!this.active(employeeId, generation) || this.paused) break;
            outcome = { status: "pending", reason: error instanceof Error ? error.message : "Upload failed; retained for retry.",
              nextAttemptAt: Date.now() + Math.min(300000, 5000 * 2 ** Math.min(row.attempts, 6)) };
          } finally { if (this.controller === controller) this.controller = null; }
        }
        if (!this.active(employeeId, generation) || this.paused) break;
        if (durable) {
          if (!await settleHeartbeatRow(employeeId, row.id, this.owner, Date.now(), outcome)) {
            throw new Error("Observation lease changed. The packet remains retained for retry.");
          }
        } else if (outcome.status === "acknowledged") this.memory.delete(row.id);
        else this.memory.set(row.id, { ...row, ...outcome, attempts: row.attempts + 1,
          ...(outcome.status === "rejected" ? { rejectedAt: new Date().toISOString() } : {}) });
        if (metrics && this.active(employeeId, generation)) {
          this.state.lastHeartbeat = new Date().toISOString();
          try { saveEmployeeMetricsBatch(metrics); window.dispatchEvent(new CustomEvent("wellness-telemetry-update")); }
          catch { this.state.error = "Observation was saved by the server, but the display cache could not be updated."; }
        } else if (outcome.status === "pending") this.state.error = outcome.reason;
        if (outcome.status === "pending") break;
      }
      try { await this.refresh(employeeId, generation); } catch { storageError = true; }
      if (this.active(employeeId, generation)) {
        if (this.state.memoryOnlyEvents) this.state.error = "Device storage is unavailable. Memory-only observations need this page to stay open.";
        else if (storageError) this.state.error = "Device queue storage is unavailable. New observations may be held only in memory.";
        else if (!this.state.pendingEvents && !this.state.error?.includes("display cache")) this.state.error = null;
      }
    } catch (error) {
      if (this.active(employeeId, generation)) this.state.error = error instanceof Error ? error.message : "Observations remain retained for retry.";
    } finally { if (this.active(employeeId, generation)) this.notify(); }
  }
}
