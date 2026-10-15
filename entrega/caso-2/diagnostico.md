# Caso 2 · Diagnóstico: ventas entregadas que no se facturan

Corte al 30-09-2026. Scripts y salidas en `analisis/`:
- `clasificacion_caso2.py`: una causa por orden → `detalle_por_orden.csv`, y el listado de duplicadas → `duplicadas.csv`.
- `verificacion_caso2.py`: chequeos independientes de cada causa.

## Resumen
- De **24.473 órdenes entregadas**, **2.622 (3.351 u.) siguen sin factura**.
- Lo que Cuentas a Cobrar ve como "más de mil en backorder" son **1.115 SO**: 835 reales y **280 duplicadas** creadas por reintentos del iPaaS. **No hay que facturar las duplicadas**: de las 315 SO duplicadas, 296 son copia de una orden ya facturada y 19 de una orden despachada y pendiente de facturar.
- Hay 6 causas, cada una con un dueño distinto. La más grande: **el stock llega al marketplace, pero NetSuite lo registra tarde o no lo registra**. Explica 733 de las 835 órdenes en backorder.

## Regla de clasificación
- Cada orden entregada se recorre por la cadena *orden MP → iPaaS → SO → mapeo → línea → stock* y queda en la **primera causa que aparece aguas arriba**: integración, después datos maestros, después stock.
- Dentro de cada ítem y depósito, el stock se asigna FIFO por fecha de SO: primero el disponible, después el tránsito, después el faltante. Una orden queda en el grupo que cubre su última unidad (criterio conservador).
- La columna *Código* es la etiqueta de la causa en `detalle_por_orden.csv`.

## Causas

| Código | Causa | Órdenes | Unid. | Evidencia | Dueño |
|---|---|---:|---:|---|---|
| `3_BO_STOCK_DISPONIBLE` | **Stock disponible, pero la SO sigue en backorder** | 495 | 495 | 16 TO se recibieron en NetSuite **12 días después de creadas** (el resto, en 1 a 3). Las 495 SO se crearon antes de esa recepción y al 30/09 siguen en backorder aunque hay disponible en `AR-MKP-FC`. | NetSuite (commit) · Logística (demora) |
| `4_BO_TO_EN_TRANSITO` | **TO en tránsito sin recibir** | 238 | 238 | 13 TO en *Pending Receipt* con recepción parcial. Falta recibir **703 u.**, que es exactamente el `in_transit` del snapshot. 238 de esas 703 u. ya se vendieron y entregaron. | Logística |
| `1_SIN_SO_SKU_SIN_MAPEO` | **SKU sin mapear: nunca se creó la SO** | 160 | 160 | 12 SKUs del marketplace sin fila en `item_mapping`. Cada orden tuvo 3 intentos con `ITEM_NOT_FOUND` (cada 10 min) y después quedó descartada, sin alerta. La más antigua lleva **29 días** sin SO. | Andina (datos maestros) · partner (manejo del error) |
| `5_BO_SIN_COBERTURA` | **Sin cobertura: vendido por encima de lo transferido** | 61 | 61 | No hay disponible ni tránsito que la cubra. 47 u. son del ítem 0171. Es una diferencia entre el stock físico del marketplace y NetSuite. | Logística (conciliación con el marketplace) |
| `2_BO_ITEM_SIN_STOCK_NS` | **Ítem con dos SKUs, sin stock** | 41 | 41 | 6 ítems (0073, 0095, 0197, 0215, 0223, 0256) con dos SKUs cada uno. Al 30/09 no tienen stock en ningún depósito ni ninguna TO, pero el marketplace los entregó. Lo más probable es que uno de los dos SKUs apunte al ítem equivocado. | Andina (datos maestros) |
| `6_COMPROMETIDA_NO_DESPACHADA` | **Comprometida, pero no despachada** | 60 | 60 | Entregadas entre el 02 y el 23/09, con stock comprometido y sin fulfillment. El despacho disparado por la entrega no se ejecutó o no se reintentó. | NetSuite / iPaaS (a confirmar quién lo dispara) |
| `7_PENDIENTE_FACTURAR` | **Despachada, pendiente de facturar** | 1.567 | 2.296 | Entregadas el 29 o 30/09. Es rezago normal de facturación. | Circuito normal |
| — | **SO duplicadas** (aparte) | 92 órdenes | 315 SO | 280 abiertas en backorder (451 u.) y 35 ya cerradas. En **92 de 92** casos, la cantidad de SO coincide con la cantidad de intentos del iPaaS, y todos tienen `TIMEOUT`. El máximo es 39 SO para una sola orden. | Partner (defecto) |

**Sobre la causa `3_BO_STOCK_DISPONIBLE`:** con la configuración estándar, NetSuite compromete el stock a los backorders cuando se recibe. Que eso no haya pasado apunta a la configuración de compromiso de la cuenta: preferencia *Perform Item Commitment After Transaction Entry*, *Commit* del ítem en la línea, u *Order Allocation Strategy*. Hay que revisarlo (ver "Lo que me falta saber" en el plan).

## Hipótesis descartadas
- **SO con depósito equivocado:** 0 casos sobre 26.842. La location siempre coincide con el `fulfillment_type`.
- **Ítems inactivos o inexistentes:** ninguno entre los mapeados.
- **Stock comprometido a órdenes no entregadas:** al 30/09 no hay, en los ítems afectados. Es una sola foto del inventario, así que no se puede descartar que haya pasado antes.

## La integración (`ipaas_log`)
Hay 636 órdenes con incidentes, el 2,4% del volumen.
- **TIMEOUT (216 órdenes):** NetSuite crea la SO, pero la respuesta llega después del timeout del iPaaS. El reintento (a los 2 min) crea otra SO porque el alta **no es idempotente**, y en los timeouts **no se aplica tope de reintentos** (hasta 39). En 92 órdenes eso dejó 315 SO de más. **33% de los timeouts (145 de 439) caen entre las 22 y la 01 h, con una tasa por orden 1,8 veces mayor que entre las 12 y las 15 h**, aunque a esa hora el volumen de órdenes es similar. Eso sugiere que compiten con procesos nocturnos de la cuenta por los processors.
- **RATE_LIMIT (260 órdenes):** "concurrency limit exceeded". Todas se recuperan, sin duplicar, en 2 a 4 intentos fijos cada 1 min, sin backoff. Indica que la concurrencia asignada a la integración no alcanza.
- **ITEM_NOT_FOUND (160 órdenes):** un error de datos, que **no se resuelve reintentando**, se reintenta 3 veces y después la orden se descarta en silencio.

**Conclusión sobre el partner:** tiene razón en que los SKUs los carga Andina y en que hay latencia de NetSuite. Pero **duplicar SO en cada reintento y descartar órdenes sin avisar son defectos de la integración**, no evolutivos.

## Fuera de alcance
- 355 órdenes propias (`own`) pagadas y en backorder: quiebre real de stock en CENTRAL, todavía no entregadas.
- 1.859 órdenes despachadas, todavía sin entregar.

## Supuestos
- `ipaas_log` solo registra el flujo de alta. No hay log de despacho ni de facturación.
- La fecha de creación de la TO equivale a la fecha de envío.
- Las 703 u. en tránsito están físicamente en el marketplace. Hay que confirmarlo con su reporte de ingresos.
- Que el mapeo de los 6 ítems esté mal es una hipótesis a validar con Comercial.
- Datos sintéticos: todas las SO tienen una sola línea.
