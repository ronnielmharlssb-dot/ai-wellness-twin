import { MAX_EVENT_AGE_MS } from "./serverSanitizer";

export type HeartbeatQueueRow = {
  id: string; employeeId: string; fingerprint: string; observation?: unknown;
  status: "pending" | "rejected" | "acknowledged"; createdAt: number;
  attempts: number; nextAttemptAt: number; reason?: string; rejectedAt?: string;
  leaseOwner?: string; leaseUntil?: number; acknowledgedAt?: number;
};
const DATABASE = "wellness-heartbeat-observations";
const STORE = "observations";
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Observation storage is unavailable.")); return; }
    const request = indexedDB.open(DATABASE, 2);
    let blocked = false;
    request.onupgradeneeded = () => {
      const store = request.result.objectStoreNames.contains(STORE)
        ? request.transaction!.objectStore(STORE) : request.result.createObjectStore(STORE, { keyPath: "id" });
      if (!store.indexNames.contains("employeeId")) store.createIndex("employeeId", "employeeId");
      if (!store.indexNames.contains("employeeStatusCreated")) store.createIndex("employeeStatusCreated", ["employeeId", "status", "createdAt"]);
      if (!store.indexNames.contains("employeeStatusAcknowledged")) store.createIndex("employeeStatusAcknowledged", ["employeeId", "status", "acknowledgedAt"]);
    };
    request.onerror = () => reject(request.error ?? new Error("Observation storage could not be opened."));
    request.onblocked = () => { blocked = true; reject(new Error("Observation storage is busy.")); };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try { tx = db.transaction(STORE, mode, { durability: mode === "readwrite" ? "strict" : "default" }); }
    catch (error) { db.close(); reject(error); return; }
    let value: T;
    tx.oncomplete = () => { db.close(); resolve(value); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Observation storage transaction was aborted.")); };
    try { operation(tx.objectStore(STORE), result => { value = result; }); }
    catch (error) { tx.abort(); db.close(); reject(error); }
  });
}
/** Immutable inserts: replay cannot restore an acknowledged payload or replace a lease. */
export function saveHeartbeatRows(rows: HeartbeatQueueRow[]): Promise<void> {
  return transaction("readwrite", store => {
    let index = 0;
    const next = () => {
      const row = rows[index++];
      if (!row) return;
      const request = store.get(row.id);
      request.onsuccess = () => {
        const existing = request.result as HeartbeatQueueRow | undefined;
        let write: IDBRequest | undefined;
        if (!existing) write = store.add(row);
        else if (existing.fingerprint !== row.fingerprint) write = store.put({ ...row,
          id: "conflict:" + row.id + ":" + row.fingerprint, status: "rejected",
          reason: "A saved event ID has conflicting metadata. The original event is preserved.",
          rejectedAt: new Date(row.createdAt).toISOString() });
        if (write) write.onsuccess = next;
        else next();
      };
    };
    next();
  });
}
export function listHeartbeatRows(employeeId: string, includeReceipts = true): Promise<HeartbeatQueueRow[]> {
  return transaction("readonly", (store, result) => {
    if (!includeReceipts) {
      const rows: HeartbeatQueueRow[] = [];
      let completed = 0;
      for (const status of ["pending", "rejected"]) {
        const request = store.index("employeeStatusCreated").getAll(IDBKeyRange.bound(
          [employeeId, status, 0], [employeeId, status, Number.MAX_SAFE_INTEGER]));
        request.onsuccess = () => { rows.push(...request.result); if (++completed === 2) result(rows); };
      }
      return;
    }
    const request = store.index("employeeId").getAll(employeeId);
    request.onsuccess = () => result(request.result);
  });
}
export function claimHeartbeatRow(employeeId: string, owner: string, now: number): Promise<HeartbeatQueueRow | null> {
  return transaction("readwrite", (store, result) => {
    const expired = store.index("employeeStatusAcknowledged").openCursor(IDBKeyRange.bound(
      [employeeId, "acknowledged", 0], [employeeId, "acknowledged", now - MAX_EVENT_AGE_MS], false, true));
    expired.onsuccess = () => { const cursor = expired.result; if (cursor) { cursor.delete(); cursor.continue(); } };
    const request = store.index("employeeStatusCreated").openCursor(IDBKeyRange.bound(
      [employeeId, "pending", 0], [employeeId, "pending", Number.MAX_SAFE_INTEGER]));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { result(null); return; }
      const row = cursor.value as HeartbeatQueueRow;
      if (row.nextAttemptAt > now || (row.leaseUntil ?? 0) > now) { cursor.continue(); return; }
      const claimed = { ...row, leaseOwner: owner, leaseUntil: now + 60000 };
      store.put(claimed); result(claimed);
    };
  });
}
export function retryHeartbeatRows(employeeId: string): Promise<void> {
  return transaction("readwrite", store => {
    const request = store.index("employeeStatusCreated").openCursor(IDBKeyRange.bound(
      [employeeId, "pending", 0], [employeeId, "pending", Number.MAX_SAFE_INTEGER]));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) { cursor.update({ ...cursor.value, nextAttemptAt: 0 }); cursor.continue(); }
    };
  });
}
export function settleHeartbeatRow(employeeId: string, id: string, owner: string, now: number,
  outcome: { status: "acknowledged" } | { status: "pending" | "rejected"; reason: string; nextAttemptAt: number }): Promise<boolean> {
  return transaction("readwrite", (store, result) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const row = request.result as HeartbeatQueueRow | undefined;
      if (!row || row.employeeId !== employeeId || row.status !== "pending" || row.leaseOwner !== owner) { result(false); return; }
      if (outcome.status === "acknowledged") store.put({ ...row, status: "acknowledged", observation: undefined,
        acknowledgedAt: now, leaseOwner: undefined, leaseUntil: undefined, reason: undefined });
      else store.put({ ...row, status: outcome.status, attempts: row.attempts + 1, nextAttemptAt: outcome.nextAttemptAt,
        reason: outcome.reason, ...(outcome.status === "rejected" ? { rejectedAt: new Date(now).toISOString() } : {}),
        leaseOwner: undefined, leaseUntil: undefined });
      result(true);
    };
  });
}
