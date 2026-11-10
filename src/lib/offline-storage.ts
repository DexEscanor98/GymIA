export type OfflineProduct = { id: string; name: string; priceCents: number; stock: number };
export type OfflineSnapshot = {
  tenantId: string;
  tenantName: string;
  userId: string;
  branchId: string;
  branchName: string;
  shiftId: string | null;
  shiftOpenedAt: string | null;
  products: OfflineProduct[];
  savedAt: string;
};
export type QueuedOfflineSale = {
  idempotencyKey: string;
  tenantId: string;
  userId: string;
  productName: string;
  quantity: number;
  totalCents: number;
  localCreatedAt: string;
  input: Record<string, string | number | undefined>;
  status: 'pending' | 'failed';
  error?: string;
};

const DB_NAME = 'gymia-offline-v1';
const SNAPSHOTS = 'snapshots';
const SALES = 'sales';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOTS))
        db.createObjectStore(SNAPSHOTS, { keyPath: 'tenantId' });
      if (!db.objectStoreNames.contains(SALES))
        db.createObjectStore(SALES, { keyPath: 'idempotencyKey' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error('No se pudo abrir el almacenamiento local.'));
  });
}

async function storeRequest<T>(
  storeName: string,
  mode: IDBTransactionMode,
  request: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const operation = request(tx.objectStore(storeName));
    let result: T;
    operation.onsuccess = () => {
      result = operation.result;
    };
    operation.onerror = () =>
      reject(operation.error || new Error('No se pudo guardar en este dispositivo.'));
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => reject(tx.error || new Error('No se pudo completar el guardado local.'));
    tx.onabort = () => reject(tx.error || new Error('Se canceló el guardado local.'));
  });
}

export async function saveOfflineSnapshot(snapshot: OfflineSnapshot) {
  await storeRequest(SNAPSHOTS, 'readwrite', (store) => store.put(snapshot));
}

export async function getOfflineSnapshot(tenantId?: string): Promise<OfflineSnapshot | null> {
  const result = tenantId
    ? await storeRequest<OfflineSnapshot | undefined>(SNAPSHOTS, 'readonly', (store) =>
        store.get(tenantId),
      )
    : await storeRequest<OfflineSnapshot[]>(SNAPSHOTS, 'readonly', (store) => store.getAll());
  if (Array.isArray(result))
    return result.sort((a, b) => b.savedAt.localeCompare(a.savedAt))[0] ?? null;
  return result ?? null;
}

export async function addOfflineSale(sale: QueuedOfflineSale) {
  if (navigator.storage?.persist) await navigator.storage.persist().catch(() => false);
  await storeRequest(SALES, 'readwrite', (store) => store.add(sale));
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.ready
      .then((registration) => {
        const syncManager = (
          registration as ServiceWorkerRegistration & {
            sync?: { register: (tag: string) => Promise<void> };
          }
        ).sync;
        return syncManager?.register('gymia-sync-sales');
      })
      .catch(() => {});
  }
}

export async function getOfflineSales(
  tenantId?: string,
  userId?: string,
): Promise<QueuedOfflineSale[]> {
  const all = await storeRequest<QueuedOfflineSale[]>(SALES, 'readonly', (store) => store.getAll());
  return all
    .filter(
      (sale) => (!tenantId || sale.tenantId === tenantId) && (!userId || sale.userId === userId),
    )
    .sort((a, b) => a.localCreatedAt.localeCompare(b.localCreatedAt));
}

export async function removeOfflineSale(idempotencyKey: string) {
  await storeRequest(SALES, 'readwrite', (store) => store.delete(idempotencyKey));
}

export async function markOfflineSaleFailed(idempotencyKey: string, error: string) {
  const sale = await storeRequest<QueuedOfflineSale | undefined>(SALES, 'readonly', (store) =>
    store.get(idempotencyKey),
  );
  if (sale)
    await storeRequest(SALES, 'readwrite', (store) =>
      store.put({ ...sale, status: 'failed', error }),
    );
}

export async function retryOfflineSale(idempotencyKey: string) {
  const sale = await storeRequest<QueuedOfflineSale | undefined>(SALES, 'readonly', (store) =>
    store.get(idempotencyKey),
  );
  if (sale)
    await storeRequest(SALES, 'readwrite', (store) =>
      store.put({ ...sale, status: 'pending', error: undefined }),
    );
}

export async function syncOfflineSales(
  tenantId: string,
  userId: string,
): Promise<QueuedOfflineSale[]> {
  const sales = await getOfflineSales(tenantId, userId);
  for (const sale of sales.filter((entry) => entry.status === 'pending')) {
    if (!navigator.onLine) break;
    let response: Response;
    try {
      response = await fetch('/api/operations', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': tenantId },
        body: JSON.stringify({ action: 'sale.create', input: sale.input }),
      });
    } catch {
      break;
    }
    if (response.ok) {
      await removeOfflineSale(sale.idempotencyKey);
      continue;
    }
    if (response.status >= 500) break;
    let message = `La venta necesita revisión (HTTP ${response.status}).`;
    try {
      const body = await response.json();
      if (typeof body.error === 'string') message = body.error;
    } catch {}
    await markOfflineSaleFailed(sale.idempotencyKey, message);
  }
  return getOfflineSales(tenantId, userId);
}
