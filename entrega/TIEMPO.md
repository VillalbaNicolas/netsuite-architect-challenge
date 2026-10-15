# Tiempo

**Total: unas 3 h**, contra las 8–10 h sugeridas. Trabajé con asistencia de IA (ver `USO-DE-IA.md`): mientras la IA ejecutaba (análisis, código, borradores), yo revisaba los resultados y tomaba las decisiones, así que las dos cosas se superponen y no las separo. El reparto por caso es aproximado.

| Caso | Horas (aprox.) |
|---|---|
| Lectura del challenge y contexto | 0,5 h |
| 1 · Inbound MX | 0,75 h |
| 2 · Marketplace | 0,75 h |
| 3 · P2P regional | 0,5 h |
| Cierre (normativa, USO-DE-IA, revisión final) | 0,5 h |
| **Total** | **~3 h** |

## Qué me resultó confuso
- **Plazo:** el mail dice "10 días corridos" pero pone como fecha el 15/10, que son 6 días desde el envío.
- **Caso 1:**
  - En los CSV, `customs_segment` trae el número de pedimento. En NetSuite el segmento guarda el ID interno del valor. Asumí que el nombre del valor es el pedimento y comparé por nombre.
  - No está claro si `lc_status` es un campo custom del embarque o algo nativo. El código lo trata como custom (`custrecord_acme_inb_lc_status`) y lo mantuve así.
  - NetSuite no documenta en qué contexto de ejecución corre el proceso masivo *Receive Inbound Shipment*. El diagnóstico no depende de eso, pero el valor exacto se tiene que medir en sandbox.
- **Caso 2:**
  - `ipaas_log` solo tiene el flujo de alta de órdenes. No hay log del despacho ni de la facturación, así que no se puede saber quién dispara el despacho cuando se confirma la entrega.
  - El inventario es una sola foto al 30/09, sin histórico. Por eso no se puede descartar del todo que en algún momento se haya comprometido stock a órdenes no entregadas.
- **Caso 3:** no está claro cuánto detalle normativo por país se espera. Cité las normas principales y marqué como supuesto lo que no pude confirmar.
