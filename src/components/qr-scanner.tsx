'use client';
import { useEffect, useRef, useState } from 'react';
export function QrScanner({ onScan }: { onScan: (text: string) => void }) {
  const callback = useRef(onScan);
  callback.current = onScan;
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let scanner: import('html5-qrcode').Html5Qrcode | undefined;
    async function start() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (disposed) return;
        scanner = new Html5Qrcode('qr-reader');
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 8, qrbox: { width: 220, height: 220 } },
          (text) => {
            if (!disposed) {
              callback.current(text);
            }
          },
          () => {},
        );
        if (disposed && scanner.isScanning) await scanner.stop();
      } catch {
        if (!disposed)
          setError(
            'No se pudo abrir la cámara. Revisa el permiso y utiliza HTTPS o localhost. Puedes registrar el acceso manualmente.',
          );
      }
    }
    void start();
    return () => {
      disposed = true;
      if (scanner?.isScanning) void scanner.stop().catch(() => {});
    };
  }, []);
  return (
    <div className="scanner">
      <div id="qr-reader" />
      {error && <p className="form-error">{error}</p>}
      <p className="muted">Coloca el QR dentro del cuadro.</p>
    </div>
  );
}
