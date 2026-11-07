# Arquitectura

## Stack y decisión inicial

Next.js 16 / React 19 / TypeScript, Prisma 7, PostgreSQL y Better Auth. Node 24 LTS. Se fija Prisma 7 estable para no depender de la versión 8 candidata. La versión exacta de cada dependencia queda en `package-lock.json`.

Monolito modular: una aplicación y una base de datos, con módulos del servidor por área. La API HTTP puede ser consumida en una futura aplicación Expo. No se comparte Prisma ni secretos con el navegador.

## Límites de responsabilidad

- `context.ts`: autentica sesión, obtiene el usuario del servidor y valida que su acceso al gimnasio siga activo.
- `operations.ts`: lista explícita de comandos y despacho.
- `commerce.ts`: catálogo, ventas, inventario y caja.
- `members.ts`: clientes, membresías, accesos y asistencia laboral.
- `training.ts`: asignaciones/sesiones y evaluaciones (la asignación reside en members).
- `admin.ts`: configuración del dueño, empleados y horarios.
- `workspace.ts`: proyección de lectura filtrada por organización y rol.
- `common.ts`: transacciones serializables y auditoría.
- `domain.ts`: reglas puras, fechas y cálculos sin acceso a la base de datos.

## Multigimnasio

Tenant es la organización del dueño. Branch es una sede. Access vincula User con Tenant y su rol. Member representa al cliente del gimnasio; puede existir sin cuenta de acceso y vincularse posteriormente por personal autorizado.

El usuario activo y el rol jamás se aceptan del cuerpo de una solicitud. El identificador de gimnasio enviado por el navegador solo selecciona un Access autorizado. Todas las consultas de negocio se acotan por tenantId. Los identificadores de objetos recibidos se verifican dentro del mismo gimnasio.

La primera entrega aplica aislamiento en los servicios y pruebas cruzadas. **No implementa RLS** ni claves compuestas de inquilino en todas las relaciones. Las altas de nuevas consultas requieren revisión y pruebas de aislamiento. Endurecer con RLS y/o relaciones compuestas es un pendiente explícito antes de ampliar acceso directo a la base.

## Dinero e inventario

Los importes se almacenan en centavos enteros; moneda inicial MXN. Nunca usar decimales binarios para persistir dinero. Sale conserva descripción, cantidad y precio histórico. Refund se representa en la propia Sale con referencia al turno y método de devolución; el original no se borra.

La venta usa idempotencyKey y transacción serializable; los reintentos no duplican descuentos. Las existencias se decrementan con condición de disponibilidad. Las migraciones incluyen restricciones de saldo de inventario y cantidad/precio.

Las cancelaciones solo pueden hacerse una vez y se registran en auditoría. Los reportes contabilizan cobros en el turno original y devoluciones en el turno de devolución. Las transferencias se confirman manualmente; no hay integración bancaria.

## Fechas

Instantes en PostgreSQL; zona horaria IANA por gimnasio. El calendario de las sesiones y recordatorios usa esa zona. Los formularios de agenda convierten desde la zona del gimnasio, no desde la de la computadora. Congelar conserva milisegundos restantes y reactivar calcula la nueva fecha. Días de planes equivalen a bloques de 24 horas en esta versión; antes de admitir regiones con horario estacional, decidir si el contrato comercial usa días de calendario.

## Seguridad de la PWA

Autenticación con cookies de Better Auth y comprobaciones de origen en mutaciones. Las API responden Cache-Control private, no-store. El service worker no guarda respuestas autenticadas: solo pantalla offline e icono. No se procesan ventas offline.

El QR contiene un UUID aleatorio, no nombre/teléfono/correo. La página de credencial recibe el token en el fragmento del enlace y dibuja el QR sin consultar datos personales. El QR identifica; el permiso de entrada se comprueba en el servidor. Un QR compartido puede reutilizarse: añadir foto y rotación del token antes del piloto comercial.

## Despliegue

No se ha publicado ni creado ningún servicio externo. El proyecto funciona localmente. Producción requiere HTTPS, PostgreSQL con respaldos, secretos, correo verificado, tarea programada, almacenamiento de logos y monitoreo. El Dockerfile empaqueta Next.js standalone; la migración es un paso de despliegue separado.

El servidor local escucha 127.0.0.1; un celular externo necesita un entorno HTTPS accesible y el origen correcto en BETTER_AUTH_URL. No basta con compartir un enlace localhost.
