# Caso 1 · La recepción que no frena

## Qué encontré y cuánto impacta
Hay dos causas independientes. Script y salida en `analisis/`.
1. **CFDI sin pedimento:** las 8 recepciones del flujo **directo** no generaron fila en el maestro de pedimentos; en el flujo por puerto hay 0 casos. Resultado: **134 CFDI sin pedimento (2.450 u.)**, en aumento mes a mes. Ningún control de recepción lo habría frenado.
2. **Costo incompleto:** el masivo *Receive Inbound Shipment* se saltea el gate porque su contexto no estaba en la lista del deployment (`CSVIMPORT|RESTWEBSERVICES|SUITELET|USERINTERFACE|WEBSERVICES`). Las 4 recepciones sin landed cost vinieron del masivo; de las 31 por página, ninguna. Son **5.300 u.**: ~164k MXN se cargaron tarde y faltan **~345–394k MXN estimados** en 5009 y 5039 (FX 18, MXN/u promedio del resto). **339 u. se vendieron antes de confirmar el costo.**
3. **Segmento:** solo se validaba la cabecera. Hay 9 líneas sin segmento (2.200 u.), 7 de ellas cargadas por la página con el gate activo.

## Qué cambié (51 tests en verde; 11 fallaban con el código original)
- **Item Receipt gate:** sin lista de contextos; segmento en cada línea recibida igual al pedimento de *su* embarque; todos los embarques del recibo; *fail-closed* ante configuración faltante; al editar solo revalida si cambian vínculos o segmentos.
- **Nuevo gate de pedimento** en Item Fulfillment y en Factura MX: bloquea lotes importados (también el lote compuesto `pedimento-lotefab` y el pedimento con espacios) sin fila en el maestro. Arranca en *warn-only* con los IDs del maestro por parámetro.

## Qué no se resuelve con código en este repo
- La creación del maestro en el flujo directo (bundle) y el backfill de 65 filas.
- La sustitución de los 134 CFDI.
- El landed cost de 5009 y 5039 y el ajuste del COGS de las 339 u.
- Que Costos defina las categorías obligatorias (hoy se exige una fila).
- Permisos sobre el masivo.

## Qué probaría en sandbox
- Loguear `runtime.executionContext` en el masivo, y confirmar que sin `executioncontext` el deployment corre en todos los contextos.
- Recibir por página, masivo, CSV e integración, también con roles no administradores.
- Que existan las tablas y campos usados: `inboundshipmentlandedcost`, `customrecord_cseg_acme_customs`, el `inboundshipment` de línea, `inventorynumber`, y el tipo de los campos del maestro (texto o lista).
- Dónde queda el lote al facturar (fulfillment o factura). Despachar un lote por puerto y uno directo en *warn-only*, revisar los logs y recién entonces activar *enforce*.

## Qué le preguntaría al proveedor del bundle MX
1. ¿Qué evento crea la fila del maestro? ¿Cubre la recepción directa al depósito final?
2. ¿Hay una forma soportada de crear filas desde scripts propios? ¿Qué IDs y tipos tienen el registro y sus campos?
3. Si no encuentra el pedimento al timbrar, ¿puede bloquear en lugar de timbrar sin él?
4. ¿Cómo recomiendan sustituir los CFDI emitidos?
