'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, MailCheck, ShieldCheck } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

export function ContactVerificationForm({
  email = '',
  phoneNumber = '',
  emailVerified = false,
  phoneVerified = false,
  canSkip = false,
  gymSubscriptions = [],
  personalSubscriptionActive = false,
}: {
  email?: string;
  phoneNumber?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  canSkip?: boolean;
  gymSubscriptions?: { tenantId: string; gymName: string }[];
  personalSubscriptionActive?: boolean;
}) {
  const [emailAddress, setEmailAddress] = useState(email);
  const [address, setAddress] = useState(phoneNumber);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function resendEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await authClient.sendVerificationEmail({
        email: emailAddress.trim().toLowerCase(),
        callbackURL: '/verify-account',
      });
      if (result.error)
        throw new Error('No se pudo enviar el enlace. Revisa el correo o intenta más tarde.');
      setNotice(
        'Enviamos un enlace de verificación si la cuenta requiere confirmación. Revisa también la carpeta de correo no deseado.',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar el enlace.');
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoneCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/verification/phone/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: address.trim().replace(/[\s()-]/g, '') }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo enviar el código.');
      setSent(true);
      setNotice(`Enviamos un código por SMS a ${result.phoneNumber}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo enviar el código.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhone(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/verification/phone/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo verificar el código.');
      setNotice('Teléfono verificado. Ya puedes continuar.');
      window.location.assign('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo verificar el código.');
    } finally {
      setBusy(false);
    }
  }

  async function cancelRenewal(tenantId?: string) {
    const confirmation = window.confirm(
      '¿Quieres cancelar la renovación? El acceso seguirá hasta el final del periodo pagado.',
    );
    if (!confirmation) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(
        tenantId ? '/api/billing/cancel' : '/api/personal/billing/cancel',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(tenantId ? {} : {}) },
          body: JSON.stringify(tenantId ? { tenantId } : {}),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'No se pudo cancelar la renovación.');
      setNotice('Renovación cancelada. El acceso se conservará hasta terminar el periodo pagado.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cancelar la renovación.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-layout">
      <section className="auth-content verification-content">
        <div className="auth-card">
          <span className="eyebrow">SEGURIDAD DE LA CUENTA</span>
          <h2>Verifica tus datos de contacto</h2>
          <p>
            Verifica tu correo o teléfono para poder comprar suscripciones y recibir avisos de forma
            segura. Puedes entrar a tu cuenta y verificarlo después.
          </p>

          <div className="verification-status">
            <p>
              <MailCheck size={18} /> Correo: {emailVerified ? 'verificado' : 'pendiente'}
            </p>
            <p>
              <ShieldCheck size={18} /> Teléfono: {phoneVerified ? 'verificado' : 'pendiente'}
            </p>
          </div>

          {emailVerified || phoneVerified ? (
            <div className="verification-complete">
              <p>Ya tienes un medio de contacto verificado.</p>
              <Link className="button primary wide" href="/">
                Continuar <ArrowRight size={18} />
              </Link>
            </div>
          ) : (
            <>
              <form onSubmit={resendEmail}>
                <label>
                  Correo electrónico
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(event) => setEmailAddress(event.target.value)}
                    required
                    autoComplete="email"
                  />
                </label>
                <button className="button primary wide" disabled={busy}>
                  {busy ? 'Enviando…' : 'Reenviar enlace de verificación'} <ArrowRight size={18} />
                </button>
                <p className="form-hint">
                  Abre el enlace desde el mismo navegador para continuar. Si no tienes la sesión
                  abierta, inicia sesión después de confirmar el correo.
                </p>
              </form>
              <form onSubmit={sendPhoneCode}>
                <label>
                  Teléfono móvil en formato internacional
                  <input
                    type="tel"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    required
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+525512345678"
                    pattern="\+[1-9][0-9]{7,14}"
                    title="Incluye el signo + y el código de país."
                  />
                </label>
                <button className="button secondary wide" disabled={busy || sent}>
                  {busy ? 'Enviando…' : sent ? 'Código enviado' : 'Enviar código SMS'}
                </button>
              </form>
              {sent && (
                <form onSubmit={verifyPhone}>
                  <label>
                    Código de verificación
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      required
                      minLength={4}
                      maxLength={10}
                    />
                  </label>
                  <button className="button primary wide" disabled={busy || code.length < 4}>
                    {busy ? 'Verificando…' : 'Verificar teléfono'} <ArrowRight size={18} />
                  </button>
                </form>
              )}
            </>
          )}

          {canSkip && !emailVerified && !phoneVerified && (
            <Link className="button secondary wide" href="/">
              Omitir por ahora <ArrowRight size={18} />
            </Link>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="form-success" role="status">
              {notice}
            </p>
          )}
          {!emailVerified &&
            !phoneVerified &&
            (gymSubscriptions.length > 0 || personalSubscriptionActive) && (
              <section className="verification-cancellations">
                <strong>Administrar renovaciones</strong>
                <p>
                  Si todavía no puedes completar la verificación, también puedes detener una
                  renovación activa.
                </p>
                {gymSubscriptions.map((subscription) => (
                  <button
                    key={subscription.tenantId}
                    className="button secondary wide"
                    type="button"
                    disabled={busy}
                    onClick={() => void cancelRenewal(subscription.tenantId)}
                  >
                    Cancelar renovación de {subscription.gymName}
                  </button>
                ))}
                {personalSubscriptionActive && (
                  <button
                    className="button secondary wide"
                    type="button"
                    disabled={busy}
                    onClick={() => void cancelRenewal()}
                  >
                    Cancelar Gymia Plus personal
                  </button>
                )}
              </section>
            )}
          <p className="auth-switch">
            <Link href="/login">Volver a iniciar sesión</Link>
          </p>
        </div>
      </section>
    </main>
  );
}
