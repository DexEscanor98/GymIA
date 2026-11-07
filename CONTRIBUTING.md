# Trabajo en equipo

## Primer día

1. Instalar Node 24 y ejecutar el inicio rápido del README.
2. Leer `docs/BUSINESS_RULES.md` y `docs/HANDOFF.md`.
3. Abrir una rama por tarea: `feat/nombre`, `fix/nombre`, `docs/nombre`.
4. Antes de entregar: `npm run typecheck`, `npm test` y `npm run build`. Si cambia la interfaz o autenticación: `npm run test:e2e` con el servidor encendido.

## Reglas técnicas

- No añadir lógica de autorización solo en botones. Cada operación debe comprobarla en el servidor.
- Ninguna consulta de negocio sin alcance `tenantId` y comprobación de pertenencia del recurso.
- Importes enteros en centavos. Instantes UTC y zona IANA para presentación/agenda.
- Operaciones financieras e inventario en una transacción. Mantener claves de idempotencia y restricciones SQL.
- No borrar ventas para cancelarlas; registrar reversión y auditoría.
- No importar `db` o `auth` del servidor en componentes cliente.
- No subir `.env`, `.local`, secretos ni copias de bases reales.
- Al cambiar Prisma: crear migración en desarrollo, revisar SQL y añadir pruebas de invariantes; en entornos compartidos usar `prisma migrate deploy`, nunca reset.
- No modificar migraciones ya aplicadas. Añadir una nueva.

## División sugerida

| Área                           | Archivos principales             | Primer trabajo                                                    |
| ------------------------------ | -------------------------------- | ----------------------------------------------------------------- |
| Ventas y caja                  | `server/commerce.ts`             | Carrito, pagos pendientes, devoluciones parciales                 |
| Clientes y accesos             | `server/members.ts`              | Foto, rotación QR, historial paginado                             |
| Entrenamiento                  | `server/training.ts`             | Disponibilidad, duración configurable y asignación asistida       |
| Experiencia web/PWA            | `components/`, `app/globals.css` | Dividir Dashboard por pantallas, accesibilidad y PWA por gimnasio |
| Infraestructura/notificaciones | `lib/auth.ts`, `scripts/`        | Verificación de correo, recuperación, proveedores y despliegue    |

Coordinación necesaria en `schema.prisma`, `workspace.ts`, `operations.ts` y contratos compartidos. Evitar que dos personas editen esos archivos simultáneamente sin acordar la interfaz.

La configuración de GitHub Actions está incluida pero no se ha ejecutado en un repositorio remoto; requiere subir el proyecto a uno.
