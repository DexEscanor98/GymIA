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
