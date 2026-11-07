'use client';

import { useEffect, useState } from 'react';
import { Bell, BellRing } from 'lucide-react';

function decodeKey(key: string) {
  const base64 = key.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export function PushNotifications({ tenantId }: { tenantId: string }) {
  const [browserSubscription, setBrowserSubscription] = useState<PushSubscription | null>(null);
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    void (async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        setBrowserSubscription(existing);
        if (!existing) return;
        const response = await fetch(
          `/api/notifications/subscribe?tenantId=${encodeURIComponent(tenantId)}&endpoint=${encodeURIComponent(existing.endpoint)}`,
          { cache: 'no-store' },
        );
        if (response.ok) setActive(Boolean((await response.json()).subscribed));
      } catch {}
    })();
  }, [tenantId]);

  async function toggle() {
    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      setMessage('Este navegador no admite notificaciones push.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const installed =
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (isIos && !installed)
        throw new Error(
          'En iPhone o iPad, agrega Gymia a la pantalla de inicio para activar avisos.',
        );
      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;
      if (active && browserSubscription) {
        const response = await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenantId, endpoint: browserSubscription.endpoint }),
        });
        if (!response.ok) throw new Error('No se pudo desactivar el aviso.');
        setActive(false);
        setMessage('Avisos desactivados en este dispositivo.');
        return;
      }
      const keyResponse = await fetch('/api/notifications/key', { cache: 'no-store' });
      const { publicKey } = await keyResponse.json();
      if (!keyResponse.ok || !publicKey)
        throw new Error('Las notificaciones web aún no están configuradas en este servidor.');
      const permission =
        Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permite las notificaciones en tu navegador.');
      const next =
        browserSubscription ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(publicKey),
        }));
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, ...next.toJSON() }),
      });
      if (!response.ok) {
        if (!browserSubscription) await next.unsubscribe();
        const result = await response.json();
        throw new Error(result.error || 'No se pudo guardar este dispositivo.');
      }
      setBrowserSubscription(next);
      setActive(true);
      setMessage('Avisos activados en este dispositivo.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo configurar el aviso.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="push-control">
      <button
        className={`icon-button push-button ${active ? 'enabled' : ''}`}
        aria-label={active ? 'Desactivar notificaciones' : 'Activar notificaciones'}
        title={active ? 'Notificaciones activadas' : 'Activar notificaciones'}
        aria-pressed={active}
        disabled={busy}
        onClick={() => void toggle()}
      >
        {active ? <BellRing size={19} /> : <Bell size={19} />}
        <span className="push-label">{active ? 'Avisos activos' : 'Activar avisos'}</span>
      </button>
      {message && (
        <span className="push-status" role="status">
          {message}
        </span>
      )}
    </div>
  );
}
