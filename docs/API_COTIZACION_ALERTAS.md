# APIs para alertas de disponibilidad

Gymia ya calcula ocupacion estimada con entradas y salidas. Para convertir esa senal en alertas externas se necesitan proveedores de envio. Esta nota sirve para cotizar sin comprometer todavia a un proveedor.

## Eventos a enviar

- Gimnasio cerca de su ocupacion comoda.
- Gimnasio nuevamente disponible.
- Recordatorio de vencimiento de membresia.
- Cambio de horario, cierre especial o dia festivo.
- Confirmacion o cancelacion de sesion con entrenador.

## Canales sugeridos

| Canal        | API sugerida                                      | Uso en Gymia                                       | Dato para cotizar                                                                             |
| ------------ | ------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| WhatsApp     | WhatsApp Business Platform o Twilio WhatsApp      | Avisos urgentes y recordatorios con alta lectura   | Costo por mensaje o plantilla, numero de gimnasios, volumen mensual y verificacion de negocio |
| Correo       | Twilio SendGrid Email API, Resend o Postmark      | Recibos, vencimientos y avisos menos urgentes      | Correos mensuales, dominio autenticado, reputacion y plantillas                               |
| Push web     | Web Push con VAPID (ya integrado en Gymia)        | Recordatorios y alertas dentro de la PWA instalada | Sin tarifa por mensaje del proveedor; requiere HTTPS, consentimiento y tarea programada       |
| Programacion | Cron del hosting, GitHub Actions o worker externo | Ejecutar recordatorios y revisar ocupacion         | Frecuencia de ejecucion y limites del hosting                                                 |

## Reglas minimas antes de activar

- Guardar consentimiento por cliente y canal.
- Permitir baja de notificaciones.
- Evitar spam: una alerta por evento y ventana de tiempo.
- Registrar estado de entrega cuando el proveedor lo permita.
- No enviar datos sensibles por mensajes externos; usar textos breves y enlaces a Gymia.

## Fuentes para cotizar

- WhatsApp Business Platform pricing: https://whatsappbusiness.com/products/platform-pricing/
- Twilio WhatsApp pricing Mexico: https://www.twilio.com/es-mx/whatsapp/pricing
- Twilio SendGrid Email API pricing: https://www.twilio.com/en-us/products/email-api/pricing
- Firebase pricing, Cloud Messaging: https://firebase.google.com/pricing

## Referencia de precios consultada el 10 de octubre de 2026

- **WhatsApp directo con Meta:** el costo cambia por país y categoría de mensaje; Meta cobra los mensajes entregados según su tarifa vigente. Servicio y algunas respuestas de utilidad pueden no tener cargo de Meta bajo las condiciones publicadas.
- **WhatsApp por Twilio en México:** la página consultada muestra MXN $0.1056 por mensaje de Twilio, además de la tarifa de plantilla de Meta cuando corresponda. El total depende del tipo de plantilla, de la ventana de atención y del volumen; la página advierte que los precios pueden cambiar.
- **Correo con SendGrid:** la página consultada anuncia prueba de 60 días de hasta 100 correos diarios; Essentials comienza en USD $19.95 al mes y Pro en USD $89.95 al mes. El precio final depende del volumen y funciones.
- **Notificaciones web con Firebase Cloud Messaging:** Firebase marca Cloud Messaging como producto sin costo. Se debe cotizar por separado el trabajo de implementación y cualquier infraestructura de programación o almacenamiento que use Gymia.
- **Web Push con VAPID:** Gymia ya puede enviar push directo a navegadores suscritos, sin contratar Firebase. El costo directo por envío es cero; se necesita programar diariamente la tarea en el hosting y que el cliente autorice este dispositivo.

Estos importes son una referencia para comparar, no una cotización contractual. Conviene verificar el precio en las páginas del proveedor antes de contratar.
