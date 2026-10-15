# Uso de IA

Usé IA en todo el challenge: produjo la mayor parte del análisis, el código y los borradores. Mi trabajo fue dirigirla, contrastar lo que proponía contra los datos y tomar las decisiones. Abajo detallo qué hizo, qué decidí yo y cómo lo controlé. El tiempo total fue de unas 3 h (ver `TIEMPO.md`).

## Herramientas
- **Claude Code** (modelo Claude Opus) como asistente principal, en la terminal, trabajando sobre el repo local. Leía archivos, escribía código y documentos, y corría scripts y tests.
- **Subagentes de Claude Code**, lanzados en paralelo para tener segundas opiniones independientes:
  - Dos agentes generales con un rol asignado: uno de **experto NetSuite**, para el análisis de datos del caso 1 y las opciones de diseño del caso 3, y uno de **experto en integraciones iPaaS**, para el análisis del caso 2.
  - **suitescript-reviewer:** code review de los User Events, sobre el código original y sobre el final.
  - **test-orchestrator:** estrategia de tests y ejecución de los tests nuevos contra una copia del proyecto con el código original, para confirmar que fallaban.
  - **Dos revisores escépticos al final:** uno de código y otro de consistencia de los documentos contra los datos. Corregí sus hallazgos antes de entregar.
- **Búsqueda web**, para verificar la normativa por país del caso 3 (SAT, AFIP/ARCA, DIAN, ANMAT, INVIMA).
- **mermaid-cli**, para renderizar `diagrama.png` a partir de `diagrama.md`.

## Qué hizo la IA y qué decidí yo, por caso
| Caso | Qué hizo la IA | Qué decidí y validé yo |
|---|---|---|
| 1 | Leyó el código y los CSV y propuso hipótesis. Escribió `analisis_caso1.py`, los cambios del gate del Item Receipt, el gate nuevo de pedimento (fulfillment y factura MX), sus objetos SDF, los tests y un borrador de la nota. | Qué causas eran reales, contrastándolas con la salida del script. Que el fix tuviera dos frentes: el gate de recepción *y* una barrera antes del CFDI. Que el gate de pedimento se despliegue en *warn-only*, con los IDs del maestro del bundle por parámetro. Qué va en "no se resuelve con código". |
| 2 | Escribió los scripts de clasificación y de verificación cruzada, cuantificó las causas, analizó el `ipaas_log` y redactó borradores del diagnóstico, el plan y las respuestas. | La regla de prioridad entre causas. No forzar stock. El orden del plan: cerrar las duplicadas antes de despachar. Qué le corresponde al partner como garantía y qué es evolutivo. El tono de cada respuesta. |
| 3 | Propuso el diagrama en Mermaid, la matriz de datos y las decisiones, y buscó la normativa por país. | Un proceso único con variantes. Cuarentena en lugar de bloquear la recepción. Lote compuesto en MX. Qué queda para una segunda etapa. Qué normas se citan y cuáles quedan como supuesto. |

## Cómo controlé lo que generó
- **Ningún número entra sin un script que lo reproduzca.** Los números de los subagentes los volví a calcular con los scripts de `analisis/`. Donde hubo diferencias, por ejemplo cuántas líneas sin segmento entraron por la página y cuántas por el masivo, quedó el valor del script. Cada script se corre con `python <script> <carpeta data>` y reproduce exactamente la salida guardada (`salida_*.txt` y los CSV).
- **Tests que primero fallan.** Verifiqué que los tests nuevos fallaran con el código original (11 en rojo en el gate del Item Receipt) antes de dar por buena la corrección. Hoy `npm test` pasa 51 de 51, también con una instalación limpia (`npm ci`).
- **Lo que no se puede verificar localmente** quedó escrito como pendiente de sandbox:
  - el contexto real del proceso masivo;
  - el deployment sin `executioncontext`;
  - la tabla SuiteQL del segmento;
  - los IDs y tipos de campo del maestro del bundle;
  - dónde queda el lote al facturar;
  - el `externalId` único en la SO (caso 2) con dos altas simultáneas.
- **Normativa:** cité lo que encontré en fuentes oficiales o en sus copias. Lo que no pude confirmar, o solo encontré en fuentes secundarias (factura electrónica DIAN, NOM-137-SSA1-2025), está marcado como supuesto.

## Revisión final antes de entregar
Hice una última pasada con la IA, punto por punto contra el README, `ENTREGA.md` y los tres enunciados. Volví a correr los tests y los scripts. Corregí lo siguiente:
- **Diagrama del caso 3:** los Vendor Bills (de proveedor, flete, agente e impuestos) estaban en los carriles externos del proveedor y del forwarder. Los moví a un carril interno de **Cuentas a Pagar**, que es quien los registra, agregué el vínculo con la recepción para el 3-way match y volví a renderizar el PNG.
- **Plan del caso 2, paso 2:** aclaré que es un UE `beforeSubmit` el que copia el `mp_order_id` al `externalId` de la SO, y que eso se valida en sandbox.
- **`TIEMPO.md`:** dejé las horas reales. La revisión fue en paralelo a la ejecución de la IA, así que no las separo.

Revisé y edité todo el texto final. Puedo explicar y defender cada decisión.
