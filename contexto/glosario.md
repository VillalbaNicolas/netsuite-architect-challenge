# Glosario

- **Inbound Shipment (INBSHIP):** registro nativo de NetSuite que agrupa lo que viene en un embarque desde una o varias órdenes de compra. Desde ahí se recibe la mercadería y se cargan los landed costs.
- **Landed cost:** costos de importación (flete, seguro, agente aduanal, impuestos de importación) que se suman al costo del inventario. En Andina, el embarque tiene un estado propio: *Pending → Loaded → Confirmed*.
- **Pedimento:** documento aduanero mexicano. Su número (15 dígitos) tiene que figurar en el CFDI de la venta de mercadería importada.
- **Segmento de aduana (`cseg_acme_customs`):** custom segment con el número de despacho o pedimento. Se usa para trazabilidad y reportes contables.
- **Maestro de pedimentos:** registro custom del bundle de localización MX que vincula ítem + depósito + lote con un pedimento. Al timbrar el CFDI, el bundle busca ahí el número de pedimento.
- **Lote:** en MX, el lote de inventario de la mercadería importada es el número de pedimento. Los dispositivos médicos además llevan lote de fabricación y fecha de vencimiento.
- **Recepción directa:** recibir el embarque en el depósito final, sin pasar por un depósito de puerto ni por una transferencia intermedia.
- **Receive Inbound Shipment:** proceso nativo para recibir uno o varios embarques en lote. Muestra el resultado por línea.
- **Backorder:** cantidad de una línea de orden de venta que no está comprometida ni despachada.
- **Comprometer (commit):** reservar inventario disponible para una línea de orden de venta.
