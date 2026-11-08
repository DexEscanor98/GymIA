# Gymia

Primera base funcional de un SaaS para gimnasios. Aplicación web instalable (PWA), en español, con datos en PostgreSQL y permisos por organización.

**Estado:** versión demostrativa desplegable con PostgreSQL, aceptación de documentos antes del checkout y cobros recurrentes procesados por Mercado Pago. Los pagos se habilitan con las credenciales de producción configuradas; cada comprador debe aceptar el contrato, los términos, el aviso de privacidad y el cobro recurrente antes de salir al checkout. Para continuar en la app basta verificar el correo o el teléfono.

## Inicio rápido en Mac M1/M2/M3 o cualquier entorno Node compatible

Requiere **Node.js 24 LTS** y npm. `.nvmrc` fija la línea compatible. El PostgreSQL de desarrollo descarga un binario para la arquitectura del equipo; no requiere Docker ni Rosetta en Apple Silicon. No modifica los servicios del sistema. Puerto local: 55432.

```bash
npm ci
npm run setup
npm run db:generate
```

En una terminal, mantener la base de datos encendida:

```bash
npm run db:local
```

En otra terminal:

```bash
npm run db:migrate
npm run db:seed
npm run dev
```

Abrir http://localhost:3000. Usa `localhost`, que coincide con el origen de autenticación. `npm run setup` crea secretos aleatorios en `.env` y nunca sobreescribe una configuración existente.

En esta Mac, Node 24 también está disponible en `/opt/homebrew/opt/node@24/bin`. Si el Node global es otra versión:

```bash
export PATH="/opt/homebrew/opt/node@24/bin:$PATH"
```

## Cuentas de demostración

| Correo                 | Rol         |
| ---------------------- | ----------- |
| dueno@gymia.test       | Dueño       |
| recepcion@gymia.test   | Recepción   |
| entrenadora@gymia.test | Entrenadora |
| cliente@gymia.test     | Cliente     |

La contraseña común de **estas cuentas locales** es el valor `SEED_PASSWORD` del `.env` generado en tu equipo. No hay contraseñas públicas en el repositorio. El seed solo acepta una base de datos local y conserva los datos si la demostración ya existe.

Las seis personas, cuatro productos, tres planes y dos sucursales iniciales son ficticios. Sus membresías de demostración no generan ventas ni ingresos ficticios.

## Qué funciona

- Registro e inicio/cierre de sesión con Better Auth. El correo se verifica mediante enlace y el teléfono por código SMS; el acceso a operaciones requiere verificar al menos uno de los dos canales.
- Dueño y recepción pueden registrar clientes por correo; Gymia envía un enlace para verificar el correo y otro para que la persona cree su contraseña privada. El dueño puede invitar empleados con el mismo flujo seguro.
- Cambio entre gimnasios autorizados; permisos comprobados en el servidor.
- Dueño, recepción, entrenador y cliente con vistas y alcance diferentes.
- Clientes, vinculación manual con cuentas existentes y credenciales QR.
- Catálogo de productos sin límite comercial, existencias y movimientos.
- Planes configurables por duración, precio, sucursales y entrenamiento personal.
- Ventas de productos y membresías; efectivo y transferencia con referencia.
- Apertura/cierre de caja, retiros, conteo, diferencias y totales por turnos.
- Cancelación con devolución, reposición o merma; devolución en el turno que la ejecuta.
- Congelación solicitada por el cliente y aprobada por personal; reactivación conserva tiempo exacto.
- Accesos mediante cámara o selección manual, validación de pago/vigencia/sucursal.
- Asistencia laboral separada; entrada y salida del propio empleado.
- Asignación de entrenador confirmada, reserva de 60 minutos o registro sin cita, una sesión por día y evaluación del cliente.
- El cliente consulta horarios base de entrenadores y puede reservar con fechas futuras mientras su membresía siga vigente.
- Horarios por sucursal, festivos y excepciones. Estado abierto/cerrado.
- Personalización de nombre y color; subida privada de logo optimizado, con máximo de 256 KB por gimnasio y reemplazo sin acumular archivos.
- Historial auditable, gráfico descriptivo de entradas y ocupación estimada.
- PWA instalable con pantalla de desconexión; sin operaciones offline.
- Cada persona tiene un ID `PER-` único, cada gimnasio un ID `GYM-` y cada sucursal un ID `SUC-`. La vinculación con gimnasios se registra mediante relaciones por rol, sin cambiar el ID de la persona. El botón «Instalar Gymia» aparece en la aplicación y guía la instalación en navegadores compatibles; iPhone/iPad requiere usar Compartir → Agregar a pantalla de inicio en Safari.
- Avisos internos y notificaciones web push para vencimientos de membresía, tres días antes. La app también registra avisos de renovación de Gymia cinco días antes; web push es opcional y requiere consentimiento. El usuario activa push desde la campana; `npm run setup` crea claves VAPID locales. En iPhone/iPad se requiere instalar la PWA en la pantalla de inicio.
- Ejecuta `npm run jobs:reminders` diariamente desde el programador del hosting para avisos de membresía. Vercel ejecuta el cron de renovaciones de Gymia configurado en `vercel.json`. El correo requiere Resend y la verificación SMS requiere Twilio Verify.
- Cotización de APIs para alertas externas documentada en [APIs para alertas](docs/API_COTIZACION_ALERTAS.md).

