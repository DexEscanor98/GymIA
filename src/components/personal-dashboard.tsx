'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  CalendarDays,
  Check,
  Copy,
  Dumbbell,
  Leaf,
  LogOut,
  MessageCircle,
  NotebookPen,
  Plus,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { LegalCheckoutDialog } from './legal-checkout-dialog';
import type { LegalAcceptanceInput } from '@/lib/legal-versions';

type Payload = {
  user: { name: string; email: string };
  profile: {
    id: string;
    publicId: string;
    goal: string;
    dietPlan: string;
    weightKg: number | null;
    heightCm: number | null;
    dailyCalories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    personalPlan: 'FREE' | 'COACH';
  };
  notes: { id: string; title: string; content: string }[];
  routines: { id: string; title: string; details: string }[];
  workouts: {
    id: string;
    title: string;
    startsAt: string;
    durationMinutes: number;
    notes?: string | null;
    completedAt?: string | null;
  }[];
  meals: {
    id: string;
    eatenAt: string;
    mealName: string;
    foods: string;
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  }[];
  messages: { id: string; question: string; answer: string }[];
  requests: { id: string; goal: string; status: string }[];
  subscription: {
    id: string;
    status: string;
    checkoutUrl?: string | null;
    currentPeriodEnd?: string | null;
  } | null;
  gymLinks: { role: string; tenant: { id: string; name: string } }[];
  appNotifications: { id: string; message: string; createdAt: string }[];
};
const peso = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

