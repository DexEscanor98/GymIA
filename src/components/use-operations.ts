'use client';
import { useState } from 'react';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import type { WorkspaceData, MemberData, MembershipData, SaleData } from '@/lib/workspace-types';
import type { DialogSpec, Field } from './operation-dialog';
type Values = Record<string, string | boolean>;
const money = (name: string, label: string, value = 0): Field => ({
  name,
  label,
  type: 'number',
  value: value / 100,
  min: 0,
  step: '0.01',
});
const reason: Field = { name: 'reason', label: 'Motivo', type: 'textarea' };
const payment: Field = {
  name: 'method',
  label: 'Método de pago',
  type: 'select',
  options: [
    { value: 'CASH', label: 'Efectivo' },
    { value: 'TRANSFER', label: 'Transferencia confirmada' },
  ],
};
const cents = (v: unknown) => Math.round(Number(v) * 100);
export function useOperations(
  w: WorkspaceData | null,
  run: (action: string, input: unknown) => Promise<unknown>,
  branch: string,
) {
  const [dialog, setDialog] = useState<DialogSpec | null>(null);
  const open = (
    title: string,
    action: string,
    fields: Field[],
    map: (v: Values) => unknown = (v) => v,
    description?: string,
    danger = false,
    submit = 'Guardar',
  ) =>
    setDialog({
      title,
      description,
      fields,
      danger,
      submit,
      onSubmit: async (v) => {
        await run(action, map(v));
      },
    });
  const branches = w?.branches.map((b) => ({ value: b.id, label: b.name })) || [];
  const members =
    w?.members.map((m) => ({
      value: m.id,
      label: `${m.name}${m.email ? ` · ${m.email}` : ''}${m.phone ? ` · ${m.phone}` : ''}`,
    })) || [];
  const trainers =
    w?.accesses
      .filter((a) => a.role === 'TRAINER' && a.active)
      .map((a) => ({ value: a.userId, label: a.user.name })) || [];
  const timezone = w?.tenant.timezone || 'America/Mexico_City';
  return {
    dialog,
    setDialog,
    member: (m?: MemberData) =>
      open(
        m ? 'Editar cliente' : 'Nuevo cliente',
        'member.save',
        [
          { name: 'name', label: 'Nombre completo', value: m?.name },
          {
            name: 'email',
            label: 'Correo electrónico',
            type: 'email',
            value: m?.email || '',
            required: false,
          },
          {
            name: 'phone',
            label: 'Teléfono con código de país',
            value: m?.phone || '',
            required: false,
          },
          {
            name: 'preference',
            label: 'Preferencia para entrenamiento',
            type: 'select',
            value: m?.preference || 'ANY',
            options: [
              { value: 'ANY', label: 'Sin preferencia' },
              { value: 'WOMAN', label: 'Entrenadora' },
              { value: 'MAN', label: 'Entrenador' },
            ],
          },
        ],
        (v) => ({ ...v, id: m?.id }),
        !m
          ? 'Si agregas un correo, Gymia crea la cuenta y envía enlaces para verificarlo y crear su contraseña.'
          : undefined,
      ),
    link: (m?: MemberData) =>
      open(
        'Vincular cuenta del cliente',
        'member.link',
        [
          {
            name: 'publicId',
            label: 'ID único de persona Gymia',
            hint: 'Pide a la persona el ID Gymia que aparece en su cuenta personal. Es único y permanente.',
          },
        ],
        (v) => ({ ...v, id: m?.id }),
        m
          ? 'Vincula la cuenta personal que corresponde a este cliente.'
          : 'Se creará la ficha del cliente y quedará vinculada a su cuenta Gymia.',
      ),
    assign: (m: MemberData) =>
      open(
        'Asignar entrenador',
        'member.assign',
        [
          {
            name: 'trainerId',
            label: 'Entrenador disponible',
            type: 'select',
            options: trainers,
            value: m.trainerId || trainers[0]?.value,
          },
          {
            name: 'accepted',
            label: 'El cliente acepta esta asignación',
            type: 'checkbox',
            required: true,
          },
        ],
        (v) => ({ ...v, id: m.id }),
        `Preferencia: ${m.preference === 'WOMAN' ? 'entrenadora' : m.preference === 'MAN' ? 'entrenador' : 'sin preferencia'}.`,
      ),
    product: (p?: WorkspaceData['products'][number]) =>
      open(
        p ? 'Editar producto' : 'Nuevo producto',
        'product.save',
        [
          { name: 'name', label: 'Nombre', value: p?.name },
          money('price', 'Precio', p?.priceCents),
          {
            name: 'stock',
            label: 'Existencias',
            type: 'number',
            value: p?.stock || 0,
            min: 0,
            step: '1',
          },
          { ...reason, value: p ? 'Ajuste de inventario' : 'Inventario inicial' },
        ],
        (v) => ({
          id: p?.id,
          name: v.name,
          priceCents: cents(v.price),
          stock: Number(v.stock),
          reason: v.reason,
        }),
      ),
    plan: (p?: WorkspaceData['plans'][number]) =>
      open(
        p ? 'Editar membresía o paquete' : 'Nueva membresía o paquete',
        'plan.save',
        [
          { name: 'name', label: 'Nombre', value: p?.name },
          money('price', 'Precio', p?.priceCents),
          {
            name: 'days',
            label: 'Duración en días',
            type: 'number',
            value: p?.days || 30,
            min: 1,
            max: 1095,
            step: '1',
          },
          {
            name: 'personalTraining',
            label: 'Incluye una sesión personalizada por día',
            type: 'checkbox',
            value: p?.personalTraining || false,
          },
          {
            name: 'allBranches',
            label: 'Acceso a todas las sucursales',
            type: 'checkbox',
            value: p?.allBranches ?? true,
          },
          ...branches.map((b) => ({
            name: `branch_${b.value}`,
            label: b.label,
            type: 'checkbox' as const,
            value: p?.branchIds.includes(b.value) || false,
          })),
        ],
        (v) => ({
          id: p?.id,
          name: v.name,
          priceCents: cents(v.price),
          days: Number(v.days),
          personalTraining: v.personalTraining,
          allBranches: v.allBranches,
          branchIds: branches.filter((b) => v[`branch_${b.value}`]).map((b) => b.value),
        }),
      ),
    sell: (kind: 'PRODUCT' | 'MEMBERSHIP', memberId?: string) => {
      const items = kind === 'PRODUCT' ? w?.products : w?.plans;
      const key = crypto.randomUUID();
      open(
        kind === 'PRODUCT' ? 'Registrar venta' : 'Vender membresía',
        'sale.create',
        [
          {
            name: 'itemId',
            label: kind === 'PRODUCT' ? 'Producto' : 'Membresía o paquete',
            type: 'select',
            options: items?.map((i) => ({
              value: i.id,
              label: `${i.name} · $${(i.priceCents / 100).toFixed(2)}`,
            })),
          },
          {
            name: 'memberId',
            label: 'Cliente',
            type: 'search-select',
            value: memberId || '',
            required: kind === 'MEMBERSHIP',
            options: [{ value: '', label: 'Seleccionar cliente' }, ...members],
          },
          ...(kind === 'PRODUCT'
            ? [
                {
                  name: 'quantity',
                  label: 'Cantidad',
                  type: 'number' as const,
                  value: 1,
                  min: 1,
                  step: '1',
                },
              ]
            : [
                {
                  name: 'startsAt',
                  label: `Inicio (${timezone})`,
                  type: 'datetime-local' as const,
                  value: formatInTimeZone(new Date(), timezone, "yyyy-MM-dd'T'HH:mm"),
                },
                {
                  name: 'endsAt',
                  label: `Vencimiento (${timezone})`,
                  type: 'datetime-local' as const,
                  required: false,
                  hint: 'Opcional. Si lo dejas vacío, se calcula con la duración del plan.',
                },
              ]),
          payment,
          { name: 'reference', label: 'Referencia de transferencia', required: false },
        ],
        (v) => ({
          kind,
          itemId: v.itemId,
          memberId: v.memberId || undefined,
          quantity: kind === 'PRODUCT' ? Number(v.quantity) : 1,
          method: v.method,
          reference: v.reference || undefined,
          startsAt:
            kind === 'MEMBERSHIP'
              ? fromZonedTime(String(v.startsAt), timezone).toISOString()
              : undefined,
          endsAt:
            kind === 'MEMBERSHIP' && v.endsAt
              ? fromZonedTime(String(v.endsAt), timezone).toISOString()
              : undefined,
          idempotencyKey: key,
        }),
        kind === 'MEMBERSHIP'
          ? 'La venta activa una membresía pagada. Para renovar sin empalmes, usa como inicio el vencimiento actual.'
          : 'Los precios y las existencias se verifican al guardar.',
      );
    },
    cancelSale: (s: SaleData) =>
      open(
        'Cancelar venta y devolver dinero',
        'sale.cancel',
        [
          reason,
          { ...payment, name: 'refundMethod', label: 'Método de devolución', value: s.method },
          ...(s.productId
            ? [
                {
                  name: 'restock',
                  label: 'Producto recuperado: devolver al inventario',
                  type: 'checkbox' as const,
                  value: true,
                },
              ]
            : []),
        ],
        (v) => ({ id: s.id, reason: v.reason, refundMethod: v.refundMethod, restock: !!v.restock }),
        'Confirma que la devolución se realizó. Si el producto ya se consumió, desmarca la devolución al inventario: quedará como merma.',
        true,
        'Cancelar venta',
      ),
    freeze: (m: MembershipData) =>
      open(
        'Congelar membresía',
        'membership.freeze',
        [reason],
        (v) => ({ ...v, id: m.id }),
        'Se conservan los días restantes desde este momento y se bloquea el acceso.',
      ),
    resume: (m: MembershipData) =>
      open(
        'Reactivar membresía',
        'membership.resume',
        [{ ...reason, value: 'Reactivación solicitada por el cliente' }],
        (v) => ({ ...v, id: m.id }),
        'El vencimiento se recalcula con el tiempo que quedaba.',
      ),
    cancelMembership: (m: MembershipData) =>
      open(
        'Cancelar membresía',
        'membership.cancel',
        [reason],
        (v) => ({ ...v, id: m.id }),
        'Se bloquea el acceso. Si corresponde devolver dinero, cancela también la venta desde Ventas.',
        true,
        'Cancelar membresía',
      ),
    requestFreeze: (m: MembershipData) =>
      open(
        'Solicitar congelación',
        'membership.request',
        [reason],
        (v) => ({ ...v, id: m.id }),
        'Recepción o el dueño revisarán tu solicitud. Tus días no se congelan hasta su aprobación.',
      ),
    reject: (id: string) =>
      open('Rechazar solicitud', 'membership.reject', [reason], (v) => ({ ...v, id })),
    shiftOpen: () =>
      open(
        'Abrir turno',
        'shift.open',
        [
          { name: 'branchId', label: 'Sucursal', type: 'select', value: branch, options: branches },
          money('opening', 'Fondo inicial en efectivo'),
        ],
        (v) => ({ branchId: v.branchId, openingCents: cents(v.opening) }),
      ),
    shiftClose: () =>
      open(
        'Cerrar turno',
        'shift.close',
        [money('counted', 'Efectivo contado en caja')],
        (v) => ({ countedCents: cents(v.counted) }),
        'Cuenta el efectivo físico. Las transferencias se calculan por separado y el cierre conserva cualquier diferencia.',
      ),
    withdraw: () =>
      open(
        'Registrar retiro de efectivo',
        'shift.withdraw',
        [money('amount', 'Importe'), reason],
        (v) => ({ amountCents: cents(v.amount), reason: v.reason }),
      ),
    appointment: (memberId?: string, walkIn = false) =>
      open(
        walkIn ? 'Registrar sesión de hoy' : 'Agendar sesión',
        'appointment.create',
        [
          { name: 'memberId', label: 'Cliente', type: 'select', value: memberId, options: members },
          ...(!walkIn
            ? [
                {
                  name: 'startsAt',
                  label: `Fecha y hora (${timezone})`,
                  type: 'datetime-local' as const,
                  value: formatInTimeZone(
                    new Date(Date.now() + 3600000),
                    timezone,
                    "yyyy-MM-dd'T'HH:mm",
                  ),
                },
              ]
            : []),
        ],
        (v) => ({
          memberId: v.memberId,
          walkIn,
          startsAt: walkIn
            ? new Date().toISOString()
            : fromZonedTime(String(v.startsAt), timezone).toISOString(),
        }),
        walkIn
          ? 'Registra una sesión que ya se realizó. Máximo una por día.'
          : 'Duración inicial: 60 minutos. Se verifica disponibilidad y vigencia.',
      ),
    rate: (id: string) =>
      open(
        'Califica tu sesión',
        'appointment.rate',
        [
          {
            name: 'rating',
            label: 'Calificación',
            type: 'select',
            options: [5, 4, 3, 2, 1].map((n) => ({
              value: String(n),
              label: `${'★'.repeat(n)} · ${n}`,
            })),
          },
          { name: 'comment', label: 'Comentario', type: 'textarea', required: false },
        ],
        (v) => ({ id, rating: Number(v.rating), comment: v.comment }),
      ),
    branch: () =>
      open('Nueva sucursal', 'branch.create', [{ name: 'name', label: 'Nombre de la sucursal' }]),
    staff: () =>
      open(
        'Agregar empleado',
        'staff.add',
        [
          { name: 'name', label: 'Nombre completo' },
          { name: 'email', label: 'Correo de su cuenta', type: 'email' },
          {
            name: 'role',
            label: 'Rol',
            type: 'select',
            options: [
              { value: 'RECEPTION', label: 'Recepcionista' },
              { value: 'TRAINER', label: 'Entrenador/a' },
            ],
          },
        ],
        (v) => v,
        'Enviaremos al empleado un correo para verificar su cuenta y crear una contraseña propia antes de iniciar sesión.',
      ),
    schedule: (weekday: number) => {
      const s = w?.schedules.find((s) => s.branchId === branch && s.weekday === weekday);
      open(
        'Editar horario',
        'schedule.save',
        [
          { name: 'closed', label: 'Cerrado este día', type: 'checkbox', value: s?.closed },
          { name: 'opens', label: 'Apertura', type: 'time', value: s?.opens || '06:00' },
          { name: 'closes', label: 'Cierre', type: 'time', value: s?.closes || '22:00' },
        ],
        (v) => ({ ...v, branchId: branch, weekday }),
      );
    },
    exception: () =>
      open(
        'Horario especial o día festivo',
        'exception.save',
        [
          { name: 'date', label: 'Fecha', type: 'date' },
          { name: 'closed', label: 'Cerrado todo el día', type: 'checkbox', value: true },
          { name: 'opens', label: 'Apertura si abre', type: 'time', value: '08:00' },
          { name: 'closes', label: 'Cierre si abre', type: 'time', value: '14:00' },
          reason,
        ],
        (v) => ({ ...v, branchId: branch }),
      ),
    settings: () =>
      open(
        'Personalizar gimnasio',
        'tenant.save',
        [
          { name: 'name', label: 'Nombre', value: w?.tenant.name },
          { name: 'color', label: 'Color principal', type: 'color', value: w?.tenant.color },
          { name: 'timezone', label: 'Zona horaria', value: w?.tenant.timezone },
          {
            name: 'capacity',
            label: 'Capacidad máxima',
            type: 'number',
            value: w?.tenant.capacity,
            min: 1,
          },
          {
            name: 'comfortableCapacity',
            label: 'Ocupación cómoda',
            type: 'number',
            value: w?.tenant.comfortableCapacity,
            min: 1,
          },
        ],
        (v) => ({
          ...v,
          capacity: Number(v.capacity),
          comfortableCapacity: Number(v.comfortableCapacity),
        }),
      ),
    closeVisits: () =>
      open(
        'Cerrar accesos pendientes',
        'visit.closeStale',
        [{ ...reason, value: 'Cierre de jornada: salidas no registradas' }],
        (v) => ({ ...v, branchId: branch }),
        'Se marcarán como salidas estimadas todos los accesos abiertos de esta sucursal.',
        true,
        'Cerrar accesos',
      ),
  };
}
