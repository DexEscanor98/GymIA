# Documentos legales Gymia · versión 1.0

Estos textos son borradores funcionales para revisión, no certifican por sí solos cumplimiento legal. No habilitar cobros hasta completar nombre/capacidad legal, domicilio físico y teléfono del proveedor, inventario real de subencargados y retención de datos; después, obtener revisión de abogado mexicano y actualizar la versión aprobada.

## Documentos

- `contrato-gimnasios.md`: contrato de servicio SaaS Gymia–dueño del gimnasio y anexo de tratamiento de datos.
- `contrato-plus-personal.md`: contrato de suscripción del espacio personal Plus.
- `terminos-condiciones.md`: reglas de las cuentas de dueño, personal, clientes y usuarios independientes.
- `aviso-privacidad.md`: aviso integral para los distintos flujos de Gymia.

Los archivos HTML en `public/legal/v1/` se generan desde estos Markdown durante `npm run build`. Cada cambio sustantivo debe crear una nueva versión y mantener intactas las anteriores para que la aceptación histórica siempre tenga un documento disponible.

## Control del checkout

Cada flujo de cobro exige casillas independientes para el contrato, términos, lectura del aviso y consentimiento expreso de cobro mensual recurrente. La API valida las versiones publicadas y registra evidencia vinculada a la persona, gimnasio (cuando corresponda), plan, precio, moneda, periodicidad y referencia del checkout antes de pedir el enlace a Mercado Pago.

El botón solo se habilita cuando las casillas están marcadas **y** se activa expresamente `GYMIA_LEGAL_DOCUMENTS_APPROVED=true`, `GYMIA_RENEWAL_NOTICE_ENABLED=true`, `GYMIA_LEGAL_PROVIDER_NAME`, `GYMIA_LEGAL_PROVIDER_ADDRESS` y `GYMIA_LEGAL_PROVIDER_PHONE` están completos. El aviso de renovación requiere canal y scheduler reales, comprobados de extremo a extremo; hoy la app todavía no los tiene para suscripciones Gymia. No configurar esos valores hasta que los documentos estén finalizados y los avisos operativos. La interfaz no ofrece una casilla de marketing obligatoria.

Si se modifica cualquier documento, crear nueva URL y nuevo identificador de versión, actualizar `src/lib/legal-versions.ts`, mantener la versión previa y solicitar consentimiento nuevo para los términos materiales y autorización de cobro que correspondan. No sobrescribir documentos aceptados.
