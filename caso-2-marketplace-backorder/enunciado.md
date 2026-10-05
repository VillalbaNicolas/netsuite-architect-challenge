# Caso 2 · Ventas entregadas que nunca se facturan

## Situación

Andina AR vende la mayor parte de su volumen por el **marketplace**. Gran parte de esas ventas se despachan desde el depósito del marketplace (`AR-MKP-FC`), que almacena y entrega por su cuenta.

Las órdenes entran a NetSuite por el **iPaaS** como Sales Orders. Cuando el marketplace confirma la entrega, se despachan y se facturan.

Hace semanas que **Cuentas a Cobrar** ve crecer las órdenes que el marketplace marca como **entregadas** pero que en NetSuite siguen en **backorder**: no se pueden despachar, y por lo tanto tampoco facturar. Se acerca el cierre de mes.

Te llegaron tres mensajes (carpeta `stakeholders/`).

## Qué te damos (`data/`, corte al 30-09-2026)

| Archivo | Columnas |
|---|---|
| `marketplace_orders.csv` | `mp_order_id`, `created_at`, `sku_marketplace`, `qty`, `fulfillment_type` (marketplace = despacha el marketplace, own = despacha Andina), `status`, `delivered_at` |
| `items.csv` | `item_id`, `description`, `is_inactive` |
| `item_mapping.csv` | `sku_marketplace`, `item_id` |
| `sales_orders.csv` | `so_id`, `mp_order_id`, `created_at`, `status`, `location` |
| `so_lines.csv` | `so_id`, `line`, `item_id`, `qty`, `qty_committed`, `qty_fulfilled`, `qty_billed`, `qty_backordered`, `location` |
| `transfer_orders.csv` | `to_id`, `item_id`, `from_location`, `to_location`, `created_date`, `qty_shipped`, `qty_received`, `received_date`, `status` |
| `inventory_snapshot.csv` | `snapshot_date`, `item_id`, `location`, `on_hand`, `committed`, `available`, `in_transit` |
| `ipaas_log.csv` | `ts`, `flow`, `mp_order_id`, `attempt`, `outcome`, `error_code`, `message` |

## Qué esperamos

1. **Diagnóstico** (`entrega/caso-2/diagnostico.md`): ¿por qué hay ventas entregadas en backorder? Separá las causas, **cuantificá** cada una y mostrá la evidencia.
2. **Plan** (`entrega/caso-2/plan.md`):
   - qué hacés **esta semana** con lo que ya está trabado, sin frenar la operación;
   - qué cambiás para que **no vuelva a pasar**;
   - de quién es cada parte (NetSuite, iPaaS, partner, Logística), con los trade-offs y lo que te falta saber.
   Tené en cuenta la escala y que la capacidad de procesamiento de la cuenta es fija.
3. **Respuestas a los stakeholders** (`entrega/caso-2/respuestas-stakeholders.md`): lo que le contestarías a cada uno.

Tiempo sugerido: ~3–4 h.
