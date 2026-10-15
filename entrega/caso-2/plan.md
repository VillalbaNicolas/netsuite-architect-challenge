# Caso 2 · Plan

**Supuesto de fechas:** el corte es el 30/09. El cierre de septiembre se hace en los primeros días hábiles de octubre ("día 1" para Cuentas a Cobrar). "Esta semana" es la primera semana de octubre, antes del evento comercial.

**Restricciones:**
- No forzar stock ni despachar sin stock en NetSuite.
- No frenar las transferencias ni cambiar cómo Logística arma los envíos.
- **Destrabar sin depender del partner**, que está ocupado hasta fin de mes. A él se le pide un fix en paralelo.
- Cuidar los processors, que son fijos y los comparte la integración. Todo lo masivo corre **en lotes entre las 03 y las 09 h**: es la franja con menos órdenes (1.285 en total) y menos errores en el log (54 de 1.325).

## Esta semana: destrabar lo que ya está trabado

| Paso | Qué | Destraba | Quién | Cómo y por qué así |
|---|---|---|---|---|
| 1 | **Cerrar las 280 SO duplicadas abiertas** (queda la original) | Evita facturar dos veces 451 u. | NetSuite | CSV import de cierre de línea a partir de `analisis/duplicadas.csv`. No comprometen stock, así que cerrarlas no libera nada de más. Va **antes** de cualquier despacho masivo. |
| 2 | **Frenar nuevas duplicadas desde NetSuite:** un UE `beforeSubmit` en la creación de la SO copia el `mp_order_id` al `externalId`, porque NetSuite rechaza un externalId repetido de forma nativa (a validar en sandbox con dos altas simultáneas). Como respaldo, el mismo UE busca si ya existe una SO con ese `mp_order_id` | Corta la duplicación sin esperar al partner | NetSuite | La búsqueda en el UE sola tiene una condición de carrera: el reintento llega a los 2 min y la primera SO puede no estar visible todavía. La unicidad del externalId no tiene ese problema. El iPaaS va a recibir un error de "duplicado", que es la señal correcta. |
| 3 | **Recibir las 13 TO parciales** contra el reporte de ingresos del marketplace | 238 | Logística | Trabajo de escritorio: no cambia los envíos ni frena nada. Las 61 u. sin cobertura **no se ajustan a ciegas**: van a conciliación con el marketplace. |
| 4 | **Recomprometer** con la página nativa *Commit Orders*, filtrada por `AR-MKP-FC` y los ítems afectados | 495, y las 238 después del paso 3 | NetSuite | Proceso nativo, sin desarrollo. Ordena por fecha o prioridad de la SO: antes, cargar la *order priority* según la fecha de entrega para que lo entregado primero se comprometa primero. En paralelo, revisar por qué no se comprometió solo al recibir (causa 3 del diagnóstico). |
| 5 | **Datos maestros:** mapear los 12 SKUs y reprocesar las 160 órdenes desde el panel de errores del iPaaS. Corregir el mapeo de los 6 ítems con dos SKUs y **cambiar el ítem en la línea** de esas 41 SO (o cerrarlas y recrearlas) | 160 + 41 | Andina (Comercial/Datos), un operador del iPaaS y NetSuite | Reprocesar desde el iPaaS respeta la lógica de alta. Si el dato para reintentar ya venció (hay órdenes del 01/09), plan B: CSV import de SO con `externalId = mp_order_id`. Las 41 ya tienen SO, así que reprocesar no las arregla. |
| 6 | **Despachar y facturar lo destrabado** (~800 órdenes: 495 + 60, después 238 + 41) | ~800 | NetSuite | Map/Reduce *one-off* con concurrencia 1–2, en lotes y empezando por la entrega más antigua. Cada factura dispara el bundle de factura electrónica AR; con baja concurrencia no se satura. La alternativa son las páginas masivas nativas, con menos control y trazabilidad. |
| 7 | **Las 1.567 pendientes de facturar** siguen el circuito normal | 1.567 | Facturación | Monitorear que salgan antes del cierre. |

**Resultado esperado para el cierre:**
- **Seguro:** unas **2.100 facturadas** (1.567 + 495 + 60).
- **Condicional:** 238 si se reciben las TO y 201 si se corrigen los datos maestros esta semana.
- **Pendiente con fecha:** las 61 sin cobertura.
- En el peor caso quedan unas 500 sin facturar al cierre (238 + 201 + 61). Se informan a Contabilidad con cantidad e importe para decidir un devengamiento. No se fuerza stock.

## Para que no vuelva a pasar

| Cambio | Dueño | Trade-off y comentario |
|---|---|---|
| **Alta idempotente:** upsert por `externalId = mp_order_id` y, ante un timeout, consultar si la SO ya existe antes de reintentar | Partner (**en garantía**) | Son horas de configuración. El externalId del paso 2 queda como segunda capa. |
| **Reintentos según el tipo de error:** backoff exponencial con tope para 429 y timeouts. Los errores de datos (`ITEM_NOT_FOUND`) no se reintentan: van a una **cola de errores con alerta** al responsable de datos maestros y se reprocesan cuando se corrige el dato | Partner (evolutivo, se cotiza) | Hasta que esté, un reporte diario de órdenes MP sin SO lo cubre desde NetSuite. |
| **Concurrencia y horarios:** asignar explícitamente la concurrencia de la integración y sacar de la franja 22–01 h los procesos batch que hoy compiten con ella | NetSuite | Sin comprar capacidad. Requiere relevar qué scripts corren a esa hora. |
| **Recepción de TO con SLA de 1 día** y alerta de TO con más de 3 días en *Pending Receipt*. A futuro, recepción automática con el reporte o la API de ingresos del marketplace | Logística + NetSuite | No cambia cómo arman los envíos, solo cuándo se registra. |
| **Compromiso automático después de cada recepción** en `AR-MKP-FC`: corregir la configuración de commit o agregar un proceso programado de bajo costo filtrado por los ítems recibidos | NetSuite | Si se resuelve por configuración, no consume processors. |
| **Alta de SKU:** no publicar en el marketplace sin mapeo en NetSuite. Un ítem no puede tener dos SKUs sin aprobación | Comercial / Datos | Es un cambio de proceso, no de sistema. |
| **Conciliación diaria** (SuiteQL + dashboard): MP vs SO (faltantes y duplicadas), entregadas vs facturadas, stock NetSuite vs stock del marketplace | NetSuite | Detecta en un día lo que hoy se descubre al cierre. |
| **Órdenes que despacha el marketplace:** que la entrega dispare despacho y factura a través de una cola que se reevalúa a diario hasta que haya stock, en lugar de un disparo único | NetSuite + partner | Rediseño con pasaje controlado. Evaluar con Contabilidad y Fiscal si conviene comprometer stock en un depósito que no controlamos. |

## Lo que me falta saber
- ¿Qué dice la especificación de la integración sobre reintentos e idempotencia? Eso define qué entra en garantía.
- ¿Quién dispara hoy el despacho cuando se confirma la entrega: el iPaaS o un script de NetSuite?
- ¿Cómo está configurado el compromiso de stock (preferencia de commit, *Commit* en la línea, *Order Allocation Strategies*)? ¿Por qué las recepciones no comprometieron los backorders?
- ¿El marketplace entrega un reporte o una API de ingresos a su depósito? ¿Con qué frecuencia?
- ¿Cuánto tiempo guarda el iPaaS los datos de las órdenes con error para reprocesarlas?
- ¿Qué procesos corren entre las 22 y las 01 h y cuántos processors usan?
- ¿Fiscalmente se puede facturar con fecha de entrega si el fulfillment se registra después?
