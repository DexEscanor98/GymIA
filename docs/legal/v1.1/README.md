# Documentos legales Gymia · versión 1.0

Estos textos incorporan la identidad y contacto del proveedor comunicados por Alfredo Vilchis Espinoza. Son borradores funcionales para revisión, no certifican por sí solos cumplimiento legal. Antes de cobros públicos deben coincidir con el inventario real de subencargados, ubicación y retención de datos, obtener revisión jurídica mexicana y actualizarse a una versión aprobada.

## Documentos

- `contrato-gimnasios.md`: contrato de servicio SaaS Gymia–dueño del gimnasio y anexo de tratamiento de datos.
- `contrato-plus-personal.md`: contrato de suscripción del espacio personal Plus.
- `terminos-condiciones.md`: reglas de las cuentas de dueño, personal, clientes y usuarios independientes.
- `aviso-privacidad.md`: aviso integral para los distintos flujos de Gymia.

Los archivos HTML en `public/legal/v1/` se generan desde estos Markdown durante `npm run build`. Cada cambio sustantivo debe crear una nueva versión y mantener intactas las anteriores para que la aceptación histórica siempre tenga un documento disponible.

## Control del checkout

Cada flujo de cobro exige casillas independientes para el contrato, términos, lectura del aviso y consentimiento expreso de cobro mensual recurrente. La API valida las versiones publicadas y registra evidencia vinculada a la persona, gimnasio (cuando corresponda), plan, precio, moneda, periodicidad y referencia del checkout antes de pedir el enlace a Mercado Pago.

La pantalla exige marcar por separado el contrato aplicable, Términos y Condiciones, lectura del Aviso de Privacidad y autorización del cobro mensual recurrente. La API verifica las versiones y registra la aceptación antes de crear o reanudar el checkout con las credenciales de Mercado Pago configuradas. El cron de renovación es un proceso distinto: requiere `CRON_SECRET`; la notificación interna se guarda cinco días antes y el push depende de la suscripción voluntaria del usuario. La interfaz no ofrece una casilla de marketing obligatoria.

Si se modifica cualquier documento, crear nueva URL y nuevo identificador de versión, actualizar `src/lib/legal-versions.ts`, mantener la versión previa y solicitar consentimiento nuevo para los términos materiales y autorización de cobro que correspondan. No sobrescribir documentos aceptados.
