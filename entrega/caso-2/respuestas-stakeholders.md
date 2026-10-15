# Caso 2 · Respuestas a los stakeholders

## A Cuentas a Cobrar (líder)

> Hola, entiendo la urgencia: está cobrado, no está facturado y se viene el cierre. Te paso lo que encontramos y lo que vamos a hacer.
>
> De las "más de mil", **280 son órdenes duplicadas** que creó la integración. En casi todas, la venta original ya está facturada; en el resto, está despachada y por facturar. Si las forzáramos, **facturaríamos dos veces**. Las cerramos primero.
>
> Para el cierre podemos facturar con seguridad unas **2.100 órdenes**: las 1.567 que ya están despachadas siguen el circuito normal, y destrabamos otras 555 (495 tienen stock y hay que volver a reservarlo; 60 están reservadas y no se despacharon). Además, **238** dependen de que Logística registre transferencias que ya llegaron al marketplace, y **201** de corregir códigos de producto (160 de esas ni siquiera entraron a NetSuite). Estamos trabajando en las dos cosas esta semana.
>
> No vamos a forzar stock ni a despachar a mano lo que NetSuite no tiene. Eso deja el inventario negativo, el costo mal calculado y un problema más grande el mes que viene. En el mejor caso, al cierre quedan unas 60 órdenes para conciliar con el marketplace. Si las transferencias o los códigos no llegan a tiempo, pueden ser hasta 500. Te paso el detalle con cantidad e importe antes del cierre, para que con Contabilidad decidan cómo devengarlo.
>
> Te mando un avance diario hasta el cierre.

## Al Jefe de Logística

> Hola, tenés razón: el stock llegó al marketplace y se vendió. **No te vamos a pedir que frenes ni que cambies cómo arman las transferencias.**
>
> Lo que falla es el registro en NetSuite. 16 transferencias se recibieron en el sistema **12 días después de creadas** (lo normal son 1 a 3 días). Además, hay **13 transferencias recibidas solo en parte, con 703 unidades pendientes de recibir**. Para NetSuite esas unidades siguen "en tránsito", así que no puede despachar ni facturar.
>
> Antes del evento necesitamos:
> 1. Una persona durante medio día para cerrar la recepción de esas 13 transferencias contra el reporte de ingresos del marketplace. Te paso la lista.
> 2. Ayuda para conciliar **61 unidades** que el marketplace vendió por encima de lo transferido (casi todas del ítem 0171). No las vamos a ajustar sin entender la diferencia.
>
> A futuro, proponemos registrar la recepción en NetSuite en el día, con una alerta automática si una transferencia pasa 3 días sin recibirse. En el depósito no cambia nada.

## Al PM del partner

> Hola, gracias por la revisión. Separamos lo que corresponde a cada uno, con el detalle del log adjunto:
>
> - **Lo que nos corresponde:** los 12 SKUs sin mapear (160 órdenes) y 6 mapeos dudosos. Los corregimos esta semana. También vamos a investigar los timeouts de las 22 a la 01 h, que tienen casi el doble de tasa que durante el día y coinciden con procesos nocturnos de nuestra cuenta.
> - **Lo que no es un evolutivo:** en 92 órdenes, cada reintento por timeout creó una SO nueva. Son **315 SO duplicadas**, y una sola orden generó 39. El alta no es idempotente y en los timeouts no hay tope de reintentos. Además, las órdenes con `ITEM_NOT_FOUND` se descartan después de 3 intentos **sin avisar a nadie**; algunas llevan 29 días sin entrar. Ninguna especificación razonable acepta duplicados ni pérdidas silenciosas. Lo tratamos como **defecto en garantía**.
>
> Les pedimos un fix mínimo cuando tengan capacidad, idealmente antes de fin de mes: upsert por `mp_order_id` y tope de reintentos en los timeouts. Entendemos que son pocas horas de configuración. Mientras tanto, desde NetSuite vamos a rechazar las SO con un `mp_order_id` repetido, así que van a empezar a ver ese error en el iPaaS. Para destrabar el cierre no dependemos del fix.
>
> La cola de errores con alertas, el backoff exponencial y la conciliación diaria sí los vemos como evolutivo. Coticémoslo para el mes próximo.
