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

- Planes: Gratis; Lite ($150 MXN/mes, 1 sucursal); Básico ($370 MXN/mes, 2 sucursales); Estándar ($579 MXN/mes, hasta 6 sucursales); Premium ($891 MXN/mes, hasta 10 sucursales). Mercado Pago publica para Suscripciones una comisión de 3.19% + IVA al instante o 2.89% + IVA a 10 días. La tarifa aplicable debe confirmarse en la cuenta vendedora antes de operar; no usar la tarifa de Checkout general (3.49% + $4 MXN + IVA) para estimar estas suscripciones recurrentes.
- Gratis: 1 sucursal, 30 clientes, 5 productos y 3 empleados activos; no incluye notificaciones ni reportes/avisos de ocupación.
- Lite quita los topes de clientes y productos, conserva 1 sucursal y permite hasta 3 empleados; no incluye reportes ni avisos avanzados. Básico, Estándar y Premium quitan los topes de clientes, productos y empleados y habilitan notificaciones push e historial de visitas por hora.
- Las alertas automáticas de gimnasio vacío/saturado y el pronóstico de horas pico todavía no están implementados. El gráfico actual resume entradas registradas; no predice demanda.
- Para más de 10 sucursales o necesidades especiales se solicita cotización.
- Los planes de pago se cobran por Suscripciones de Mercado Pago con ciclo mensual. La app habilita el plan solo después de verificar con Mercado Pago la autorización y el primer pago aprobado, mediante webhook o al volver del checkout. El checkout recurrente actual ofrece los medios que Mercado Pago habilita para la suscripción; en sandbox mostró saldo y tarjetas, sin transferencia. Las transferencias manuales requerirán otro flujo de pago y confirmación antes de activar el plan. El precio nuevo se usa al iniciar una nueva suscripción o cambiar de plan; las suscripciones existentes conservan el importe aceptado hasta que se migren expresamente.
- El token de acceso debe pertenecer a la cuenta vendedora de Gymia; el saldo de cobros se deposita en esa cuenta sujeto a las comisiones/plazos de Mercado Pago. No se debe guardar el token en el repositorio ni compartirlo por chat.
- Antes de crear o continuar un checkout pagado, el usuario debe marcar casillas separadas para contrato aplicable, Términos y Condiciones, lectura del Aviso de Privacidad y autorización expresa del cargo mensual recurrente. El botón inicia desactivado; las versiones enviadas deben coincidir con las vigentes del servidor.
- La API registra aceptación versionada vinculada al usuario, tenant cuando corresponda, referencia de suscripción, plan, importe, moneda, ciclo y hora UTC antes de iniciar o reanudar el enlace de Mercado Pago. El registro legal no guarda códigos OTP ni datos completos de tarjeta.
- El checkout de planes Gymia y Plus usa las credenciales de Mercado Pago ya configuradas. Antes de abrir el enlace de pago, la persona debe aceptar el contrato correspondiente, los Términos y Condiciones, confirmar la lectura del Aviso de Privacidad y autorizar expresamente el cobro recurrente. La API guarda la versión, el plan, el importe y la evidencia de aceptación.
- Los registros nuevos pueden confirmar el correo mediante enlace de Better Auth o el teléfono con un código SMS de Twilio Verify. Las operaciones, el acceso al espacio personal, la creación de gimnasio, la vinculación y el checkout requieren al menos uno de los dos canales verificado. Gymia no conserva el OTP. El correo funciona mediante Resend/Brevo; Twilio es opcional para el acceso y necesario solo si se ofrece verificación SMS.
- Las altas incluyen teléfono internacional E.164. La verificación por SMS tiene límite de envío por cuenta y los códigos y vencimientos los gestiona Twilio Verify. El correo transaccional se entrega por Brevo o Resend; en desarrollo local sin proveedor se imprime el enlace únicamente en la consola local.
- Un cron diario de Vercel revisa renovaciones con cinco a seis días restantes, crea un aviso idempotente en el buzón interno del dueño o usuario Plus y envía web push si esa persona lo activó. La fecha se calcula desde el siguiente vencimiento confirmado por Mercado Pago. La tarea requiere `CRON_SECRET`; un aviso interno permanece visible al iniciar sesión aunque no exista push.
- Cancelar la renovación está disponible desde la cuenta; la aceptación de cobros recurrentes muestra importe y periodicidad. El producto debe notificar renovación con al menos cinco días naturales y permitir cancelación inmediata sin penalización. El scheduler/canal de envío debe estar operativo antes de afirmar que el aviso llega automáticamente.

## Espacio personal Gymia

- Una persona puede crear su cuenta sin inscribirse en un gimnasio. Su perfil recibe un ID `GYM-` único, privado, inmutable y ligado a su cuenta. Dueño/recepción vincula al cliente introduciendo ese ID; el sistema enlaza la cuenta existente y crea la ficha de cliente si hace falta. El ID no debe tratarse como contraseña: confirmar con la persona que autoriza la vinculación.
- El espacio personal permite registrar objetivo, peso/estatura, un plan de alimentación escrito por la persona, notas, rutinas, sesiones planificadas y alimentos con calorías/macros. Los datos personales de salud no se exponen al espacio del gimnasio; el gimnasio recibe solo los datos operativos del cliente necesarios para su relación.
- Plan Gratis personal: perfil, notas, macros, calendario y hasta 4 rutinas; historial visible de 7 días de comidas y 30 sesiones. Gymia Plus: $99 MXN mensuales, rutinas ilimitadas e historial visible de 90 días de comidas y 300 sesiones. Es un precio de lanzamiento sugerido, sujeto a validar costos/comisiones y demanda. Como referencia, Fitia publicó MXN $219/mes en su tabla de México para 2025; los precios cambian y deben revisarse antes de una campaña.
- El cobro Plus se solicita con Mercado Pago recurrente y solo se activa cuando webhook o conciliación confirma el primer pago aprobado y el importe MXN esperado. Al cancelar se detiene la renovación; se conservan beneficios hasta el fin del periodo pagado.
- El asistente personal actual usa respuestas guiadas locales y reglas simples, no un modelo de IA ni consejo profesional. Solicitar nutriólogo solo guarda interés sin costo; no agenda consulta ni promete servicio hasta contar con profesionales y operación de citas.
