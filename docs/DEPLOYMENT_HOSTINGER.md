# Despliegue de Gymia en Hostinger

## Servicios

- Hostinger Business con aplicación Next.js y Node.js 24.
- PostgreSQL en Supabase, con Data API desactivada. Gymia usa Prisma desde el servidor, no el cliente público de Supabase.
- Dominio temporal de Hostinger para la primera publicación; HTTPS obligatorio.

## Configuración privada

Configurar en Hostinger `DATABASE_URL`, `BETTER_AUTH_URL` y `BETTER_AUTH_SECRET` (al menos 32 caracteres aleatorios). Añadir `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT` para avisos push. Nunca incluir secretos en el ZIP ni en Git. `BETTER_AUTH_URL` debe ser el origen HTTPS exacto del dominio temporal, sin ruta.

Usar una conexión PostgreSQL SSL. Para redes IPv4 puede usarse el pooler en modo sesión (puerto 5432). La aplicación limita su pool a cinco conexiones. Separar el usuario de migraciones del usuario de aplicación cuando se configure el entorno definitivo; no exponer credenciales en el navegador.

## Publicación

1. Crear el proyecto PostgreSQL vacío, sin datos demo. Aplicar las migraciones con `npm run db:migrate` usando la conexión privada de despliegue.
2. Subir el ZIP de código en Añadir sitio web → Desplegar app web. Seleccionar Next.js, Node.js 24 y `npm run build`.
3. Configurar variables de entorno. El comando de inicio es `npm start`; respeta el puerto asignado y escucha en 0.0.0.0. La imagen Docker activa la salida standalone mediante `NEXT_STANDALONE=1`; Hostinger utiliza la salida normal de Next.js.
4. Comprobar HTTPS, registro de cuenta, creación de gimnasio y permisos con organizaciones independientes.
5. El dueño se registra desde «Registrar mi gimnasio». No se publican usuarios ni contraseñas de demostración.

`npm run db:seed` rechaza bases remotas y NO forma parte del despliegue. No ejecutar pruebas de integración o de navegador contra producción.

## Recordatorios y notificaciones web

Crear una tarea programada diaria en Hostinger que ejecute `npm run jobs:reminders` desde la carpeta de la aplicación, con Node 24 y las variables del proyecto cargadas. El script crea un aviso interno tres días antes del vencimiento y envía push a los dispositivos que el cliente haya autorizado. En iPhone/iPad, primero deben añadir la PWA a la pantalla de inicio. Si las claves VAPID no están configuradas, se conserva el aviso dentro de Gymia, pero no se envía push. WhatsApp y correo requieren integración y credenciales propias.

## Logos y espacio

Solo el dueño puede subir, reemplazar o quitar el logo. Se aceptan PNG, JPEG y WebP de hasta 5 MB y 25 millones de píxeles. El servidor verifica el archivo, corrige orientación, elimina metadatos y convierte a WebP calidad 90 con transparencia. Dimensión máxima 1024 × 1024, sin ampliar originales pequeños. El resultado debe pesar como máximo 256 KB; si supera el límite se rechaza y conserva el logo anterior.

Para esta primera versión se guarda un único logo por gimnasio en PostgreSQL (`TenantLogo`), separado de los datos habituales de la organización. Reemplazar actualiza la misma fila y quitar libera ese contenido; no se conserva el original ni versiones adicionales. Una restricción de base refuerza el máximo. Esto acota el contenido vigente a 256 KB por gimnasio, pero no equivale al tamaño total de la base: respaldos, índices, registros y mantenimiento también consumen espacio.

La entrega de imágenes exige sesión y acceso al gimnasio. Las imágenes no son públicas ni se guardan en el caché offline. Para futuras galerías o fotos de productos, utilizar almacenamiento de objetos con cuotas y limpieza de archivos; no ampliar este mecanismo a fotografías ilimitadas.

La optimización preserva calidad visual, no todos los píxeles del original. Revisar especialmente logos con letras muy pequeñas. Los QR se generan aparte y no se comprimen mediante este flujo.

## Operación pendiente

Configurar recuperación/verificación por correo, invitaciones verificadas, copias de seguridad y restauración, monitoreo de cuotas y tarea programada diaria. WhatsApp y correo requieren integración y credenciales propias. Consultar `HANDOFF.md` para límites funcionales pendientes. El primer despliegue es para validación con el equipo antes de datos reales.
