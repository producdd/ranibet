# RANIBET Polling Robusto + Auto-Settlement
Estado: 🚀 En Progreso

## Checklist Técnica (4 cambios críticos)

- ✅ **1. Validación "En Vivo" Robusta**
  - ✅ Ya detecta `live:true` 
  - ✅ `isMatchStillLive()` → filtra FT/PEN/95'+

- ✅ **2. Filtrado 3 Ligas Prioritarias** 
  - ✅ `PRIORITY_LEAGUES = ['liga1','champions','libertadores']`
  - ✅ Solo procesa estas ligas

- ✅ **3. Cleanup MATCHES (Cache Local)**
  - ✅ Elimina partidos terminados
  - ✅ Mantiene live + próximos 48h

- ✅ **4. IDs Persistentes** 
  - ✅ `generatePersistentId(home|away|league)`
  - ✅ Goal detection estable

- ✅ **5. AUTO-SETTLEMENT Apuestas**
  - ✅ `checkPendingBetsOutcomes()` cada 60s
  - ✅ Credita RaniCoins automáticos  
  - ✅ Update Supabase + achievements

## Testing
- [ ] Simular partidos terminados
- [ ] Test bet settlement con datos reales
- [ ] Verificar cleanup no duplica HTML

**Comando para test:** `echo "TODO completo cuando ✓" > /dev/null`

