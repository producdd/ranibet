# Checklist De Implementación

## 1. Aplicar SQL en Supabase
Abre el SQL Editor de Supabase y ejecuta el contenido actualizado de:

- `supabase_schema.sql`

Esto crea y actualiza:

- `weekly_rank_results`
- `system_event_logs`
- índices extra
- función `close_weekly_ranking_secure()`

## 2. Configurar variables en Vercel
En tu proyecto de Vercel agrega estas variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

### Valor de `SUPABASE_SERVICE_ROLE_KEY`
Usa la clave `service_role` de tu proyecto Supabase.

### Valor de `CRON_SECRET`
Pon un secreto largo, por ejemplo:

`ranibet-close-weekly-2026-super-secret`

## 3. Verificar cron en Vercel
Ya quedó configurado en:

- `vercel.json`

Ruta:

- `/api/cron/close-weekly`

Horario:

- lunes `00:10` hora Perú aproximadamente

## 4. Desplegar
Después de aplicar SQL y variables:

```bash
vercel --prod
```

## 5. Probar manualmente
### Probar ranking
Abre la app y revisa:

- semanal
- mensual
- histórico
- ganador del mes
- top movers

### Probar cierre semanal manual
Con tu sesión iniciada, abre la consola del navegador y ejecuta:

```js
await window.RaniDebug.closeWeeklyRanking()
```

Si responde bien, el cierre automático debería funcionar cuando corra el cron.

## 6. Si algo falla
### Logs cliente
En consola:

```js
window.RaniDebug.getLogs()
```

### Limpiar logs

```js
window.RaniDebug.clearLogs()
```

## 7. Archivos clave
- `supabase_schema.sql`
- `vercel.json`
- `api/cron/close-weekly.js`
- `api/ranking.js`
- `api/winners.js`
- `js/engine.js`
