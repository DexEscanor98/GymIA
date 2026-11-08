'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, Check } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const password = String(data.get('password') ?? '');
    if (!token) {
      setError(
        'El enlace no es válido o ya venció. Pide al gimnasio que envíe una invitación nueva.',
      );
      setBusy(false);
      return;
    }
    if (password !== String(data.get('confirmPassword') ?? '')) {
      setError('Las contraseñas no coinciden.');
      setBusy(false);
      return;
    }
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error)
        throw new Error('El enlace venció o ya fue utilizado. Pide uno nuevo al gimnasio.');
      setDone(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar la contraseña.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout reset-layout">
      <section className="auth-content">
        <div className="auth-card">
          <Link href="/" className="brand reset-brand">
            <span className="brand-symbol">
              <Activity size={23} />
            </span>
            gymia<span className="brand-dot">.</span>
          </Link>
          <span className="eyebrow">CONFIGURA TU ACCESO</span>
          <h2>{done ? 'Contraseña lista' : 'Crea tu contraseña'}</h2>
          {done ? (
            <div className="reset-done">
              <p>
                <Check size={18} /> La contraseña quedó guardada. Si aún no verificaste tu correo,
                abre primero el enlace de verificación que te enviamos.
              </p>
              <Link className="button primary wide" href="/login">
                Ir a iniciar sesión <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <>
              <p>Elige una contraseña segura de al menos 12 caracteres. Este acceso es personal.</p>
              <form onSubmit={(event) => void submit(event)}>
                <label>
                  Contraseña nueva
                  <input
                    type="password"
                    name="password"
                    minLength={12}
                    required
                    autoComplete="new-password"
                    placeholder="Al menos 12 caracteres"
                  />
                </label>
                <label>
                  Confirma tu contraseña
                  <input
                    type="password"
                    name="confirmPassword"
                    minLength={12}
                    required
                    autoComplete="new-password"
                    placeholder="Escríbela de nuevo"
                  />
                </label>
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <button className="button primary wide" disabled={busy}>
                  {busy ? 'Guardando…' : 'Guardar contraseña'} <ArrowRight size={18} />
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