export function PersonalDashboard({
  user,
  legalCheckoutReady,
}: {
  user: { name: string; email: string };
  legalCheckoutReady: boolean;
}) {
  const [data, setData] = useState<Payload | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [copied, setCopied] = useState(false),
    [legalCheckoutOpen, setLegalCheckoutOpen] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch('/api/personal', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'No se pudieron cargar tus datos.');
    setData(payload);
  }, []);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('payment') !== 'return') return;
    void fetch('/api/personal/billing/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
      .then(async (r) => {
        const x = await r.json();
        if (!r.ok) throw new Error(x.error || '');
        if (x.status === 'ACTIVE') setNotice('Pago confirmado. Gymia Plus está activo.');
        else if (x.status === 'PENDING')
          setNotice(
            'El pago sigue pendiente de confirmación. Actualizaremos tu plan cuando Mercado Pago lo confirme.',
          );
        return load();
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo verificar el pago.'));
  }, [load]);
  const act = async (event: React.FormEvent<HTMLFormElement>, action: string) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const body: Record<string, string> = { action };
    form.forEach((v, k) => (body[k] = String(v)));
    if (action === 'workout.save' && body.startsAt)
      body.startsAt = new Date(body.startsAt).toISOString();
    try {
      const r = await fetch('/api/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error || 'No se pudo guardar.');
      formElement.reset();
      setNotice('Guardado.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  };
  const cancelPlan = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/personal/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || 'No se pudo cancelar.');
      setNotice(
        'Renovación cancelada. Si ya pagaste el periodo, conservarás Plus hasta su vencimiento.',
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cancelar.');
    } finally {
      setBusy(false);
    }
  };
  const checkout = async (acceptance: LegalAcceptanceInput) => {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/personal/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acceptance }),
      });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || 'No se pudo iniciar el pago.');
      if (x.initPoint) window.location.assign(x.initPoint);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al iniciar el pago.');
      setBusy(false);
    }
  };
  const todaysMeals =
    data?.meals.filter((m) => new Date(m.eatenAt).toDateString() === new Date().toDateString()) ||
    [];
  const totals = useMemo(
    () =>
      todaysMeals.reduce(
        (a, m) => ({
          calories: a.calories + m.calories,
          protein: a.protein + m.proteinGrams,
          carbs: a.carbs + m.carbsGrams,
          fat: a.fat + m.fatGrams,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      ),
    [data],
  );
  const input = (
    name: string,
    label: string,
    type = 'text',
    required = true,
    defaultValue?: string | number,
  ) => (
    <label className="personal-field">
      {label}
      <input name={name} type={type} required={required} defaultValue={defaultValue} />
    </label>
  );
  if (!data)
    return (
      <main className="personal-page">
        <div className="personal-loading">{error || 'Preparando tu espacio personal…'}</div>
      </main>
    );
  return (
    <main className="personal-page">
      <header className="personal-top">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            <Activity size={24} />
          </span>
          gymia<span className="brand-dot">.</span>
        </Link>
        <div className="personal-actions">
          {data.gymLinks.length > 0 && (
            <Link className="button secondary" href="/">
              Abrir mi gimnasio
            </Link>
          )}
          {data.gymLinks.length === 0 && (
            <Link className="button secondary" href="/setup-gym">
              Registrar un gimnasio
            </Link>
          )}
          <button
            className="button secondary"
            onClick={() => void authClient.signOut().then(() => location.assign('/login'))}
          >
            <LogOut size={17} /> Salir
          </button>
        </div>
      </header>
      {data.appNotifications.length > 0 && (
        <section className="app-renewal-notices" aria-label="Avisos de Gymia">
          <strong>Avisos de Gymia</strong>
          {data.appNotifications.map((item) => <p key={item.id}>{item.message}</p>)}
        </section>
      )}
      <section className="personal-hero">
        <div>
          <span className="eyebrow">TU ESPACIO DE ENTRENAMIENTO</span>
          <h1>
            Hola, {user.name.split(' ')[0]}
            <span className="heading-dot">.</span>
          </h1>
          <p>Registra tus rutinas, sesiones y alimentación en un solo lugar.</p>
        </div>
        <div className="personal-id">
          <span>Tu ID Gymia · privado e intransferible</span>
          <strong>{data.profile.publicId}</strong>
          <button
            className="text-button"
            onClick={() =>
              void navigator.clipboard.writeText(data.profile.publicId).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              })
            }
          >
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado' : 'Copiar ID'}
          </button>
        </div>
      </section>
      {error && (
        <div className="personal-alert" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="personal-success" role="status">
          {notice}
        </div>
      )}
      {data.gymLinks.length > 0 && (
        <section className="personal-gym-links">
          <strong>Vinculado a:</strong>
          {data.gymLinks.map((g) => (
            <span key={g.tenant.id}>{g.tenant.name}</span>
          ))}
          <small>Tu ID sirve para vincular esta cuenta en otros gimnasios.</small>
        </section>
      )}
      <section className="personal-grid">
        <article className="personal-card personal-wide">
          <div className="personal-card-title">
            <div>
              <span className="eyebrow">HOY</span>
              <h2>Alimentación y macros</h2>
            </div>
            <Leaf />
          </div>
          <div className="personal-macros">
            <div>
              <b>{totals?.calories || 0}</b>
              <small>kcal / {data.profile.dailyCalories}</small>
            </div>
            <div>
              <b>{totals?.protein || 0} g</b>
              <small>proteína / {data.profile.proteinGrams} g</small>
            </div>
            <div>
              <b>{totals?.carbs || 0} g</b>
              <small>carbohidratos / {data.profile.carbsGrams} g</small>
            </div>
            <div>
              <b>{totals?.fat || 0} g</b>
              <small>grasas / {data.profile.fatGrams} g</small>
            </div>
          </div>
          <form
            className="personal-form personal-form-grid"
            onSubmit={(e) => void act(e, 'meal.save')}
          >
            {input('mealName', 'Comida')}
            {input('foods', 'Alimentos')}
            {input('calories', 'Calorías', 'number')}
            {input('proteinGrams', 'Proteína (g)', 'number')}
            {input('carbsGrams', 'Carbohidratos (g)', 'number')}
            {input('fatGrams', 'Grasas (g)', 'number')}
            <button className="button primary" disabled={busy}>
              <Plus size={16} /> Registrar
            </button>
          </form>
          <div className="personal-list">
            {data.meals.map((m) => (
              <div key={m.id}>
                <strong>{m.mealName}</strong>
                <span>
                  {m.calories} kcal · P {m.proteinGrams}g · C {m.carbsGrams}g · G {m.fatGrams}g
                </span>
              </div>
            ))}
            {!data.meals.length && (
              <small>Registra tu primera comida para ver el resumen diario.</small>
            )}
          </div>
          <small className="personal-muted">
            Las metas son orientativas. Ajusta necesidades específicas con un profesional de
            nutrición.
          </small>
        </article>
        <article className="personal-card">
          <div className="personal-card-title">
            <div>
              <span className="eyebrow">PLANIFICACIÓN</span>
              <h2>Calendario</h2>
            </div>
            <CalendarDays />
          </div>
          <form className="personal-form" onSubmit={(e) => void act(e, 'workout.save')}>
            {input('title', 'Entrenamiento')}
            {input('startsAt', 'Fecha y hora', 'datetime-local')}
            {input('durationMinutes', 'Duración (min)', 'number')}
            <label className="personal-field">
              Notas
              <input name="notes" />
            </label>
            <button className="button primary" disabled={busy}>
              <Plus size={16} /> Agendar sesión
            </button>
          </form>
          <div className="personal-list">
            {data.workouts.map((w) => (
              <div key={w.id}>
                <strong>{w.title}</strong>
                <span>
                  {new Date(w.startsAt).toLocaleString('es-MX')} · {w.durationMinutes} min{' '}
                  {w.completedAt ? '· Completado' : ''}
                </span>
              </div>
            ))}
          </div>
        </article>
        <article className="personal-card">
          <div className="personal-card-title">
            <div>
              <span className="eyebrow">ENTRENA CON INTENCIÓN</span>
              <h2>Mis rutinas</h2>
            </div>
            <Dumbbell />
          </div>
          <p className="personal-muted">
            Gratis incluye hasta 4 rutinas. Gymia Plus permite rutinas ilimitadas.
          </p>
          <form className="personal-form" onSubmit={(e) => void act(e, 'routine.save')}>
            {input('title', 'Nombre de rutina')}
            <label className="personal-field">
              Ejercicios y notas
              <textarea name="details" required rows={4} />
            </label>
            <button className="button primary" disabled={busy}>
              <Plus size={16} /> Guardar rutina
            </button>
          </form>
          <div className="personal-list">
            {data.routines.map((r) => (
              <div key={r.id}>
                <strong>{r.title}</strong>
                <span>{r.details}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="personal-card">
          <div className="personal-card-title">
            <div>
              <span className="eyebrow">IDEAS Y RECORDATORIOS</span>
              <h2>Notas personales</h2>
            </div>
            <NotebookPen />
          </div>
          <form className="personal-form" onSubmit={(e) => void act(e, 'note.save')}>
            {input('title', 'Título')}
            <label className="personal-field">
              Nota
              <textarea name="content" required rows={3} />
            </label>
            <button className="button primary" disabled={busy}>
              <Plus size={16} /> Guardar nota
            </button>
          </form>
          <div className="personal-list">
            {data.notes.map((n) => (
              <div key={n.id}>
                <strong>{n.title}</strong>
                <span>{n.content}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="personal-card">
          <div className="personal-card-title">
            <div>
              <span className="eyebrow">ORIENTACIÓN GENERAL</span>
              <h2>Asistente Gymia</h2>
            </div>
            <Sparkles />
          </div>
          <p className="personal-muted">
            Asistente básico con respuestas guiadas sobre Gymia, macros y entrenamiento. No es un
            servicio de IA en vivo ni reemplaza asesoría médica, entrenamiento profesional o
            consulta nutricional.
          </p>
          <form className="personal-form" onSubmit={(e) => void act(e, 'coach.ask')}>
            <label className="personal-field">
              ¿En qué te ayudo?
              <textarea name="question" required minLength={5} maxLength={1000} rows={3} />
            </label>
            <button className="button primary" disabled={busy}>
              <MessageCircle size={16} /> Preguntar
            </button>
          </form>
          <div className="personal-list">
            {data.messages.map((m) => (
              <div key={m.id}>
                <strong>Tú: {m.question}</strong>
                <span>{m.answer}</span>
              </div>
            ))}
          </div>
        </article>
        <article className="personal-card personal-subscription">
          <div className="personal-card-title">
            <div>
              <span className="eyebrow">SUSCRIPCIÓN PERSONAL</span>
              <h2>{data.profile.personalPlan === 'COACH' ? 'Gymia Plus' : 'Plan Gratis'}</h2>
            </div>
            <UserRound />
          </div>
          <p>Gratis: seguimiento personal, macros y hasta 4 rutinas.</p>
          <p>
            <strong>Gymia Plus · $99 MXN al mes</strong>
            <br />
            Rutinas ilimitadas e historial ampliado. Cancela la renovación cuando quieras.
          </p>
          {data.profile.personalPlan === 'FREE' ? (
            <button className="button primary" disabled={busy} onClick={() => setLegalCheckoutOpen(true)}>
              Continuar con Mercado Pago
            </button>
          ) : (
            <>
              <span className="badge green">
                {data.subscription?.status === 'CANCELLED' ? 'Renovación cancelada' : 'Plan activo'}
              </span>
              <small>
                {' '}
                {data.subscription?.currentPeriodEnd
                  ? `${data.subscription.status === 'CANCELLED' ? 'Acceso hasta' : 'Vigente hasta'} ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString('es-MX')}`
                  : ''}
              </small>
              {data.subscription?.status !== 'CANCELLED' && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => void cancelPlan()}
                >
                  Cancelar renovación
                </button>
              )}
            </>
          )}
          <div className="personal-nutrition">
            <strong>Nutriólogo humano</strong>
            <p>
              Estamos preparando la red de profesionales. Puedes dejar una solicitud de interés; por
              ahora no se cobra ni se agenda una consulta.
            </p>
            <form className="personal-form" onSubmit={(e) => void act(e, 'nutritionist.request')}>
              <label className="personal-field">
                Tu objetivo
                <input name="goal" required />
              </label>
              <label className="personal-field">
                Qué necesitas
                <textarea name="message" minLength={5} required rows={2} />
              </label>
              <button className="button secondary" disabled={busy}>
                Solicitar información · sin costo
              </button>
            </form>
            {data.requests.map((r) => (
              <small key={r.id}>Solicitud recibida: {r.goal}</small>
            ))}
          </div>
        </article>
        <article className="personal-card">
          <div className="personal-card-title">
            <div>
              <span className="eyebrow">TU PERFIL</span>
              <h2>Objetivo y medidas</h2>
            </div>
            <Activity />
          </div>
          <form className="personal-form" onSubmit={(e) => void act(e, 'profile.update')}>
            <label className="personal-field">
              Objetivo
              <input name="goal" defaultValue={data.profile.goal} required />
            </label>
            <label className="personal-field">
              Mi plan de alimentación
              <textarea
                name="dietPlan"
                defaultValue={data.profile.dietPlan}
                rows={4}
                maxLength={5000}
                placeholder="Escribe tu plan o indicaciones que quieras consultar."
              />
            </label>
            <label className="personal-field">
              Peso (kg)
              <input
                name="weightKg"
                type="number"
                min="20"
                max="400"
                step="0.1"
                defaultValue={data.profile.weightKg ?? ''}
              />
            </label>
            <label className="personal-field">
              Estatura (cm)
              <input
                name="heightCm"
                type="number"
                min="80"
                max="250"
                defaultValue={data.profile.heightCm ?? ''}
              />
            </label>
            <label className="personal-field">
              Meta diaria calorías
              <input
                name="dailyCalories"
                type="number"
                defaultValue={data.profile.dailyCalories}
                required
              />
            </label>
            <div className="personal-form-grid">
              {input('proteinGrams', 'Proteína (g)', 'number', true, data.profile.proteinGrams)}
              {input('carbsGrams', 'Carbohidratos (g)', 'number', true, data.profile.carbsGrams)}
              {input('fatGrams', 'Grasas (g)', 'number', true, data.profile.fatGrams)}
            </div>
            <button className="button primary" disabled={busy}>
              Guardar metas
            </button>
          </form>
        </article>
      </section>
      <footer className="personal-footer">
        Tu cuenta personal es tuya. Comparte el ID Gymia únicamente con el gimnasio que quieras
        vincular.
      </footer>
      <LegalCheckoutDialog
        open={legalCheckoutOpen}
        flow="PERSONAL_PLUS"
        planName="Gymia Plus personal"
        price="99"
        released={legalCheckoutReady}
        busy={busy}
        onClose={() => setLegalCheckoutOpen(false)}
        onConfirm={(acceptance) => void checkout(acceptance)}
      />
    </main>
  );
}
