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
- `BREVO_API_KEY`, `BREVO_FROM_EMAIL` y opcionalmente `BREVO_FROM_NAME`: envío transaccional de correo de verificación con Brevo. Usa un remitente aprobado por Brevo; el nivel gratuito limita los envíos diarios. Resend también está soportado con `RESEND_API_KEY` y `RESEND_FROM_EMAIL`.
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `TWILIO_VERIFY_SERVICE_SID`: envío y validación de códigos SMS; se requieren para verificar teléfonos.
- `CRON_SECRET`: secreto aleatorio de al menos 32 caracteres para autenticar la tarea diaria en `/api/cron/subscription-renewals`.
- `MERCADOPAGO_ACCESS_TOKEN`: Access Token privado de la aplicación de Mercado Pago vinculada a la cuenta vendedora que recibirá los cobros.
- `MERCADOPAGO_WEBHOOK_SECRET`: firma secreta de Webhooks de esa aplicación.

### Presentación con pagos de prueba

Para demostrar el checkout en el despliegue público sin cobrar dinero real, configura el Access Token de prueba y el secreto de Webhooks de prueba, además de `GYMIA_DEMO_MODE=true`, `GYMIA_PAYMENT_MODE=sandbox`, `MERCADOPAGO_TEST_SELLER_ID` y `MERCADOPAGO_TEST_PAYER_EMAIL`. El servidor consulta `/users/me` antes del checkout y compara la cuenta del token con el ID de vendedor de prueba configurado. Usa las cuentas de prueba de comprador y vendedor de la misma aplicación. Este modo permite el checkout de demostración sin encender las banderas de aprobación de producción; los documentos y casillas de aceptación siguen mostrándose.

Para cobros reales, Production debe conservar `MERCADOPAGO_ACCESS_TOKEN` y `MERCADOPAGO_WEBHOOK_SECRET` de la cuenta vendedora real, sin `GYMIA_PAYMENT_MODE=sandbox`. La pantalla exige las aceptaciones antes de crear o continuar el checkout y la base conserva la versión aceptada. El entorno Preview puede usar una credencial de prueba aparte. No copies el token de prueba sobre Production.

En Mercado Pago configura la URL `https://TU-DOMINIO/api/webhooks/mercadopago` y los eventos de suscripción (`subscription_preapproval` y `subscription_authorized_payment`). La firma se valida antes de consultar la API; la página de retorno también comprueba la suscripción y el primer pago directamente antes de activar el plan. Los medios disponibles dependen de lo que Mercado Pago habilite para la cuenta y el país. En la prueba sandbox revisada se ofrecieron saldo y tarjetas, no transferencia; el flujo de transferencia manual requiere una integración separada. Antes de producción, prueba pagos aprobados, rechazados, pendientes, renovaciones, webhooks y cancelaciones.

La autenticación confía en el origen indicado por `BETTER_AUTH_URL`. Para cada URL de Preview que quieras probar, configura el origen Preview apropiado y vuelve a desplegar esa configuración; no habilites cualquier origen con un comodín.

No subas `.env`, `.env.local`, `.env.production.local`, `.local/`, `node_modules/`, `.next/` ni archivos con credenciales. `.env.example` contiene solo valores ficticios.

## 5. Primeras pruebas

Después del despliegue, valida el registro del dueño, la creación de un gimnasio y de su primera sucursal, el inicio de sesión y los permisos por rol. Crea una base aislada para pruebas: las pruebas de integración y navegador no deben ejecutarse contra producción. No crees usuarios demo ni ventas ficticias en la base real.

Para continuar en la aplicación basta verificar el correo o el teléfono. El correo usa Brevo o Resend; la opción SMS usa Twilio Verify y requiere sus credenciales. Si Twilio no está configurado, el correo verificado sigue permitiendo entrar y usar la app. La tarea diaria crea el aviso de renovación en la app cinco días antes del siguiente cobro y usa push cuando el usuario lo activa. El checkout de suscripciones usa la API de Mercado Pago y registra la aceptación expresa del contrato, términos, aviso de privacidad y cobro recurrente antes de iniciar el pago.
