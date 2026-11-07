# Entrega al equipo · Gymia 0.1

Fecha: 18 de septiembre de 2026. Nombre provisional: Gymia.

## Punto de partida

Repositorio local preparado, con migraciones, datos ficticios, aplicación conectada a PostgreSQL y documentación. No se creó repositorio remoto ni se desplegó en la nube. El servicio se abre en http://localhost:3000 mientras sus procesos estén activos.

El flujo más corto para probar: entrar como dueño, abrir Caja y turnos, abrir turno con fondo, vender producto, cancelar devolviendo al stock y comprobar las existencias. Después registrar entrada de un cliente desde Accesos; generar su QR desde Clientes. Probar cliente/entrenadora en una sesión de navegador separada.

No se debe cambiar la contraseña de otro desarrollador: cada equipo genera su `.env` y sus cuentas demo. Para entregar usar el ZIP de código sin dependencias ni secretos.

## Validación local

- Compilación Next.js de producción y TypeScript.
- 16 pruebas de reglas/integración: permisos, aislamiento, caja, inventario, mermas, congelación, accesos, asesoría y asistencia.
- 3 pruebas de navegador: navegación del dueño, QR/vista móvil de cliente, sesión anónima y origen externo bloqueados.
- Revisión visual de escritorio (1440 px) y móvil (390 px).
- `npm audit`: sin vulnerabilidades conocidas al preparar la entrega; dos overrides transitorios documentados en package.json para dependencias de Prisma. Volver a revisar al actualizar.

Limitaciones de validación: no se probó la cámara física de esta Mac/celular, instalación real en iOS/Android, entrega de mensajes externos, despliegue Docker ni CI remoto. Pruebas de navegador en Chromium local.

## P0 · Antes de un piloto con datos reales

1. **Identidad:** verificación de correo, recuperación de contraseña y flujo de invitación/verificación antes de vincular clientes/empleados. Hoy se vinculan por correo existente tras comprobación humana; no usar como identidad verificada automáticamente.
2. **Operación en nube:** PostgreSQL administrado, secretos reales, dominio HTTPS, respaldos/restauración y monitoreo. Configurar límites de tamaño de solicitud en proxy/hosting además del límite de aplicación. Revisar roles de DB y aislamiento reforzado.
3. **Pagos pendientes:** la regla de bloqueo existe; falta interfaz para crear adeudos y liquidarlos. Las ventas actuales se consideran pagadas y no hay pagos parciales.
4. **Integridad y concurrencia:** ampliar cobertura para dos operadores concurrentes, turnos que cruzan días, cambios de zona y cambio de entrenador con citas futuras. El bloqueo de asesores debe invalidar/reasignar citas.
5. **Fin de membresía:** al congelar/cancelar, avisar y gestionar reservas futuras; hoy completar una sesión exige vigencia pero una cita previa puede seguir ocupando agenda.
6. **Accesos:** probar cámaras reales y permisos en Safari/Chrome, foto de credencial y regeneración/revocación de QR. Hoy el QR es estático y compartible.
7. **Privacidad y operación:** acordar retención de datos, exportación/baja y consentimiento de comunicaciones; acceso de soporte de plataforma auditado.

## P1 · Completar el producto acordado

- Proveedor de correo y WhatsApp Business, y gestión de consentimiento/preferencias para esos canales. Web push ya tiene opt-in, almacenamiento de suscripción y entrega VAPID.
- Programar `jobs:reminders` diariamente en el hosting para materializar recordatorios y entregar push; la app no ejecuta un scheduler residente.
- Avisos de apertura/cierre/cambios extraordinarios. Modelo inicial de horarios de un intervalo; ampliar horarios partidos y nocturnos.
- Predicción de horas concurridas: hay gráfico descriptivo e historial, no pronóstico ni inteligencia artificial. Medir calidad de salidas antes de pronosticar.
- Disponibilidad de entrenadores, duración/configuración de sesiones y preferencia de género del entrenador. Hoy hay selección manual consentida, no asignación automática.
- Correcciones auditadas de asistencia por dueño. Horarios laborales para determinar retardos/faltas.
- Carrito de varios productos, devolución parcial, descuentos autorizados y costos/gastos para utilidades.
- Cierre/traspaso de caja entre personas con confirmación. Los fondos se introducen manualmente.
- Fotos de clientes/productos y galerías con almacenamiento de objetos. Los logos ya admiten subida optimizada y privada, limitada a un archivo de 256 KB por gimnasio; ver DEPLOYMENT_HOSTINGER.md.
- Personalización de portada/plantillas e icono/nombre PWA por gimnasio. Hoy la PWA tiene identidad global Gymia; el interior sí usa la marca del gimnasio.
- Paginar clientes/historiales, búsqueda en servidor, exportación de reportes y estadísticas históricas por sucursal.
- Permisos granulares y edición de roles; hoy rol único por organización y dueño inicial único.

## P2 · SaaS y escala

- Panel de administrador global. Tarifas, cuotas y flujo de suscripción mensual de Mercado Pago están implementados en código; el plan se activa tras confirmar el pago por webhook o en el retorno. Sandbox comprobado localmente. Falta activar credenciales productivas, guardarlas en Vercel y verificar webhooks productivos antes de abrir cobros reales.
- Subdominios/dominios por gimnasio; hoy selector de organización después de iniciar sesión.
- Políticas RLS o integridad compuesta reforzada, carga y observabilidad.
- Aplicación Expo solo si se decide distribuir en tiendas.

## Distribución sugerida de tareas

Tomar módulos según CONTRIBUTING.md; acordar primero contratos del modelo y API. La separación de servidor está hecha por área. `dashboard.tsx` concentra inicialmente la composición de pantallas para iterar rápido; el próximo trabajo de frontend es dividirlas en componentes por módulo manteniendo los contratos de `workspace-types.ts`.

## Preparación para Hostinger · 22 de septiembre de 2026

Registro de nuevos gimnasios visible desde login. Subida de logos con validación, WebP de alta calidad y reemplazo atómico. PostgreSQL con pool de cinco conexiones y alta de organización serializable. Ver DEPLOYMENT_HOSTINGER.md; el despliegue externo debe confirmarse por separado, no se da por realizado por estas modificaciones.

Validación de la preparación: 18 pruebas de reglas/integración y 4 pruebas de navegador aprobadas (incluyendo alta de nuevo dueño, creación de gimnasio y logo aislado). Compilación de producción y TypeScript aprobados. Las pruebas se ejecutaron contra PostgreSQL local. El ZIP Gymia_Hostinger.zip contiene solo código y documentación, sin contraseñas, datos ni dependencias.
