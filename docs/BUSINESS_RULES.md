# Reglas de negocio acordadas

## Roles

Dueño: administra su gimnasio. Recepción: clientes, catálogo, planes, cobros, cancelaciones, accesos y asignaciones. Entrenador: solo aprendices asignados, sesiones y su asistencia laboral. Cliente: datos propios, QR, solicitud de congelación, agenda y evaluaciones.

La administración global de la plataforma SaaS no está implementada. Dueño no es administrador de otras organizaciones. Tampoco se asigna personal automáticamente por género: la preferencia se guarda y personal autorizado confirma con aceptación del cliente.

## Membresías

- Activación por una venta pagada. Inicio, fin y condiciones de sucursales se copian del plan al momento de la venta.
- No se permiten membresías superpuestas; una renovación puede empezar al vencer la actual.
- Acceso: iniciada, no vencida, pagada, no congelada/cancelada, sucursal habilitada.
- El cliente solicita congelación; recepción/dueño decide. La aprobación aplica desde el momento actual. Retroactividad no incluida.
- Congelación conserva el tiempo restante exacto. Reactivación añade ese tiempo a la fecha actual.
- Cancelar una membresía bloquea acceso; para devolver dinero se cancela también su venta. Cancelar la venta de una membresía la cancela automáticamente.
- La base y el control de acceso contemplan pago pendiente, pero la interfaz inicial vende membresías completamente pagadas; altas a crédito y liquidación son pendientes.

## Inventario y ventas

Una venta descuenta stock. Cancelar un producto recuperado lo repone; cancelar uno consumido deja las existencias descontadas y registra merma (delta de stock cero al cancelar, porque ya se descontó en la venta).

Una venta de producto maneja un tipo de producto con una cantidad. Carrito con varios tipos, descuentos, devoluciones parciales y productos fraccionarios son pendientes. Cada porción de preentreno es una unidad.

## Caja

Efectivo esperado = fondo inicial + cobros en efectivo - devoluciones en efectivo + movimientos (retiros negativos).

Ingresos netos = cobros - devoluciones. No son ganancias. Fondo, transferencias entre turnos y retiros no son ventas. Cierre guarda efectivo contado, esperado y diferencia.

El total diario suma los cobros y devoluciones por su fecha efectiva en la zona horaria del gimnasio. Las filas de turnos muestran la vida completa de cada turno seleccionado (iniciados en la fecha, además de abiertos). Si un turno cruza medianoche, su total completo puede diferir del total de movimientos del día; la interfaz lo explica.

## Asesorías

Una sesión por día local. Reserva de 60 minutos; se rechaza superposición de entrenador. También puede registrarse una sesión ya realizada al llegar/salir del cliente. Requiere membresía vigente con entrenamiento personalizado y entrenador activo asignado.

Cliente evalúa su sesión realizada de 1 a 5 estrellas y puede editar su evaluación. No puede evaluar sesiones ajenas. Horarios laborales individuales del entrenador aún no se cruzan con reservas; ver pendientes.

## Accesos y horario

Entrada y salida explícitas, sin alternancia automática para evitar que un doble escaneo saque al cliente. Solo una visita abierta por cliente. La salida está permitida aun cuando la membresía ya no permita entrar.

Cierre manual de accesos pendientes marca salidas estimadas. Ocupación depende de registros; no es conteo físico infalible. Horarios actuales admiten un intervalo diurno por día y excepciones fechadas; no horario partido ni cruce de medianoche. El indicador abierto/cerrado es informativo y no bloquea la decisión del personal de registrar acceso.

## Avisos

El script de recordatorios genera avisos internos tres días antes de vencer, con deduplicación y comprobación de renovaciones. Para envío automático externo faltan proveedores y preferencias/consentimientos. El script no se ha programado aún en un servicio externo.

## Suscripción de Gymia

- Planes: Gratis; Lite ($139 MXN/mes, 1 sucursal); Básico ($350 MXN/mes, 2 sucursales); Estándar ($550 MXN/mes, hasta 6 sucursales); Premium ($850 MXN/mes, hasta 10 sucursales).
- Gratis: 1 sucursal, 30 clientes, 5 productos y 3 empleados activos; no incluye notificaciones ni reportes/avisos de ocupación.
- Lite quita los topes de clientes y productos, conserva 1 sucursal y permite hasta 3 empleados; no incluye reportes ni avisos avanzados. Básico, Estándar y Premium quitan los topes de clientes, productos y empleados y habilitan notificaciones push e historial de visitas por hora.
- Las alertas automáticas de gimnasio vacío/saturado y el pronóstico de horas pico todavía no están implementados. El gráfico actual resume entradas registradas; no predice demanda.
- Para más de 10 sucursales o necesidades especiales se solicita cotización.
- Los planes de pago se cobran por Suscripciones de Mercado Pago con ciclo mensual. La app habilita el plan solo después de verificar con Mercado Pago la autorización y el primer pago aprobado, mediante webhook o al volver del checkout. El checkout recurrente actual ofrece los medios que Mercado Pago habilita para la suscripción; en sandbox mostró saldo y tarjetas, sin transferencia. Las transferencias manuales requerirán otro flujo de pago y confirmación antes de activar el plan.
- El token de acceso debe pertenecer a la cuenta vendedora de Gymia; el saldo de cobros se deposita en esa cuenta sujeto a las comisiones/plazos de Mercado Pago. No se debe guardar el token en el repositorio ni compartirlo por chat.
