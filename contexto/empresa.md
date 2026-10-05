# Andina Retail

Retailer multicanal que importa y vende productos de consumo y una línea de **dispositivos médicos regulados**. Opera en tres países sobre una única cuenta **NetSuite OneWorld**.

## Estructura

| Subsidiaria | País | Depósitos |
|---|---|---|
| Andina MX | México | `MX-CD-QRO`, `MX-CD-MTY` |
| Andina AR | Argentina | `AR-CD-CENTRAL`, `AR-MKP-FC` |
| Andina CO | Colombia | `CO-CD-BOG` |

`AR-MKP-FC` representa el stock que está físicamente en el depósito del **marketplace**: el marketplace almacena, despacha y entrega. Andina lo abastece con transferencias desde `AR-CD-CENTRAL`.

## Canales

- **Marketplace** (la mayor parte del volumen). Las órdenes entran a NetSuite por un **iPaaS**. La integración la construyó y la mantiene **el partner** implementador.
- E-commerce propio y B2B (en este challenge no aparecen).

## Escala

- Decenas de miles de facturas por mes. La base de clientes es del orden de millones (consumidor final).
- Picos fuertes en eventos comerciales.
- Cuenta de nivel Enterprise con un **número fijo de processors** compartidos entre scripts programados, Map/Reduce e integraciones. Comprar más capacidad no está en el presupuesto de este año.

## Localización

Cada país usa un **bundle de localización** de un tercero para la factura electrónica y los requisitos fiscales (CFDI en MX, factura electrónica en AR y CO). Los bundles no se pueden modificar. Se pueden extender con scripts propios.
