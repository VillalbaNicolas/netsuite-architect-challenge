# Decisiones de diseño

**Un proceso con variantes por país, no tres procesos.** La secuencia (PO → embarque → landed cost → recepción → liberación → venta) y los controles son iguales en AR, CO y MX. Lo que cambia es el identificador aduanero, las categorías de costo y lo que exige la factura electrónica, y eso se parametriza por subsidiaria. Tres procesos separados en una sola cuenta OneWorld triplican scripts y controles, y vuelven a divergir: es justamente el problema de hoy.

**Controles en el origen y en la recepción; la factura es la última barrera.** Un dato que falta se corrige barato en el embarque (C2) o al recibir (C3), y caro después del CFDI. El stock entra en **Cuarentena** y pasa a **Disponible** solo con Calidad OK y landed cost confirmado (C5, C6). Así Logística puede recibir directo sin frenarse y el COGS no se recalcula después de vender. El gate de pedimento (C7) queda porque el caso 1 mostró que un hueco del bundle no lo ataja ningún control de recepción. Todo control corre en **todos los contextos**: si solo existe en la interfaz, es una ayuda visual.

**Segunda etapa:** integración con agentes aduanales, recepción automática desde los reportes del marketplace o del 3PL, WMS con FEFO dirigido, portal de recall e integración con los sistemas de trazabilidad de los reguladores. Primero, que el dato exista y viaje con el lote; después, automatizar su carga.
