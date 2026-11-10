'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowRight, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import {
  addOfflineSale,
  getOfflineSales,
  retryOfflineSale,
  syncOfflineSales,
} from '@/lib/offline-storage';
import type { OfflineSnapshot, QueuedOfflineSale } from '@/lib/offline-storage';

const mxn = (cents: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cents / 100);

export function OfflineSalesDesk({ snapshot }: { snapshot: OfflineSnapshot }) {
  const [queue, setQueue] = useState<QueuedOfflineSale[]>([]);
  const [online, setOnline] = useState(false);
  const [productId, setProductId] = useState(snapshot.products[0]?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [method, setMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [reference, setReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    setQueue(await getOfflineSales(snapshot.tenantId, snapshot.userId));
  }, [snapshot.tenantId, snapshot.userId]);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    setBusy(true);
    try {
      const remaining = await syncOfflineSales(snapshot.tenantId, snapshot.userId);
      setQueue(remaining);
      setNotice(
        remaining.length
          ? 'Algunas ventas siguen pendientes o requieren revisión.'
          : 'Ventas sincronizadas con el gimnasio.',
      );
    } finally {
      setBusy(false);
    }
  }, [snapshot.tenantId, snapshot.userId]);

  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void sync();
    };
    setOnline(navigator.onLine);
    void refresh();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [refresh, sync]);

  const product = snapshot.products.find((entry) => entry.id === productId);
  const alreadyQueued = queue
    .filter((sale) => sale.input.itemId === productId)
    .reduce((total, sale) => total + sale.quantity, 0);
  const available = Math.max(0, (product?.stock ?? 0) - alreadyQueued);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    if (!snapshot.shiftId) {
      setNotice(
        'No había un turno abierto en la última conexión. Reconéctate y abre caja antes de vender.',
      );
      return;
    }
    if (!product || quantity < 1 || quantity > available) {
      setNotice('La cantidad supera la existencia disponible guardada en este dispositivo.');
      return;
    }
    if (method === 'TRANSFER' && !reference.trim()) {
      setNotice('Escribe la referencia de la transferencia confirmada.');
      return;
    }
    const localCreatedAt = new Date().toISOString();
    const idempotencyKey = crypto.randomUUID();
    try {
      await addOfflineSale({
        idempotencyKey,
        tenantId: snapshot.tenantId,
        userId: snapshot.userId,
        productName: product.name,
        quantity,
        totalCents: product.priceCents * quantity,
        localCreatedAt,
        status: 'pending',
        input: {
          kind: 'PRODUCT',
          itemId: product.id,
          quantity,
          method,
          ...(method === 'TRANSFER' ? { reference: reference.trim() } : {}),
          idempotencyKey,
          offlineShiftId: snapshot.shiftId,
          offlineRecordedAt: localCreatedAt,
        },
      });
      setQuantity(1);
      setReference('');
      await refresh();
      setNotice('Venta guardada en este dispositivo. Se sincronizará cuando vuelva la conexión.');
      if (navigator.onLine) await sync();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : 'No se pudo guardar la venta en este dispositivo.',
      );
    }
  }

  async function retry(id: string) {
    await retryOfflineSale(id);
    await refresh();
    await sync();
  }

  return (
    <main className="offline-desk">
      <header className="offline-desk-head">
        <a href="/" className="brand">
          <span className="brand-symbol">
            <Activity size={22} />
          </span>
          gymia<span className="brand-dot">.</span>
        </a>
        <span className={`offline-connection ${online ? 'online' : ''}`}>
          {online ? <Wifi size={17} /> : <WifiOff size={17} />}
          {online ? 'Conexión recuperada' : 'Sin conexión'}
        </span>
      </header>
      <section className="offline-desk-card">
        <span className="eyebrow">MODO SIN CONEXIÓN · {snapshot.tenantName}</span>
        <h1>Ventas de productos</h1>
        <p>
          Gymia guarda estas ventas en este dispositivo y las sincroniza al recuperar internet.
          Membresías, cancelaciones y ajustes de inventario requieren conexión.
        </p>
        {!snapshot.shiftId ? (
          <div className="offline-warning">
            No se guardó un turno de caja abierto. Reconéctate para abrir turno antes de registrar
            ventas.
          </div>
        ) : (
          <form className="offline-sale-form" onSubmit={(event) => void submit(event)}>
            <label>
              Producto
              <select
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
                required
              >
                {snapshot.products.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name} · {mxn(entry.priceCents)} · {entry.stock} guardados
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cantidad
              <input
                type="number"
                min={1}
                max={available}
                step={1}
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                required
              />
            </label>
            <label>
              Método de pago
              <select
                value={method}
                onChange={(event) => setMethod(event.target.value as 'CASH' | 'TRANSFER')}
              >
                <option value="CASH">Efectivo</option>
                <option value="TRANSFER">Transferencia confirmada</option>
              </select>
            </label>
            {method === 'TRANSFER' && (
              <label>
                Referencia de transferencia
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  required
                  maxLength={100}
                />
              </label>
            )}
            {product && (
              <div className="offline-sale-total">
                <span>Total estimado</span>
                <strong>{mxn(product.priceCents * quantity)}</strong>
                <small>{available} unidades disponibles según el último inventario guardado.</small>
              </div>
            )}
            <button className="button primary wide" disabled={!product || quantity > available}>
              Guardar venta en este dispositivo <ArrowRight size={17} />
            </button>
          </form>
        )}
        {notice && (
          <p className="offline-notice" role="status">
            {notice}
          </p>
        )}
        <div className="offline-queue-head">
          <div>
            <h2>Ventas pendientes</h2>
            <span>
              {queue.length} guardadas · {snapshot.branchName}
            </span>
          </div>
          <button
            className="button secondary"
            disabled={!online || busy || !queue.length}
            onClick={() => void sync()}
          >
            <RefreshCw size={16} /> Sincronizar
          </button>
        </div>
        {queue.length ? (
          <ul className="offline-queue">
            {queue.map((sale) => (
              <li key={sale.idempotencyKey}>
                <div>
                  <strong>
                    {sale.quantity} × {sale.productName}
                  </strong>
                  <span>
                    {new Date(sale.localCreatedAt).toLocaleString('es-MX')} · {mxn(sale.totalCents)}
                  </span>
                  {sale.error && <small>{sale.error}</small>}
                </div>
                <div className="offline-queue-status">
                  {sale.status === 'failed' ? (
                    <>
                      <span>Revisar</span>
                      <button
                        className="text-button"
                        disabled={!online || busy}
                        onClick={() => void retry(sale.idempotencyKey)}
                      >
                        Reintentar
                      </button>
                    </>
                  ) : (
                    <span>Esperando conexión</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="offline-empty">No hay ventas pendientes.</p>
        )}
      </section>
      <p className="offline-local-note">
        La cola solo se guarda en este navegador. No borres los datos del sitio ni cierres sesión
        antes de sincronizar. La cookie de acceso sigue bajo el control seguro del navegador; Gymia
        no la copia al caché.
      </p>
    </main>
  );
}
