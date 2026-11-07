'use client';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Activity } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
export function AuthForm({
  register = false,
  gymOwner = false,
}: {
  register?: boolean;
  gymOwner?: boolean;
}) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    try {
      const body = {
        email: String(data.get('email')).trim().toLowerCase(),
        password: String(data.get('password')),
      };
      const result = register
        ? await authClient.signUp.email({ ...body, name: String(data.get('name')) })
        : await authClient.signIn.email(body);
      if (result.error) {
        setError(
          register
            ? 'No se pudo crear la cuenta. Revisa los datos o prueba iniciar sesión.'
            : 'Correo o contraseña incorrectos.',
        );
        return;
      }
      window.location.assign(register ? (gymOwner ? '/setup-gym' : '/personal') : '/');
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-brand">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <Activity size={25} />
          </span>
          gymia<span className="brand-dot">.</span>
        </Link>
        <div>
          <span className="eyebrow">EL ESPACIO DETRÁS DE TU GIMNASIO</span>
          <h1>
            Más movimiento.
            <br />
            <em>Todo en orden.</em>
          </h1>
          <p>Tu equipo, tus clientes y cada detalle del día, en un mismo lugar.</p>
          <div className="auth-lines">
            <span>01 / Recibe</span>
            <span>02 / Administra</span>
            <span>03 / Crece</span>
          </div>
        </div>
        <small>HECHO PARA EL RITMO DE TU GIMNASIO</small>
      </section>
      <section className="auth-content">
        <div className="auth-card">
          <span className="eyebrow">BIENVENIDO A GYMIA</span>
          <h2>
            {register ? (gymOwner ? 'Registra tu gimnasio' : 'Crea tu cuenta') : 'Qué gusto verte'}
          </h2>
          <p>
            {register
              ? gymOwner
                ? 'Paso 1 de 2. Crea tu cuenta de dueño; después darás nombre a tu gimnasio. Tendrás tu propio espacio para clientes, equipo y ventas.'
                : 'Crea tu espacio personal para registrar rutinas, entrenamientos y alimentación. Después podrás vincular tu cuenta con tu gimnasio.'
              : 'Inicia sesión para continuar con tu día.'}
          </p>
          <form onSubmit={submit}>
            {register && (
              <label>
                Nombre completo
                <input name="name" required minLength={2} autoComplete="name" />
              </label>
            )}
            <label>
              Correo electrónico
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="tu@correo.com"
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                name="password"
                required
                minLength={12}
                autoComplete={register ? 'new-password' : 'current-password'}
                placeholder={register ? 'Al menos 12 caracteres' : 'Tu contraseña'}
              />
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary wide" disabled={busy}>
              {busy
                ? 'Un momento…'
                : register
                  ? gymOwner
                    ? 'Crear cuenta de dueño'
                    : 'Crear cuenta'
                  : 'Entrar'}
              <ArrowRight size={18} />
            </button>
          </form>
          {!register && (
            <div className="gym-signup">
              <h3>¿Tienes un gimnasio?</h3>
              <p>Registra tu gimnasio y administra tu equipo, membresías y ventas.</p>
              <Link href="/register?gym=1" className="button secondary wide">
                Registrar mi gimnasio <ArrowRight size={18} />
              </Link>
            </div>
          )}
          {register && !gymOwner && (
            <div className="gym-signup">
              <h3>¿Administras un gimnasio?</h3>
              <p>Registra tu gimnasio para gestionar clientes, equipo y ventas.</p>
              <Link href="/register?gym=1" className="button secondary wide">
                Registrar mi gimnasio <ArrowRight size={18} />
              </Link>
            </div>
          )}
          <p className="auth-switch">
            {register ? '¿Ya tienes cuenta?' : '¿Primera vez aquí?'}{' '}
            <Link href={register ? '/login' : '/register'}>
              {register ? 'Inicia sesión' : 'Crea tu cuenta'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
