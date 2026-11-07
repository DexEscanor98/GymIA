# Desplegar Gymia en Vercel

## 1. Preparar GitHub

Sube el código de la carpeta `GymIA` del equipo a la rama `main`. El repositorio contiene código y migraciones, no la base local ni cuentas demo.

## 2. Conectar Vercel

En Vercel, importa el repositorio de GitHub y deja `./` como Root Directory. Vercel detecta Next.js, instala dependencias con npm a partir de `package-lock.json` y usa `npm run build`. El build aplica migraciones pendientes con `prisma migrate deploy`, genera Prisma Client y compila Next.js; no hace falta cambiar el Output Directory.

Selecciona Node.js `24.x` en Project Settings → Build and Deployment → Node.js Version, de acuerdo con `package.json`.

## 3. Configurar PostgreSQL

Gymia requiere PostgreSQL administrado. Con Prisma Postgres, conecta la base al proyecto desde Storage y confirma que Vercel tenga `DATABASE_URL` y `DATABASE_URL_POOLED` en Production. No pongas las URL en Git ni en el navegador.

La aplicación usa `DATABASE_URL_POOLED` para consultas de runtime y Prisma Migrate usa la conexión directa de `DATABASE_URL`. El build de Production aplica únicamente las migraciones pendientes de `prisma/migrations`, de forma segura en despliegues repetidos. Los Preview no migran la base de producción. No ejecutes `npm run db:seed` contra producción.

## 4. Variables de entorno

Configura en Vercel:

- `DATABASE_URL`: conexión PostgreSQL remota con SSL.
- `DATABASE_URL_POOLED`: conexión agrupada para consultas de la aplicación.
- `BETTER_AUTH_URL`: origen HTTPS exacto del dominio que usarás, por ejemplo `https://gymia.vercel.app`, sin `/login` ni otra ruta.
- `BETTER_AUTH_SECRET`: secreto aleatorio de al menos 32 caracteres.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`: necesarias para web push; los avisos internos siguen disponibles sin estas claves.
- `NEXT_PUBLIC_APP_URL`: origen HTTPS final de Gymia, igual que `BETTER_AUTH_URL`.
- `MERCADOPAGO_ACCESS_TOKEN`: Access Token privado de la aplicación de Mercado Pago vinculada a la cuenta vendedora que recibirá los cobros.
- `MERCADOPAGO_WEBHOOK_SECRET`: firma secreta de Webhooks de esa aplicación.

En Mercado Pago configura la URL `https://TU-DOMINIO/api/webhooks/mercadopago` y los eventos de suscripción (`subscription_preapproval` y `subscription_authorized_payment`). La firma se valida antes de consultar la API; la página de retorno también comprueba la suscripción y el primer pago directamente antes de activar el plan. Los medios disponibles dependen de lo que Mercado Pago habilite para la cuenta y el país. En la prueba sandbox revisada se ofrecieron saldo y tarjetas, no transferencia; el flujo de transferencia manual requiere una integración separada. Antes de producción, prueba pagos aprobados, rechazados, pendientes, renovaciones, webhooks y cancelaciones.

La autenticación confía en el origen indicado por `BETTER_AUTH_URL`. Para cada URL de Preview que quieras probar, configura el origen Preview apropiado y vuelve a desplegar esa configuración; no habilites cualquier origen con un comodín.

No subas `.env`, `.env.local`, `.env.production.local`, `.local/`, `node_modules/`, `.next/` ni archivos con credenciales. `.env.example` contiene solo valores ficticios.

## 5. Primeras pruebas

Después del despliegue, valida el registro del dueño, la creación de un gimnasio y de su primera sucursal, el inicio de sesión y los permisos por rol. Crea una base aislada para pruebas: las pruebas de integración y navegador no deben ejecutarse contra producción. No crees usuarios demo ni ventas ficticias en la base real.

Correo y WhatsApp aún no están conectados a proveedores. El cobro recurrente de Gymia usa la API de Suscripciones de Mercado Pago; requiere configurar las credenciales anteriores y validar el flujo en sandbox. Web push requiere las claves VAPID y consentimiento del usuario. Consulta `HANDOFF.md` antes de usar datos reales.
