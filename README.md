# Challenge técnico · Arquitecto/a NetSuite · Andina Retail

Gracias por tomarte el tiempo. Este challenge usa problemas reales de una operación multipaís sobre NetSuite, reescritos sobre una **empresa ficticia (Andina Retail)** y **datos sintéticos**. Ningún dato corresponde a personas o empresas reales.

No hay una única respuesta correcta. Nos interesa saber cómo pensás: qué mirás primero, qué supuestos hacés, qué preguntarías y cómo explicás tus decisiones.

## Los casos

| Caso | Tema | Tiempo sugerido | Qué entregás |
|---|---|---|---|
| [1 · Inbound MX](caso-1-inbound-mx/enunciado.md) | P2P, recepción, landed cost, fiscal MX | ~3–4 h | Cambios de código con tests + nota de 1 página |
| [2 · Marketplace](caso-2-marketplace-backorder/enunciado.md) | O2C, OMS, inventario, integración | ~3–4 h | Diagnóstico, plan y respuesta a stakeholders |
| [3 · P2P regional](caso-3-p2p-regional/enunciado.md) | Diseño de proceso AR/CO/MX | ~2 h | Diagrama + matriz de datos + decisiones |

**Total: 8–10 h.** Tenés **10 días corridos** desde que recibís el link. No hace falta usar todo el tiempo: si algo te lleva más, dejá escrito qué harías y seguí.

## Antes de empezar

- Leé `contexto/empresa.md` y `contexto/glosario.md` (5 minutos).
- Caso 1: necesitás Node 18 o superior.
  ```bash
  cd caso-1-inbound-mx
  npm ci
  npm test
  ```
- Los datos están en CSV (UTF-8, separados por coma, decimal con punto, fechas ISO). Usá la herramienta que quieras: SQL, Python, Excel, lo que te resulte cómodo. Si escribís queries o notebooks, incluilos en la entrega.
- Si usás Excel con configuración regional en español, no abras el CSV con doble clic: usá *Datos → Desde texto/CSV*, con delimitador coma y punto como separador decimal.

## Reglas

- **Uso de IA:** permitido. Contanos en `entrega/USO-DE-IA.md` qué usaste y para qué. En la conversación posterior vamos a profundizar sobre lo que entregues.
- **Supuestos:** si algo no está claro, decidí, dejalo escrito y seguí.
- **Consultas:** podés escribirle a la persona que te mandó el link. Las preguntas que hagas también nos dicen algo.

## Cómo entregar

Ver [ENTREGA.md](ENTREGA.md).
