# API de la primera versión

Todas las respuestas de negocio son JSON sin caché. Las fechas son ISO, importes enteros en centavos y `remainingMs` se serializa como string. El cliente nunca envía rol o userId para autorizarse.

## GET /api/workspace?tenant=ID&day=YYYY-MM-DD

Requiere sesión. `tenant` es opcional y solo permite organizaciones autorizadas; `day` selecciona el reporte. Devuelve contexto, configuración, sucursales y proyecciones filtradas por rol. Ventas: últimas 200; agenda: últimas 200; accesos: hasta 1000. Paginación explícita pendiente.

## POST /api/operations

Headers: Content-Type application/json, Origin igual a BETTER_AUTH_URL, cookie de sesión, x-tenant-id opcional. Cuerpo:

```json
{
  "action": "sale.create",
  "input": {
    "kind": "PRODUCT",
    "itemId": "...",
    "quantity": 1,
    "method": "CASH",
    "idempotencyKey": "UUID"
  }
}
```

| Prefijo     | Comandos                                |
| ----------- | --------------------------------------- |
| product     | save                                    |
| plan        | save                                    |
| shift       | open, close, withdraw                   |
| sale        | create, cancel                          |
| member      | save, link, assign                      |
| membership  | request, freeze, resume, cancel, reject |
| visit       | enter, exit, closeStale                 |
| staff       | clock, add, toggle                      |
| appointment | create, complete, cancel, rate          |
| tenant      | save                                    |
| branch      | create                                  |
| schedule    | save                                    |
| exception   | save                                    |

Los contratos exactos están definidos con Zod en cada servicio de `src/server/`. La API de comandos es intencionalmente pequeña para el primer módulo funcional; antes de clientes externos, versionar `/api/v1` y generar OpenAPI.

Estados: 400 validación/regla de negocio; 401 sesión ausente; 403 permiso/origen; 404 objeto no encontrado dentro del gimnasio; 409 conflicto o duplicado; 500 error no expuesto al cliente.

## POST /api/onboarding

Cuenta autenticada, sin requerir gimnasio previo. Cuerpo `{name,slug}`. Crea organización, sede principal, horario inicial y acceso OWNER. Máximo cinco organizaciones por cuenta como salvaguarda inicial; facturación y cuotas SaaS pendientes.

## /api/auth/*

Gestionado por Better Auth. El cliente web utiliza `authClient`. No implementar un segundo sistema de contraseñas o tokens.
