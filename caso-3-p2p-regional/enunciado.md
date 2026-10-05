# Caso 3 · Del proveedor a la factura, en tres países

## Situación

Andina Retail compra local e importa en **Argentina, Colombia y México**. Parte del catálogo son **dispositivos médicos regulados**, que exigen lote de fabricación y fecha de vencimiento.

Hoy cada país trabaja a su manera. El resultado es que lo que se carga en la compra no siempre está disponible en la venta: el picking no respeta el vencimiento, la factura sale sin el dato aduanero que corresponde, o el costo del inventario cambia después de vender.

## Qué te pedimos

Diseñá cómo **debería** ser el proceso **P2P completo**, desde la necesidad de compra hasta el stock disponible para vender, para que estos datos lleguen a **O2C** (picking, factura electrónica y trazabilidad):

- costo total de importación;
- identificador aduanero de la importación;
- lote de fabricación;
- fecha de vencimiento (SKUs regulados).

## Qué entregás

1. **Diagrama de swimlanes** (`entrega/caso-3/diagrama.*`), en BPMN o similar, con la herramienta que quieras. Tiene que mostrar los departamentos (internos y externos), los pasos, las transacciones de NetSuite que se generan y los puntos de control.
2. **Matriz de datos** (`entrega/caso-3/matriz-datos.md`), a partir de `plantilla-datos.md`.
3. **Decisiones de diseño** (`entrega/caso-3/decisiones.md`, máximo media página): ¿un proceso con variantes por país o procesos separados?, ¿dónde ponés los controles?, ¿qué dejarías para una segunda etapa?

No hay datos ni código: es un ejercicio de diseño. Las particularidades de cada país las sabés vos. Si no estás seguro de alguna, dejala marcada como supuesto.

Tiempo sugerido: ~2 h.
