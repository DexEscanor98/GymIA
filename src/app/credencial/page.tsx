'use client';
import { useEffect, useState } from 'react';
export default function Credential() {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const token = window.location.hash.slice(1);
    if (/^[0-9a-f-]{36}$/i.test(token))
      void import('qrcode').then((q) => q.toDataURL(token, { width: 400, margin: 2 })).then(setUrl);
  }, []);
  return (
    <main className="onboarding">
      <section className="panel credential">
        <span className="eyebrow">CREDENCIAL DE ACCESO</span>
        <h1>Tu QR del gimnasio</h1>
        {url ? (
          <>
            <img src={url} width={300} height={300} alt="Tu credencial QR" />
            <a className="button primary" href={url} download="credencial-gymia.png">
              Guardar credencial
            </a>
            <p>
              Muéstralo en recepción al entrar y al salir.
              <br />
              La vigencia se verifica al escanear.
            </p>
          </>
        ) : (
          <p>Abre el enlace completo que te compartió recepción.</p>
        )}
      </section>
    </main>
  );
}
