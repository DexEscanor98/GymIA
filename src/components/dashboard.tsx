'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Clock3,
  CreditCard,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  QrCode,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { es } from 'date-fns/locale/es';
import { authClient } from '@/lib/auth-client';
import { openStatus } from '@/lib/domain';
import type { WorkspaceData, MemberData } from '@/lib/workspace-types';
import { useOperations } from './use-operations';
import { OperationDialog } from './operation-dialog';
import { QrScanner } from './qr-scanner';
import { LogoUpload } from './logo-upload';
import { PushNotifications } from './push-notifications';
const money = (c: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(c / 100);
const roles = {
  OWNER: 'Dueño',
  RECEPTION: 'Recepción',
  TRAINER: 'Entrenador/a',
  CLIENT: 'Cliente',
};
const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const navigation = [
  ['overview', 'Resumen', LayoutDashboard],
  ['members', 'Clientes', Users],
  ['plans', 'Membresías', CreditCard],
  ['products', 'Productos', Package],
  ['sales', 'Ventas', ArrowUpRight],
  ['cash', 'Caja y turnos', Wallet],
  ['access', 'Accesos', QrCode],
  ['training', 'Entrenamiento', Dumbbell],
  ['team', 'Equipo', ShieldCheck],
  ['schedule', 'Horarios', CalendarDays],
  ['settings', 'Configuración', Settings2],
] as const;
type Page = (typeof navigation)[number][0];
function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
function Empty({ text = 'Todavía no hay registros.' }: { text?: string }) {
  return (
    <div className="empty">
      <ClipboardList size={30} />
      <p>{text}</p>
    </div>
  );
}
function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar">
      {name
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')}
    </span>
  );
}
export function Dashboard({ user }: { user: { name: string; email: string } }) {
  const [w, setW] = useState<WorkspaceData | null>(null),
    [page, setPage] = useState<Page>('overview'),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [tenant, setTenant] = useState(''),
    [branch, setBranch] = useState(''),
    [reportDay, setReportDay] = useState(''),
    [search, setSearch] = useState(''),
    [menu, setMenu] = useState(false),
    [busy, setBusy] = useState(false),
    [camera, setCamera] = useState(false),
    [scanDirection, setScanDirection] = useState<'enter' | 'exit'>('enter'),
    [qr, setQr] = useState<{ member: MemberData; url: string } | null>(null);
  const scanLock = useRef(false);
  const qrDialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (tenant) params.set('tenant', tenant);
    if (reportDay) params.set('day', reportDay);
    const res = await fetch(`/api/workspace?${params}`, { cache: 'no-store' });
    const result = await res.json();
    if (res.status === 401) {
      window.location.assign('/login');
      return;
    }
    if (!res.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setW(result);
    setBranch((old) =>
      result.branches.some((b: { id: string }) => b.id === old)
        ? old
        : result.branches[0]?.id || '',
    );
    setError('');
    setLoading(false);
  }, [tenant, reportDay]);
  useEffect(() => {
    void load().catch(() => {
      setError('No se pudo conectar con el servidor.');
      setLoading(false);
    });
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js');
  }, []);
  useEffect(() => {
    if (qr) qrDialog.current?.showModal();
  }, [qr]);
  async function run(action: string, input: unknown) {
    setBusy(true);
    try {
      const res = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tenant-id': w!.tenant.id },
        body: JSON.stringify({ action, input }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setToast(result.message || 'Cambios guardados.');
      await load();
      return result;
    } finally {
      setBusy(false);
    }
  }
  const op = useOperations(w, run, branch);
  async function quick(action: string, input: unknown) {
    try {
      await run(action, input);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'No se pudo completar.');
    }
  }
  async function showQr(member: MemberData) {
    const { toDataURL } = await import('qrcode');
    setQr({
      member,
      url: await toDataURL(member.qrToken, {
        width: 360,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#172b28', light: '#ffffff' },
      }),
    });
  }
  async function scan(token: string) {
    if (scanLock.current) return;
    scanLock.current = true;
    setCamera(false);
    await quick(`visit.${scanDirection}`, { token, branchId: branch });
    setTimeout(() => {
      scanLock.current = false;
    }, 1800);
  }
  if (loading)
    return (
      <main className="loading">
        <Activity size={35} />
        <h2>Preparando tu gimnasio…</h2>
      </main>
    );
  if (!w)
    return (
      <main className="onboarding">
        <div className="auth-card">
          <span className="eyebrow">TU CUENTA ESTÁ LISTA</span>
          <h1>Registra tu gimnasio</h1>
          <p>{error}</p>
          <p>
            Si eres empleado o cliente, comparte tu correo con recepción para que vincule tu cuenta.
            Si eres dueño, crea tu gimnasio.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const fd = new FormData(e.currentTarget);
              try {
                const res = await fetch('/api/onboarding', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: fd.get('name'), slug: fd.get('slug') }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);
                await load();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Nombre del gimnasio
              <input name="name" required minLength={2} maxLength={80} />
            </label>
            <label>
              Identificador único
              <input
                name="slug"
                placeholder="mi-gimnasio"
                pattern="[a-z0-9][a-z0-9-]{2,39}"
                minLength={3}
                maxLength={40}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onInput={(e) => {
                  e.currentTarget.value = e.currentTarget.value
                    .toLowerCase()
                    .trimStart()
                    .replace(/\s+/g, '-');
                }}
                required
              />
            </label>
            <button className="button primary" disabled={busy}>
              Crear mi gimnasio <ArrowRight size={17} />
            </button>
          </form>
          <div className="inline-actions">
            <button className="text-button" onClick={() => void load()}>
              Revisar vinculación
            </button>
            <button
              className="text-button"
              onClick={async () => {
                await authClient.signOut();
                window.location.assign('/login');
              }}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </main>
    );
  const role = w.context.role,
    staff = role === 'OWNER' || role === 'RECEPTION',
    owner = role === 'OWNER',
    client = role === 'CLIENT',
    trainer = role === 'TRAINER';
  const nav = navigation.filter(([id]) =>
    staff
      ? owner || !['settings', 'team'].includes(id)
      : ['overview', 'training', 'schedule', ...(trainer ? ['members', 'team'] : [])].includes(id),
  );
  const visible = w.members.filter((m) =>
    `${m.name} ${m.email || ''} ${m.phone || ''}`.toLowerCase().includes(search.toLowerCase()),
  );
  const date = (value: string | Date, pattern = 'dd MMM, HH:mm') =>
    formatInTimeZone(new Date(value), w.tenant.timezone, pattern, { locale: es });
  const memberName = (id: string | null) => w.members.find((m) => m.id === id)?.name || 'Cliente';
  const employee = (id: string) => w.accesses.find((a) => a.userId === id)?.user.name || 'Empleado';
  const trainerAccesses = w.accesses.filter((a) => a.role === 'TRAINER' && a.active);
  const myShift = w.shifts.find((s) => s.userId === w.context.userId && !s.closedAt);
  const clocked = w.attendance.some((a) => a.userId === w.context.userId && !a.exitedAt);
  const occupancy = w.occupancy.find((o) => o.branchId === branch)?._count._all || 0;
  const currentSchedule = openStatus(
    w.schedules.filter((s) => s.branchId === branch),
    w.exceptions.filter((s) => s.branchId === branch),
    w.tenant.timezone,
  );
  const active = w.members.filter((m) =>
    m.memberships.some((s) => s.displayStatus === 'Activa'),
  ).length;
  const todayNet = w.dailyTotals.net;
  const recent = w.visits.filter((v) => v.branchId === branch).slice(0, 6);
  const hourly = Array.from({ length: 17 }, (_, i) => ({
    hour: i + 6,
    count: w.visits.filter((v) => v.branchId === branch && Number(date(v.enteredAt, 'H')) === i + 6)
      .length,
  }));
  const max = Math.max(1, ...hourly.map((h) => h.count));
  const heading: Record<Page, [string, string]> = {
    overview: [
      client ? 'Tu próximo entrenamiento empieza aquí' : `Buen día, ${user.name.split(' ')[0]}`,
      'Un vistazo a lo que pasa en tu gimnasio.',
    ],
    members: [trainer ? 'Mis aprendices' : 'Clientes', 'Personas, membresías y seguimiento.'],
    plans: ['Membresías y paquetes', 'La oferta de tu gimnasio, a tu medida.'],
    products: ['Productos e inventario', 'Cada venta y cada existencia, en orden.'],
    sales: ['Ventas', 'Cobros, devoluciones e historial.'],
    cash: ['Caja y turnos', 'El dinero de cada turno, con claridad.'],
    access: ['Control de accesos', 'Recibe a tus clientes con su credencial QR.'],
    training: ['Entrenamiento personal', 'Agenda, sesiones y seguimiento de tus aprendices.'],
    team: ['Equipo y asistencia', 'El registro de la jornada de tu equipo.'],
    schedule: ['Horarios del gimnasio', 'Horarios habituales, días festivos y excepciones.'],
    settings: ['Tu gimnasio', 'Identidad, sucursales e historial de cambios.'],
  };
  const go = (p: Page) => {
    setPage(p);
    if (p !== 'cash') setReportDay('');
    setSearch('');
    setMenu(false);
  };
  return (
    <div className="app" style={{ '--accent': w.tenant.color } as React.CSSProperties}>
      <aside className={`sidebar ${menu ? 'visible' : ''}`}>
        <a href="/" className="brand">
          <span className="brand-symbol">
            <Activity size={23} />
          </span>
          gymia<span className="brand-dot">.</span>
        </a>
        <div className="gym-identity">
          {w.tenant.logoUrl ? (
            <img src={w.tenant.logoUrl} alt="" className="gym-logo" />
          ) : (
            <div className="gym-logo">
              <Dumbbell size={21} />
            </div>
          )}
          <div>
            <strong>{w.tenant.name}</strong>
            <span>Espacio de {roles[role].toLowerCase()}</span>
          </div>
        </div>
        <span className="nav-caption">TU ESPACIO</span>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={page === id ? 'nav-item active' : 'nav-item'}
              onClick={() => go(id)}
            >
              <Icon size={19} />
              {label}
              {id === 'members' && w.freezeRequests.length > 0 && (
                <span className="nav-count">{w.freezeRequests.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={18} />
            <span>
              Tu gimnasio.
              <br />
              <strong>Tu forma de trabajar.</strong>
            </span>
          </div>
          <button
            className="profile"
            onClick={async () => {
              await authClient.signOut();
              window.location.assign('/login');
            }}
            title="Cerrar sesión"
          >
            <Avatar name={user.name} />
            <span>
              <strong>{user.name}</strong>
              <small>{roles[role]}</small>
            </span>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {menu && (
        <button className="menu-scrim" aria-label="Cerrar menú" onClick={() => setMenu(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu(!menu)}
              aria-label="Abrir menú"
            >
              <Menu />
            </button>
            <span className="breadcrumb">
              Mi gimnasio <span>/</span>{' '}
              <strong>{heading[page][0].startsWith('Buen') ? 'Resumen' : heading[page][0]}</strong>
            </span>
          </div>
          <div className="topbar-right">
            {client && <PushNotifications tenantId={w.tenant.id} />}
            {w.tenants.length > 1 && (
              <select
                aria-label="Gimnasio"
                value={w.tenant.id}
                onChange={(e) => {
                  setTenant(e.target.value);
                  setPage('overview');
                }}
              >
                {w.tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <select
              className="branch-select"
              aria-label="Sucursal"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              {w.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <button
              className="icon-button"
              aria-label="Actualizar datos"
              onClick={() => void load()}
            >
              <Activity size={19} />
            </button>
            <Avatar name={user.name} />
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {date(new Date(), 'EEEE, dd MMMM yyyy').toUpperCase()}
              </span>
              <h1>
                {heading[page][0]}
                <span className="heading-dot">.</span>
              </h1>
              <p>{heading[page][1]}</p>
            </div>
            <div className="heading-actions">
              {page === 'overview' && staff && (
                <button className="button primary" onClick={() => op.sell('PRODUCT')}>
                  <Plus size={18} />
                  Nueva venta
                </button>
              )}
              {page === 'members' && staff && (
                <button className="button primary" onClick={() => op.member()}>
                  <Plus size={18} />
                  Nuevo cliente
                </button>
              )}
              {page === 'products' && (
                <button className="button primary" onClick={() => op.product()}>
                  <Plus size={18} />
                  Nuevo producto
                </button>
              )}
              {page === 'plans' && staff && (
                <button className="button primary" onClick={() => op.plan()}>
                  <Plus size={18} />
                  Nueva membresía
                </button>
              )}
              {page === 'sales' && (
                <>
                  <button className="button secondary" onClick={() => op.sell('MEMBERSHIP')}>
                    Vender membresía
                  </button>
                  <button className="button primary" onClick={() => op.sell('PRODUCT')}>
                    <Plus size={18} />
                    Nueva venta
                  </button>
                </>
              )}
              {page === 'training' && (
                <button
                  className="button primary"
                  onClick={() => op.appointment(client ? w.members[0]?.id : undefined)}
                >
                  <Plus size={18} />
                  Agendar sesión
                </button>
              )}
              {page === 'team' && owner && (
                <button className="button primary" onClick={op.staff}>
                  <Plus size={18} />
                  Agregar empleado
                </button>
              )}
              {page === 'schedule' && owner && (
                <button className="button primary" onClick={op.exception}>
                  <Plus size={18} />
                  Horario especial
                </button>
              )}
            </div>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {page === 'overview' && (
            <>
              <div className="status-strip">
                <span>
                  <span className={`status-dot ${currentSchedule.open ? 'on' : ''}`} />
                  {currentSchedule.open ? 'Gimnasio abierto' : 'Gimnasio cerrado'}
                  <span className="muted">{currentSchedule.label}</span>
                </span>
                {!client && (
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void quick('staff.clock', { direction: clocked ? 'OUT' : 'IN' })}
                  >
                    <Clock3 size={16} />
                    {clocked ? 'Registrar mi salida' : 'Registrar mi entrada'}
                  </button>
                )}
              </div>
              <div className="metric-grid">
                {(staff
                  ? [
                      [
                        'Ingresos netos del día',
                        money(todayNet),
                        'Efectivo y transferencias',
                        Wallet,
                      ],
                      [
                        'Clientes con acceso activo',
                        String(active),
                        `${w.members.length} clientes registrados`,
                        Users,
                      ],
                      [
                        'Personas dentro',
                        String(occupancy),
                        `Capacidad cómoda: ${w.tenant.comfortableCapacity}`,
                        Activity,
                      ],
                      [
                        'Solicitudes pendientes',
                        String(w.freezeRequests.length),
                        'Congelación de membresías',
                        Clock3,
                      ],
                    ]
                  : [
                      [
                        'Personas dentro',
                        String(occupancy),
                        `Capacidad cómoda: ${w.tenant.comfortableCapacity}`,
                        Activity,
                      ],
                      [
                        'Sesiones próximas',
                        String(
                          w.appointments.filter(
                            (a) => a.status === 'BOOKED' && new Date(a.startsAt) >= new Date(),
                          ).length,
                        ),
                        'Entrenamiento personalizado',
                        CalendarDays,
                      ],
                      ...(trainer
                        ? [['Aprendices', String(w.members.length), 'Asignados a ti', Users]]
                        : []),
                    ]
                ).map(([label, value, detail, Icon]) => {
                  const I = Icon as typeof Wallet;
                  return (
                    <article className="metric" key={String(label)}>
                      <div>
                        <span>{String(label)}</span>
                        <I size={19} />
                      </div>
                      <strong>{String(value)}</strong>
                      <small>{String(detail)}</small>
                    </article>
                  );
                })}
              </div>
              {client &&
                w.members.map((m) => (
                  <section className="panel personal-card" key={m.id}>
                    <div>
                      <span className="eyebrow">TU CREDENCIAL</span>
                      <h2>{m.name}</h2>
                      <p>Ten tu QR listo al entrar y al salir.</p>
                      <button className="button primary" onClick={() => void showQr(m)}>
                        <QrCode size={18} />
                        Mostrar mi QR
                      </button>
                    </div>
                    <div>
                      {m.memberships.map((s) => (
                        <div className="membership-summary" key={s.id}>
                          <strong>{s.planName}</strong>
                          <Badge tone={s.displayStatus === 'Activa' ? 'green' : 'amber'}>
                            {s.displayStatus}
                          </Badge>
                          <p>
                            Inicio: {date(s.startsAt, 'dd MMM yyyy')} · Vence:{' '}
                            {date(s.endsAt, 'dd MMM yyyy')}
                          </p>
                          {s.status === 'ACTIVE' && (
                            <button className="text-button" onClick={() => op.requestFreeze(s)}>
                              Solicitar congelación
                            </button>
                          )}
                          {s.status === 'FROZEN' && (
                            <p>
                              Tiempo conservado: {Math.ceil(Number(s.remainingMs) / 86400000)} días.
                              Contacta con recepción para reactivar.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              <div className="overview-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>{staff ? 'El ritmo de hoy' : 'Ocupación actual'}</h2>
                      <p>
                        {staff
                          ? 'Entradas registradas por hora en esta sucursal.'
                          : 'Planea tu visita con la información del gimnasio.'}
                      </p>
                    </div>
                    <Badge>Hoy</Badge>
                  </div>
                  {staff ? (
                    <>
                      <div className="chart">
                        {hourly.map((h) => (
                          <div className="chart-column" key={h.hour}>
                            <span className="bar-value">{h.count || ''}</span>
                            <div
                              className="bar"
                              style={{ height: `${Math.max(3, (h.count / max) * 145)}px` }}
                              title={`${h.hour}:00 · ${h.count} entradas`}
                            />
                            <small>{h.hour % 2 === 0 ? `${h.hour}h` : ''}</small>
                          </div>
                        ))}
                      </div>
                      <div className="chart-footer">
                        <span>
                          <i /> Entradas reales
                        </span>
                        <span>Las predicciones se incorporarán con más historial.</span>
                      </div>
                    </>
                  ) : (
                    <div className="occupancy-block">
                      <strong>
                        {occupancy}
                        <small> personas</small>
                      </strong>
                      <div className="progress">
                        <div
                          style={{
                            width: `${Math.min(100, (occupancy / w.tenant.capacity) * 100)}%`,
                          }}
                        />
                      </div>
                      <p>
                        {occupancy >= w.tenant.comfortableCapacity
                          ? 'Hay más actividad de lo habitual para entrenar cómodamente.'
                          : 'Hay espacio para entrenar con comodidad.'}
                      </p>
                      <small>Estimación basada en entradas y salidas registradas.</small>
                    </div>
                  )}
                </section>
                <section className="quick-panel">
                  <span className="eyebrow">TODO LISTO PARA HOY</span>
                  <h2>{staff ? 'Un día que fluye.' : 'Tu espacio para avanzar.'}</h2>
                  <p>
                    {staff
                      ? 'Menos tiempo en el mostrador. Más atención para tus clientes.'
                      : 'Revisa tus sesiones y los horarios antes de venir.'}
                  </p>
                  {staff ? (
                    <>
                      <button onClick={() => go('access')}>
                        <span>
                          <QrCode size={21} />
                          Registrar acceso
                        </span>
                        <ArrowRight size={18} />
                      </button>
                      <button onClick={() => op.sell('MEMBERSHIP')}>
                        <span>
                          <CreditCard size={21} />
                          Vender membresía
                        </span>
                        <ArrowRight size={18} />
                      </button>
                      <button onClick={() => go('cash')}>
                        <span>
                          <Wallet size={21} />
                          Revisar mi caja
                        </span>
                        <ArrowRight size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => go('training')}>
                        <span>
                          <Dumbbell size={21} />
                          Mis sesiones
                        </span>
                        <ArrowRight size={18} />
                      </button>
                      <button onClick={() => go('schedule')}>
                        <span>
                          <Clock3 size={21} />
                          Consultar horarios
                        </span>
                        <ArrowRight size={18} />
                      </button>
                    </>
                  )}
                </section>
              </div>
              {staff && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Últimos accesos</h2>
                      <p>La actividad más reciente de tu sucursal.</p>
                    </div>
                    <button className="text-button" onClick={() => go('access')}>
                      Ver todos <ArrowRight size={16} />
                    </button>
                  </div>
                  {recent.length ? (
                    <Table headers={['Cliente', 'Entrada', 'Salida', 'Estado']}>
                      {recent.map((v) => (
                        <tr key={v.id}>
                          <td>
                            <div className="person">
                              <Avatar name={memberName(v.memberId)} />
                              <strong>{memberName(v.memberId)}</strong>
                            </div>
                          </td>
                          <td>{date(v.enteredAt, 'HH:mm')}</td>
                          <td>{v.exitedAt ? date(v.exitedAt, 'HH:mm') : '—'}</td>
                          <td>
                            <Badge tone={!v.exitedAt ? 'green' : 'neutral'}>
                              {v.exitedAt ? 'Finalizada' : 'Dentro'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </Table>
                  ) : (
                    <Empty text="El próximo acceso registrado aparecerá aquí." />
                  )}
                </section>
              )}
              {client && w.notifications.length > 0 && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Avisos</h2>
                    <Bell size={18} />
                  </div>
                  {w.notifications.map((n) => (
                    <div className="list-row" key={n.id}>
                      <p>{n.message}</p>
                      <small>{date(n.createdAt)}</small>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
          {page === 'members' && (
            <>
              {staff && w.freezeRequests.length > 0 && (
                <section className="panel requests">
                  <div className="panel-heading">
                    <h2>Solicitudes de congelación</h2>
                    <Badge tone="amber">{w.freezeRequests.length} pendientes</Badge>
                  </div>
                  {w.freezeRequests.map((r) => {
                    const m = w.members
                      .find((m) => m.id === r.memberId)
                      ?.memberships.find((s) => s.id === r.membershipId);
                    return (
                      <div className="list-row" key={r.id}>
                        <div>
                          <strong>{memberName(r.memberId)}</strong>
                          <p>{r.reason}</p>
                        </div>
                        <div className="inline-actions">
                          {m && (
                            <button className="button small primary" onClick={() => op.freeze(m)}>
                              Aprobar
                            </button>
                          )}
                          <button className="text-button" onClick={() => op.reject(r.id)}>
                            Rechazar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}
              <section className="panel">
                <div className="panel-heading">
                  <h2>
                    {w.members.length} {trainer ? 'aprendices' : 'clientes'}
                  </h2>
                  <label className="search">
                    <Search size={17} />
                    <input
                      aria-label="Buscar cliente"
                      placeholder="Buscar cliente…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                {visible.length ? (
                  <Table
                    headers={['Cliente', 'Membresía', 'Vencimiento', 'Entrenador', 'Acciones']}
                  >
                    {visible.map((m) => {
                      const s =
                        m.memberships.find(
                          (s) => s.displayStatus === 'Activa' || s.displayStatus === 'Congelada',
                        ) || m.memberships[0];
                      return (
                        <tr key={m.id}>
                          <td>
                            <div className="person">
                              <Avatar name={m.name} />
                              <div>
                                <strong>{m.name}</strong>
                                <small>{m.email || 'Sin correo registrado'}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {s ? (
                              <>
                                <Badge tone={s.displayStatus === 'Activa' ? 'green' : 'amber'}>
                                  {s.displayStatus}
                                </Badge>
                                <small>{s.planName}</small>
                              </>
                            ) : (
                              <Badge>Sin membresía</Badge>
                            )}
                          </td>
                          <td>
                            {s ? date(s.endsAt, 'dd MMM yyyy') : '—'}
                            {s?.status === 'FROZEN' && (
                              <small>
                                {Math.ceil(Number(s.remainingMs) / 86400000)} días conservados
                              </small>
                            )}
                          </td>
                          <td>{m.trainerId ? employee(m.trainerId) : 'Sin asignar'}</td>
                          <td>
                            <details className="row-menu">
                              <summary>
                                Gestionar <ChevronDown size={14} />
                              </summary>
                              <div>
                                {staff && (
                                  <>
                                    <button onClick={() => op.member(m)}>Editar datos</button>
                                    <button onClick={() => void showQr(m)}>
                                      Ver credencial QR
                                    </button>
                                    <button onClick={() => op.link(m)}>Vincular cuenta</button>
                                    <button onClick={() => op.sell('MEMBERSHIP', m.id)}>
                                      Vender / renovar membresía
                                    </button>
                                    <button onClick={() => op.assign(m)}>Asignar entrenador</button>
                                    {s?.status === 'ACTIVE' && (
                                      <button onClick={() => op.freeze(s)}>
                                        Congelar membresía
                                      </button>
                                    )}
                                    {s?.status === 'FROZEN' && (
                                      <button onClick={() => op.resume(s)}>
                                        Reactivar membresía
                                      </button>
                                    )}
                                    {s && s.status !== 'CANCELLED' && (
                                      <button onClick={() => op.cancelMembership(s)}>
                                        Cancelar membresía
                                      </button>
                                    )}
                                  </>
                                )}
                                <button onClick={() => op.appointment(m.id)}>Agendar sesión</button>
                                <button onClick={() => op.appointment(m.id, true)}>
                                  Registrar sesión de hoy
                                </button>
                              </div>
                            </details>
                          </td>
                        </tr>
                      );
                    })}
                  </Table>
                ) : (
                  <Empty />
                )}
              </section>
            </>
          )}
          {page === 'plans' && (
            <div className="plan-grid">
              {w.plans.map((p) => (
                <article
                  className={`panel plan-card ${p.personalTraining ? 'featured' : ''}`}
                  key={p.id}
                >
                  <div className="plan-icon">
                    <Dumbbell size={25} />
                  </div>
                  {p.personalTraining && <Badge tone="green">Con entrenamiento personal</Badge>}
                  <h2>{p.name}</h2>
                  <div className="plan-price">
                    {money(p.priceCents)}
                    <span>/ {p.days} días</span>
                  </div>
                  <ul>
                    <li>
                      <Check size={17} />
                      Acceso durante {p.days} días
                    </li>
                    <li>
                      <Check size={17} />
                      {p.allBranches
                        ? 'Todas las sucursales'
                        : `${p.branchIds.length} sucursal(es)`}
                    </li>
                    {p.personalTraining && (
                      <li>
                        <Check size={17} />
                        Una sesión personalizada por día
                      </li>
                    )}
                    <li>
                      <Check size={17} />
                      Credencial QR
                    </li>
                  </ul>
                  <button className="button secondary wide" onClick={() => op.plan(p)}>
                    Editar membresía
                  </button>
                </article>
              ))}
              {!w.plans.length && <Empty text="Crea la primera membresía de tu gimnasio." />}
            </div>
          )}
          {page === 'products' && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Catálogo de productos</h2>
                <Badge>{w.products.length} productos</Badge>
              </div>
              {w.products.length ? (
                <Table headers={['Producto', 'Precio', 'Disponible', 'Acciones']}>
                  {w.products.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="person">
                          <span className="product-icon">
                            <Package size={20} />
                          </span>
                          <strong>{p.name}</strong>
                        </div>
                      </td>
                      <td>{money(p.priceCents)}</td>
                      <td>
                        <Badge tone={p.stock <= 5 ? 'amber' : 'green'}>{p.stock} unidades</Badge>
                      </td>
                      <td>
                        <button className="text-button" onClick={() => op.product(p)}>
                          Editar / ajustar
                        </button>
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <Empty />
              )}
              <div className="panel-footer">
                Las devoluciones recuperadas reponen existencias. Los consumidos quedan registrados
                como merma.
              </div>
            </section>
          )}
          {page === 'sales' && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Últimas ventas</h2>
                <span className="muted">Hasta 200 registros recientes</span>
              </div>
              {w.sales.length ? (
                <Table headers={['Concepto', 'Fecha', 'Pago', 'Total', 'Estado', 'Acciones']}>
                  {w.sales.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <strong>{s.label}</strong>
                        <small>
                          {s.quantity} unidad(es) {s.memberId ? `· ${memberName(s.memberId)}` : ''}
                        </small>
                      </td>
                      <td>{date(s.createdAt)}</td>
                      <td>
                        {s.method === 'CASH' ? 'Efectivo' : 'Transferencia'}
                        <small>{s.reference}</small>
                      </td>
                      <td className="numeric">{money(s.totalCents)}</td>
                      <td>
                        <Badge tone={s.cancelledAt ? 'red' : 'green'}>
                          {s.cancelledAt ? 'Cancelada' : 'Pagada'}
                        </Badge>
                        {s.cancelledAt && (
                          <small>
                            {s.cancelReason}
                            {s.productId && !s.restocked ? ' · Merma' : ''}
                          </small>
                        )}
                      </td>
                      <td>
                        {!s.cancelledAt && (
                          <button className="text-button" onClick={() => op.cancelSale(s)}>
                            Cancelar y devolver
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <Empty text="Abre un turno y registra tu primera venta." />
              )}
            </section>
          )}
          {page === 'cash' && (
            <>
              <div className="cash-banner">
                <div>
                  <span className="eyebrow">MI TURNO</span>
                  <h2>{myShift ? 'Tu caja está abierta' : 'Empieza un nuevo turno'}</h2>
                  <p>
                    {myShift
                      ? `Abierto a las ${date(myShift.openedAt, 'HH:mm')} · ${employee(myShift.userId)}`
                      : 'Registra el fondo inicial antes de realizar ventas.'}
                  </p>
                </div>
                <div className="inline-actions">
                  {myShift ? (
                    <>
                      <button className="button secondary" onClick={op.withdraw}>
                        Retirar efectivo
                      </button>
                      <button className="button primary" onClick={op.shiftClose}>
                        Cerrar turno
                      </button>
                    </>
                  ) : (
                    <button className="button primary" onClick={op.shiftOpen}>
                      <Plus size={18} />
                      Abrir turno
                    </button>
                  )}
                </div>
              </div>
              {myShift && (
                <div className="metric-grid three">
                  {[
                    ['Efectivo esperado', myShift.totals.expected],
                    ['Transferencias netas', myShift.totals.transfer],
                    ['Ingresos netos del turno', myShift.totals.net],
                  ].map(([label, value]) => (
                    <article className="metric" key={String(label)}>
                      <span>{label}</span>
                      <strong>{money(Number(value))}</strong>
                      <small>El fondo inicial no es un ingreso.</small>
                    </article>
                  ))}
                </div>
              )}
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Turnos y cierre diario</h2>
                    <p>Turnos iniciados en la fecha seleccionada y turnos aún abiertos.</p>
                  </div>
                  <input
                    aria-label="Día del reporte"
                    type="date"
                    value={reportDay || w.reportDay}
                    onChange={(e) => setReportDay(e.target.value)}
                  />
                </div>
                {w.shifts.length ? (
                  <Table
                    headers={[
                      'Recepcionista',
                      'Turno',
                      'Fondo inicial',
                      'Efectivo neto',
                      'Transferencias',
                      'Total neto',
                      'Diferencia',
                    ]}
                  >
                    {w.shifts.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{employee(s.userId)}</strong>
                          <small>{w.branches.find((b) => b.id === s.branchId)?.name}</small>
                        </td>
                        <td>
                          {date(s.openedAt, 'HH:mm')} –{' '}
                          {s.closedAt ? date(s.closedAt, 'HH:mm') : 'Abierto'}
                        </td>
                        <td>{money(s.openingCents)}</td>
                        <td>{money(s.totals.cash)}</td>
                        <td>{money(s.totals.transfer)}</td>
                        <td>
                          <strong>{money(s.totals.net)}</strong>
                        </td>
                        <td>
                          {s.countedCents !== null && s.expectedCents !== null ? (
                            <Badge tone={s.countedCents === s.expectedCents ? 'green' : 'amber'}>
                              {money(s.countedCents - s.expectedCents)}
                            </Badge>
                          ) : (
                            'Por contar'
                          )}
                        </td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <Empty />
                )}
                <div className="panel-footer totals">
                  <span>
                    Efectivo neto <strong>{money(w.dailyTotals.cash)}</strong>
                  </span>
                  <span>
                    Transferencias <strong>{money(w.dailyTotals.transfer)}</strong>
                  </span>
                  <span>
                    Total del día <strong>{money(todayNet)}</strong>
                  </span>
                </div>
              </section>
              <p className="muted">
                El total diario usa la fecha de cada cobro y devolución. Cada fila muestra su turno
                completo, incluso si cruza medianoche. Son ingresos netos, no ganancias.
              </p>
            </>
          )}
          {page === 'access' && (
            <>
              <section className="panel access-panel">
                <div>
                  <span className="eyebrow">RECEPCIÓN ÁGIL</span>
                  <h2>Un QR. Todo listo.</h2>
                  <p>Escanea la credencial del cliente o búscalo en la lista.</p>
                  <div className="segmented">
                    <button
                      className={scanDirection === 'enter' ? 'selected' : ''}
                      onClick={() => setScanDirection('enter')}
                    >
                      <ArrowDownLeft size={17} />
                      Entrada
                    </button>
                    <button
                      className={scanDirection === 'exit' ? 'selected' : ''}
                      onClick={() => setScanDirection('exit')}
                    >
                      <ArrowUpRight size={17} />
                      Salida
                    </button>
                  </div>
                  <button className="button primary" onClick={() => setCamera(!camera)}>
                    <QrCode size={18} />
                    {camera ? 'Cerrar cámara' : 'Abrir cámara'}
                  </button>
                </div>
                <div className="manual-access">
                  <label>
                    Registro manual
                    <select id="manual-member">
                      <option value="">Seleccionar cliente</option>
                      {w.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => {
                      const value = (document.getElementById('manual-member') as HTMLSelectElement)
                        .value;
                      if (value) void scan(value);
                    }}
                  >
                    Registrar {scanDirection === 'enter' ? 'entrada' : 'salida'}
                  </button>
                  <small>La salida se permite aunque la membresía haya vencido.</small>
                </div>
              </section>
              {camera && (
                <section className="panel">
                  <QrScanner onScan={(text) => void scan(text)} />
                </section>
              )}
              <section className="panel">
                <div className="panel-heading">
                  <h2>Registro de accesos</h2>
                  <button className="text-button" onClick={op.closeVisits}>
                    Cerrar accesos pendientes
                  </button>
                </div>
                {w.visits.filter((v) => v.branchId === branch).length ? (
                  <Table headers={['Cliente', 'Entrada', 'Salida', 'Registro']}>
                    {w.visits
                      .filter((v) => v.branchId === branch)
                      .map((v) => (
                        <tr key={v.id}>
                          <td>{memberName(v.memberId)}</td>
                          <td>{date(v.enteredAt)}</td>
                          <td>{v.exitedAt ? date(v.exitedAt) : 'Dentro'}</td>
                          <td>
                            <Badge tone={v.automaticExit ? 'amber' : 'neutral'}>
                              {v.automaticExit ? 'Salida estimada' : 'Registro manual / QR'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                  </Table>
                ) : (
                  <Empty />
                )}
              </section>
            </>
          )}
          {page === 'training' && (
            <>
              <div className="info-banner">
                <Dumbbell size={22} />
                <p>
                  Una sesión por día. Reservas de 60 minutos; puedes agendar fechas futuras mientras
                  la membresía siga vigente ese día.
                </p>
                {!client && (
                  <button
                    className="button secondary"
                    onClick={() => op.appointment(undefined, true)}
                  >
                    Registrar sin cita
                  </button>
                )}
              </div>
              {client && (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Horarios de entrenadores</h2>
                      <p>Base visible para elegir una hora antes de reservar.</p>
                    </div>
                    <Badge>{trainerAccesses.length} activos</Badge>
                  </div>
                  {trainerAccesses.length ? (
                    trainerAccesses.map((a) => (
                      <div className="list-row" key={a.id}>
                        <div>
                          <strong>{a.user.name}</strong>
                          <p>
                            {w.branches
                              .map((b) => {
                                const openDays = w.schedules.filter(
                                  (s) => s.branchId === b.id && !s.closed,
                                );
                                if (!openDays.length) return `${b.name}: cerrado`;
                                return `${b.name}: ${openDays
                                  .map((s) => `${days[s.weekday]} ${s.opens}-${s.closes}`)
                                  .join(', ')}`;
                              })
                              .join(' · ')}
                          </p>
                        </div>
                        <Badge>Horario base</Badge>
                      </div>
                    ))
                  ) : (
                    <Empty text="Todavía no hay entrenadores activos." />
                  )}
                </section>
              )}
              <section className="panel">
                <div className="panel-heading">
                  <h2>Agenda y sesiones</h2>
                  <Badge>
                    {w.appointments.filter((a) => a.status === 'BOOKED').length} reservadas
                  </Badge>
                </div>
                {w.appointments.length ? (
                  <Table
                    headers={['Cliente', 'Entrenador', 'Fecha', 'Estado', 'Evaluación', 'Acciones']}
                  >
                    {w.appointments.map((a) => (
                      <tr key={a.id}>
                        <td>{memberName(a.memberId)}</td>
                        <td>{employee(a.trainerId)}</td>
                        <td>{date(a.startsAt)}</td>
                        <td>
                          <Badge
                            tone={
                              a.status === 'COMPLETED'
                                ? 'green'
                                : a.status === 'CANCELLED'
                                  ? 'red'
                                  : 'amber'
                            }
                          >
                            {
                              {
                                BOOKED: 'Reservada',
                                COMPLETED: 'Realizada',
                                CANCELLED: 'Cancelada',
                              }[a.status]
                            }
                          </Badge>
                        </td>
                        <td>
                          {a.rating ? (
                            <>
                              <span className="stars">{'★'.repeat(a.rating)}</span>
                              <small>{a.comment}</small>
                            </>
                          ) : (
                            'Sin evaluación'
                          )}
                        </td>
                        <td>
                          <div className="inline-actions">
                            {a.status === 'BOOKED' && (
                              <>
                                {!client && (
                                  <button
                                    className="text-button"
                                    disabled={busy}
                                    onClick={() => void quick('appointment.complete', { id: a.id })}
                                  >
                                    Realizada
                                  </button>
                                )}
                                <button
                                  className="text-button"
                                  disabled={busy}
                                  onClick={() => void quick('appointment.cancel', { id: a.id })}
                                >
                                  Cancelar cita
                                </button>
                              </>
                            )}
                            {client && a.status === 'COMPLETED' && (
                              <button className="text-button" onClick={() => op.rate(a.id)}>
                                Calificar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <Empty text="Las reservas y sesiones realizadas aparecerán aquí." />
                )}
              </section>
            </>
          )}
          {page === 'team' && (
            <>
              <div className="info-banner">
                <Clock3 size={23} />
                <div>
                  <strong>{clocked ? 'Tu entrada está registrada' : 'Registra tu jornada'}</strong>
                  <p>La asistencia laboral se guarda separada de los accesos de clientes.</p>
                </div>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void quick('staff.clock', { direction: clocked ? 'OUT' : 'IN' })}
                >
                  {clocked ? 'Registrar salida' : 'Registrar entrada'}
                </button>
              </div>
              {owner && (
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Mi equipo</h2>
                  </div>
                  <Table headers={['Nombre', 'Rol', 'Estado', 'Acciones']}>
                    {w.accesses
                      .filter((a) => a.role !== 'CLIENT')
                      .map((a) => (
                        <tr key={a.id}>
                          <td>{a.user.name}</td>
                          <td>{roles[a.role]}</td>
                          <td>
                            <Badge tone={a.active ? 'green' : 'red'}>
                              {a.active ? 'Activo' : 'Desactivado'}
                            </Badge>
                          </td>
                          <td>
                            {a.role !== 'OWNER' && (
                              <button
                                className="text-button"
                                disabled={busy}
                                onClick={() =>
                                  void quick('staff.toggle', { id: a.id, active: !a.active })
                                }
                              >
                                {a.active ? 'Desactivar' : 'Activar'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </Table>
                </section>
              )}
              <section className="panel">
                <div className="panel-heading">
                  <h2>Asistencia laboral</h2>
                </div>
                {w.attendance.length ? (
                  <Table headers={['Empleado', 'Entrada', 'Salida']}>
                    {w.attendance.map((a) => (
                      <tr key={a.id}>
                        <td>{employee(a.userId)}</td>
                        <td>{date(a.enteredAt)}</td>
                        <td>{a.exitedAt ? date(a.exitedAt) : 'Jornada abierta'}</td>
                      </tr>
                    ))}
                  </Table>
                ) : (
                  <Empty />
                )}
              </section>
            </>
          )}
          {page === 'schedule' && (
            <>
              <div className="status-strip">
                <span>
                  <span className={`status-dot ${currentSchedule.open ? 'on' : ''}`} />
                  {currentSchedule.open ? 'Abierto ahora' : 'Cerrado ahora'}{' '}
                  <span className="muted">{currentSchedule.label}</span>
                </span>
                <span className="muted">{w.tenant.timezone}</span>
              </div>
              <div className="overview-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Semana habitual</h2>
                  </div>
                  {[1, 2, 3, 4, 5, 6, 0].map((day) => {
                    const s = w.schedules.find((s) => s.branchId === branch && s.weekday === day);
                    return (
                      <div className="list-row" key={day}>
                        <strong>{days[day]}</strong>
                        <span>{!s || s.closed ? 'Cerrado' : `${s.opens} — ${s.closes}`}</span>
                        {owner && (
                          <button className="text-button" onClick={() => op.schedule(day)}>
                            Editar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </section>
                <section className="panel">
                  <div className="panel-heading">
                    <h2>Días especiales</h2>
                  </div>
                  {w.exceptions.filter((e) => e.branchId === branch).length ? (
                    w.exceptions
                      .filter((e) => e.branchId === branch)
                      .map((e) => (
                        <div className="list-row" key={e.id}>
                          <div>
                            <strong>{e.date}</strong>
                            <p>{e.reason}</p>
                          </div>
                          <Badge tone="amber">
                            {e.closed ? 'Cerrado' : `${e.opens} – ${e.closes}`}
                          </Badge>
                        </div>
                      ))
                  ) : (
                    <Empty text="Sin excepciones de horario registradas." />
                  )}
                </section>
              </div>
            </>
          )}
          {page === 'settings' && owner && (
            <>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Identidad del gimnasio</h2>
                    <p>Nombre, color, logo y capacidad.</p>
                  </div>
                  <button className="button primary" onClick={op.settings}>
                    Personalizar
                  </button>
                </div>
                <div className="settings-preview">
                  <div className="color-swatch" style={{ background: w.tenant.color }} />
                  <div>
                    <h2>{w.tenant.name}</h2>
                    <p>
                      {w.tenant.timezone} · Capacidad: {w.tenant.capacity} personas
                    </p>
                  </div>
                </div>
                <LogoUpload tenantId={w.tenant.id} logoUrl={w.tenant.logoUrl} onSaved={load} />
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Sucursales</h2>
                  <button className="button secondary" onClick={op.branch}>
                    <Plus size={17} />
                    Agregar
                  </button>
                </div>
                {w.branches.map((b) => (
                  <div className="list-row" key={b.id}>
                    <strong>{b.name}</strong>
                    <Badge>Activa</Badge>
                  </div>
                ))}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Historial de cambios</h2>
                  <span className="muted">Últimos 100 movimientos</span>
                </div>
                <Table headers={['Fecha', 'Responsable', 'Operación', 'Referencia']}>
                  {w.logs.map((l) => (
                    <tr key={l.id}>
                      <td>{date(l.createdAt)}</td>
                      <td>{employee(l.actorId)}</td>
                      <td>{l.action}</td>
                      <td>
                        <code>{l.entityId.slice(-8)}</code>
                      </td>
                    </tr>
                  ))}
                </Table>
              </section>
            </>
          )}
          <footer className="workspace-footer">
            <span>
              gymia. <span>Tu gimnasio, en orden.</span>
            </span>
            <span>
              {roles[role]} · {w.tenant.name}
            </span>
          </footer>
        </main>
      </div>
      {op.dialog && <OperationDialog spec={op.dialog} onClose={() => op.setDialog(null)} />}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button className="icon-button" aria-label="Cerrar aviso" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {qr && (
        <dialog ref={qrDialog} className="dialog qr-dialog" onCancel={() => setQr(null)}>
          <div className="dialog-head">
            <h2>Credencial de acceso</h2>
            <button className="icon-button" onClick={() => setQr(null)} aria-label="Cerrar">
              <X />
            </button>
          </div>
          <div className="credential">
            <span className="eyebrow">{w.tenant.name}</span>
            <img src={qr.url} alt={`QR de acceso de ${qr.member.name}`} width={260} height={260} />
            <h2>{qr.member.name}</h2>
            <p>Presenta tu QR al entrar y al salir.</p>
          </div>
          <div className="inline-actions">
            <a className="button primary" href={qr.url} download={`credencial-${qr.member.id}.png`}>
              Descargar QR
            </a>
            <a
              className="button secondary"
              href={`mailto:${qr.member.email || ''}?subject=${encodeURIComponent('Tu credencial de ' + w.tenant.name)}&body=${encodeURIComponent('Abre tu credencial QR: ' + window.location.origin + '/credencial#' + qr.member.qrToken)}`}
            >
              Correo
            </a>
            <a
              className="button secondary"
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/${(qr.member.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent('Tu credencial de ' + w.tenant.name + ': ' + window.location.origin + '/credencial#' + qr.member.qrToken)}`}
            >
              WhatsApp
            </a>
          </div>
          <p className="muted">
            Los botones abren tu correo o WhatsApp; el envío lo confirmas tú. Para compartir fuera
            de esta Mac se requiere publicar con HTTPS.
          </p>
        </dialog>
      )}
    </div>
  );
}
