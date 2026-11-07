'use client';
import { useState } from 'react';
export function LogoUpload({
  tenantId,
  logoUrl,
  onSaved,
}: {
  tenantId: string;
  logoUrl?: string | null;
  onSaved: () => Promise<unknown>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function save(remove = false) {
    if (!remove && !file) return;
    if (file && !remove && file.size > 5 * 1024 * 1024) {
      setMessage('Selecciona un archivo de hasta 5 MB.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/logo', {
        method: remove ? 'DELETE' : 'POST',
        headers: {
          'x-tenant-id': tenantId,
          'Content-Type': remove ? 'application/json' : file!.type,
        },
        body: remove ? '{}' : file,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await onSaved();
      setMessage(
        remove
          ? 'Logo quitado.'
          : `Logo guardado en alta calidad. Ocupa ${Math.ceil(result.bytes / 1024)} KB.`,
      );
      setFile(null);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'No se pudo guardar el logo.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="logo-upload">
      <h3>Logo del gimnasio</h3>
      {logoUrl && <img className="logo-preview" src={logoUrl} alt="Logo actual del gimnasio" />}
      <p>
        PNG, JPEG o WebP de hasta 5 MB. Lo ajustamos a un máximo de 1024 píxeles y lo guardamos como
        WebP de alta calidad, conservando transparencias. Máximo 256 KB guardados por gimnasio; cada
        cambio reemplaza el logo anterior.
      </p>
      <label>
        Seleccionar logo
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={busy}
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setMessage('');
          }}
        />
      </label>
      <div className="inline-actions">
        <button className="button secondary" disabled={busy || !file} onClick={() => void save()}>
          {busy ? 'Guardando…' : 'Guardar logo'}
        </button>
        {logoUrl && (
          <button className="text-button" disabled={busy} onClick={() => void save(true)}>
            Quitar logo
          </button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