## Validación

Con la base de datos en ejecución:

```bash
npm run typecheck
npm test
npm run build
```

Con la aplicación también encendida y las cuentas demo creadas:

```bash
npx playwright install chromium
npm run test:e2e
```

Las pruebas de integración usan organizaciones temporales aisladas y las eliminan al terminar. Nunca ejecutar pruebas contra una base de producción. Para CI ver `.github/workflows/ci.yml`.

## Estructura

```text
src/
  app/                 Rutas Next.js y API HTTP
    api/auth/          Better Auth
    api/onboarding/    Alta de gimnasio
    api/workspace/     Lectura filtrada según rol
    api/operations/    Operaciones autorizadas
    login/, register/  Autenticación
    credencial/        QR compartido, sin datos personales
  components/          Interfaz, formularios, cámara
  lib/                 Base de datos, auth, tipos y reglas puras
  server/              Servicios por área y transacciones
prisma/
  schema.prisma        Modelo de datos
  migrations/          SQL versionado e invariantes
  seed.ts              Demostración local
scripts/               Configuración, PostgreSQL local y recordatorios
tests/                 Reglas, integración y navegador
docs/                  Arquitectura, reglas, API y entrega
public/                PWA, iconos y pantalla offline
```

## Publicación en Hostinger

Ver [Despliegue en Hostinger](docs/DEPLOYMENT_HOSTINGER.md) para la configuración, PostgreSQL externo y límites de imágenes. El botón «Registrar mi gimnasio» lleva al registro de dueño y al alta de su organización.

## Publicación en Vercel

Ver [Despliegue en Vercel](docs/DEPLOYMENT_VERCEL.md) para conectar GitHub, configurar Node.js 24 y PostgreSQL administrado, aplicar las migraciones y definir los orígenes de autenticación.

## PostgreSQL externo / Docker

Si ya tienes PostgreSQL, configura `DATABASE_URL` y omite `db:local`. `compose.yaml` ofrece un PostgreSQL alternativo para los compañeros que usan Docker. No ejecutes ambos en el mismo puerto. Usa un usuario de aplicación de privilegios limitados en producción y otro para migraciones.

## Documentación para el equipo

- [Entrega y pendientes por prioridad](docs/HANDOFF.md)
- [Arquitectura y decisiones](docs/ARCHITECTURE.md)
- [Reglas de negocio](docs/BUSINESS_RULES.md)
- [Contrato de API](docs/API.md)
- [Colaboración y cambios](CONTRIBUTING.md)
- [Documentos legales (borradores)](docs/legal/v1/README.md)

**No compartir** `.env`, `.local/`, `node_modules/` ni datos personales. El paquete de entrega contiene solo código, documentación y migraciones.
