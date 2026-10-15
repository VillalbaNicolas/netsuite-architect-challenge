# Caso 3 · Proceso P2P regional (AR / CO / MX) → O2C

Es un solo proceso con variantes por país. Cada carril es un área: las internas y las externas (proveedor, forwarder y agente aduanal). Lo marcado como **[país]** cambia según la subsidiaria. Los hexágonos rojos **C1 a C8** son los puntos de control, descriptos en la tabla debajo del diagrama.

```mermaid
flowchart TB
    classDef ctrl fill:#fde8e8,stroke:#c0392b,color:#7b241c
    classDef ns fill:#eaf2fb,stroke:#1d4e89,color:#1d4e89
    classDef ext fill:#f4f4f4,stroke:#888,color:#333,stroke-dasharray:4 3

    subgraph L1["Compras"]
        A1["Necesidad de compra<br/>(reorden / plan)<br/>NS: Purchase Requisition"]:::ns
        A2["Orden de compra<br/>proveedor + incoterm + ítems<br/>NS: Purchase Order"]:::ns
        C1{{"C1 · PO de importación:<br/>proveedor habilitado,<br/>ítem regulado con<br/>registro sanitario vigente [país]"}}:::ctrl
    end

    subgraph L2["Proveedor (externo)"]
        B1["Confirma la PO.<br/>Factura comercial + packing list<br/>con lote de fabricación y vencimiento"]:::ext
    end

    subgraph L3["Comex"]
        D1["Arma el embarque desde una o varias PO<br/>y carga lote de fabricación / vencimiento esperados<br/>NS: Inbound Shipment"]:::ns
        D2["Carga el identificador aduanero en el embarque<br/>[MX pedimento · AR despacho · CO declaración]"]:::ns
        C2{{"C2 · Embarque recibible solo con<br/>identificador aduanero válido<br/>y landed cost cargado"}}:::ctrl
    end

    subgraph L4["Forwarder / Agente aduanal (externos)"]
        E1["Transporte internacional<br/>y despacho a plaza"]:::ext
        E2["Emite el documento aduanero<br/>y liquida impuestos"]:::ext
    end

    subgraph L10["Cuentas a Pagar"]
        B2["Registra la factura del proveedor<br/>NS: Vendor Bill (3-way match PO / recepción)"]:::ns
        E3["Registra las facturas de flete, agente e impuestos<br/>NS: Vendor Bills asignadas al landed cost"]:::ns
    end

    subgraph L5["Costos"]
        F1["Carga el landed cost estimado<br/>por categoría [país]<br/>NS: Landed Cost en el Inbound Shipment"]:::ns
        F2["Confirma el landed cost real<br/>(facturas de flete, agente, impuestos)<br/>Estado LC: Confirmed"]:::ns
        C6{{"C6 · Sin LC confirmado,<br/>el stock no pasa a Disponible"}}:::ctrl
    end

    subgraph L6["Logística / Depósito"]
        G1["Recepción, por puerto o directa<br/>NS: Item Receipt + Inventory Detail<br/>lote, vencimiento, segmento de aduana por línea<br/>Estado de inventario: CUARENTENA"]:::ns
        C3{{"C3 · Gate de recepción, en todos los contextos:<br/>identificador = segmento en cada línea,<br/>regulados con lote de fabricación + vencimiento,<br/>LC cargado"}}:::ctrl
        T1["Flujo por puerto: recepción en depósito de puerto<br/>+ Transfer Order al depósito final<br/>(lote y segmento viajan con la TO)"]:::ns
        G2["Cambio de estado<br/>Cuarentena → Disponible<br/>NS: Inventory Status Change"]:::ns
    end

    subgraph L7["Calidad / Asuntos regulatorios"]
        H1["Inspección de regulados:<br/>lote, vencimiento, rotulado [país]"]:::ns
        C5{{"C5 · Vida útil remanente mínima<br/>y documentación sanitaria OK"}}:::ctrl
    end

    subgraph L8["Fiscal / Bundle de localización"]
        I1["MX: el bundle registra ítem + depósito + lote<br/>→ pedimento en el maestro de pedimentos"]:::ns
        C4{{"C4 · Conciliación diaria:<br/>recepciones MX sin maestro = alerta"}}:::ctrl
    end

    subgraph L9["Ventas / O2C"]
        J1["Sales Order"]:::ns
        J2["Picking FEFO: asigna el lote que vence primero,<br/>excluye vencidos y cuarentena<br/>(regla custom en etapa 1; nativo con WMS)<br/>NS: Item Fulfillment"]:::ns
        C7{{"C7 · Gate de pedimento MX<br/>(fulfillment y factura):<br/>lote importado con pedimento en el maestro"}}:::ctrl
        J3["Factura → factura electrónica [país]<br/>MX: CFDI con pedimento"]:::ns
        J4["Trazabilidad lote → cliente<br/>reportes por segmento, recall"]:::ns
        C8{{"C8 · Reporte por segmento de aduana<br/>= recepciones (cierre mensual)"}}:::ctrl
    end

    A1 --> A2 --> C1 --> B1 --> D1
    B1 --> B2
    G1 -.-> B2
    D1 --> E1 --> E2 --> D2
    D1 --> F1
    D2 --> C2
    F1 --> C2
    C2 --> G1 --> C3
    C3 --> I1 --> C4
    C3 -.-> T1
    C3 --> H1 --> C5
    E2 --> E3 --> F2 --> C6
    C5 --> C6
    C6 --> G2 --> J1 --> J2 --> C7 --> J3 --> J4 --> C8
```

## Puntos de control

| # | Dónde frena | Qué valida | Tipo |
|---|---|---|---|
| C1 | Aprobación de la PO | Proveedor habilitado. Ítem regulado con registro sanitario vigente en el país de destino. | Preventivo (workflow de aprobación) |
| C2 | Inbound Shipment, al pasar a recibible | Identificador aduanero con el formato del país y landed cost cargado. | Preventivo (UE / workflow) |
| C3 | Item Receipt (`beforeSubmit`, **todos los contextos**, incluido el proceso masivo) | Segmento en cada línea igual al identificador del embarque. Regulados con lote de fabricación y vencimiento. LC cargado con las categorías obligatorias. | Preventivo, bloquea |
| C4 | Conciliación diaria | Toda recepción MX tiene fila en el maestro de pedimentos. | Detectivo, alerta |
| C5 | Inspección de Calidad | Vida útil remanente mínima y documentación sanitaria. | Preventivo (el stock queda en cuarentena) |
| C6 | Cambio de estado a Disponible | Landed cost confirmado. | Preventivo, protege el COGS |
| C7 | Item Fulfillment y Factura MX (`beforeSubmit`) | El lote importado tiene pedimento en el maestro. Es la última barrera antes del CFDI. | Preventivo, bloquea |
| C8 | Cierre mensual | Reporte por segmento = recepciones = landed cost. | Detectivo |

**Relación con el caso 1:** C7 es el gate de pedimento implementado. C3 es el gate del Item Receipt **extendido**. Hoy ese gate valida segmento por línea, LC cargado y además **LC confirmado (R2)**. En este diseño, R2 se pasa a *warn-only* en la recepción y su control pasa a C6 (cuarentena), para no frenar la recepción directa. Validar lote y vencimiento de los regulados y las categorías de LC es la extensión pendiente.
