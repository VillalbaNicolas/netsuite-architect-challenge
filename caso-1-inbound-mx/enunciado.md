# Caso 1 · La recepción que no frena

## Situación

Andina MX importa mercadería por contenedor. Desde julio, Logística empezó a recibir **parte** de los embarques **directo en el depósito final**, sin pasar por el depósito de puerto, para ganar días. El resto sigue el flujo anterior.

Para que no entre mercadería sin costo completo ni sin datos aduaneros, el equipo de NetSuite construyó dos controles:

- En el **Inbound Shipment**, el botón *Receive* se deshabilita si el embarque no está listo.
- En el **Item Receipt**, un User Event bloquea la recepción si el embarque no tiene landed cost confirmado o datos de aduana.

Aun así, en el cierre de septiembre:

- **Fiscal** detectó CFDI timbrados **sin número de pedimento**.
- **Costos** encontró inventario que entró **sin el costo completo** de importación.
- **Contabilidad** no logra cuadrar el reporte por segmento de aduana contra lo recibido.

Logística jura que "el sistema no los frenó".

## Qué te damos

- `src/`: el proyecto SDF con los dos scripts y sus objetos.
- `__tests__/`: tests que hoy pasan (`npm ci && npm test`).
- `data/`: tres meses (jul–sep 2026) de datos de Andina MX:

| Archivo | Columnas |
|---|---|
| `inbound_shipments.csv` | `shipment_id`, `shipment_number`, `po_number`, `vendor_id`, `created_date`, `customs_cleared_date`, `customs_number` (pedimento), `lc_status` (Pending/Loaded/Confirmed), `lc_confirmed_date`, `status` |
| `landed_costs.csv` | `shipment_id`, `cost_category`, `amount`, `currency`, `loaded_date` |
| `item_receipts.csv` | `receipt_id`, `receipt_number`, `shipment_id`, `received_date`, `location` (depósito final donde quedó la mercadería), `source` (desde dónde se recibió: la página *Receive* del embarque o el proceso masivo *Receive Inbound Shipment*), `receiving_flow` (port_transfer = vino por el depósito de puerto; direct = directo al depósito final), `customs_segment` (cabecera) |
| `receipt_lines.csv` | `receipt_id`, `line`, `item_id`, `qty`, `lot`, `customs_segment` (línea), `bin`, `regulated`, `mfg_lot`, `expiry_date` |
| `pedimento_master.csv` | `item_id`, `location`, `lot`, `pedimento`, `qty_received`, `source_receipt_id` |
| `invoices_mx.csv` | `invoice_id`, `invoice_date`, `customer_id`, `item_id`, `lot`, `qty`, `cfdi_uuid`, `numero_pedimento` |

## Qué esperamos

1. **Encontrá por qué pasó**, con evidencia de los datos y del código. Puede haber más de una causa.
2. **Corregí lo que corresponda en el código**, con tests que demuestren el problema y la corrección.
3. **Una nota de máximo 1 página** (`entrega/caso-1/nota.md`) con:
   - qué encontraste y cuánto impacta;
   - qué cambiaste y qué **no** se puede resolver con código en este repo;
   - qué probarías en sandbox antes de pasar a producción;
   - qué le preguntarías al proveedor del bundle de localización MX.

Tiempo sugerido: ~3–4 h.
