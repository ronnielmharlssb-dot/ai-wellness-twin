import type { ImportSource, SourceSnapshot } from "./sourceSnapshotValidator";

export type SourceImportBatch = {
  version: 1; id: string; employeeId: string; provider: ImportSource;
  capturedAt: string; enqueuedAt: string; snapshots: SourceSnapshot[];
  status: "pending" | "rejected" | "acknowledged"; attempts: number; nextAttemptAt: number;
  acknowledgedAt?: string;
  leaseOwner?: string; leaseUntil?: number; reason?: string;
};
const DATABASE = "wellness-source-imports";
const STORE = "batches";
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") { reject(new Error("Persistent import storage is unavailable on this device.")); return; }
    const request = indexedDB.open(DATABASE, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("employeeId", "employeeId");
    };
    request.onerror = () => reject(request.error ?? new Error("Import storage could not be opened."));
    request.onblocked = () => { blocked = true; reject(new Error("Import storage is busy. Close other app tabs and retry.")); };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
/** Resolve only on transaction completion, never on an individual write request. */
async function transaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction;
    try { tx = db.transaction(STORE, mode, { durability: mode === "readwrite" ? "strict" : "default" }); }
    catch (error) { db.close(); reject(error); return; }
    let result: T;
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error("Import storage transaction was aborted.")); };
    try { operation(tx.objectStore(STORE), (value) => { result = value; }); }
    catch (error) { tx.abort(); db.close(); reject(error); }
  });
}
export function saveSourceImport(batch: SourceImportBatch): Promise<void> {
  return transaction("readwrite", (store) => { store.add(batch); });
}
export function listSourceImports(employeeId: string): Promise<SourceImportBatch[]> {
  return transaction("readonly", (store, result) => {
    const request = store.index("employeeId").getAll(employeeId);
    request.onsuccess = () => result(request.result as SourceImportBatch[]);
  });
}
/** One atomic lease prevents two tabs from uploading the same batch concurrently. */
export function claimSourceImport(employeeId: string, owner: string, now: number, id?: string): Promise<SourceImportBatch | null> {
  return transaction("readwrite", (store, result) => {
    const request = store.index("employeeId").getAll(employeeId);
    request.onsuccess = () => {
      for (const batch of request.result as SourceImportBatch[]) {
        if (batch.status === "acknowledged" && Date.parse(batch.acknowledgedAt ?? "") < now - 35 * 86400000) store.delete(batch.id);
      }
      const next = (request.result as SourceImportBatch[])
        .filter((batch) => batch.status === "pending" && (!id || batch.id === id) && batch.nextAttemptAt <= now && (batch.leaseUntil ?? 0) <= now)
        .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt) || a.id.localeCompare(b.id))[0];
      if (!next) { result(null); return; }
      const claimed = { ...next, leaseOwner: owner, leaseUntil: now + 60000 };
      store.put(claimed);
      result(claimed);
    };
  });
}
export function settleSourceImport(employeeId: string, id: string, owner: string,
  outcome: { status: "acknowledged" } | { status: "pending" | "rejected"; reason: string; nextAttemptAt: number }): Promise<boolean> {
  return transaction("readwrite", (store, result) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const batch = request.result as SourceImportBatch | undefined;
      if (!batch || batch.employeeId !== employeeId || batch.leaseOwner !== owner) { result(false); return; }
      // Keep a small receipt so another tab can distinguish a committed upload
      // from missing/cleared storage. Remove the queued observations atomically.
      if (outcome.status === "acknowledged") store.put({ ...batch, status: "acknowledged", snapshots: [],
        acknowledgedAt: new Date().toISOString(), leaseOwner: undefined, leaseUntil: undefined, reason: undefined });
      else store.put({ ...batch, status: outcome.status, reason: outcome.reason, attempts: batch.attempts + 1,
        nextAttemptAt: outcome.nextAttemptAt, leaseOwner: undefined, leaseUntil: undefined });
      result(true);
    };
  });
}
/** Cancellation keeps the observations available for review/export. */
export function cancelSourceImports(employeeId: string, provider: ImportSource): Promise<void> {
  return transaction("readwrite", (store) => {
    const request = store.index("employeeId").getAll(employeeId);
    request.onsuccess = () => {
      for (const batch of request.result as SourceImportBatch[]) {
        if (batch.provider === provider && batch.status === "pending") store.put({ ...batch, status: "rejected",
          reason: "Account unlinked. Upload cancelled; observations retained for review.", leaseOwner: undefined, leaseUntil: undefined });
      }
    };
  });
}
export function retrySourceImports(employeeId: string): Promise<void> {
  return transaction("readwrite", (store) => {
    const request = store.index("employeeId").getAll(employeeId);
    request.onsuccess = () => {
      for (const batch of request.result as SourceImportBatch[]) {
        if (batch.status === "pending") store.put({ ...batch, nextAttemptAt: 0 });
      }
    };
  });
}
export function pruneSourceImportReceipts(employeeId: string, now = Date.now()): Promise<void> {
  return transaction("readwrite", (store) => {
    const request = store.index("employeeId").getAll(employeeId);
    request.onsuccess = () => {
      for (const batch of request.result as SourceImportBatch[]) {
        if (batch.status === "acknowledged" && Date.parse(batch.acknowledgedAt ?? "") < now - 35 * 86400000) store.delete(batch.id);
      }
    };
  });
}
