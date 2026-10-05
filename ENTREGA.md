# Entrega

Hacé un fork o clon de este repo, trabajá en tu copia y mandanos el link (o un zip si preferís no publicarlo).

## Estructura esperada

```
entrega/
├── USO-DE-IA.md                 qué herramientas usaste y para qué
├── TIEMPO.md                    horas dedicadas a cada caso y qué te resultó confuso
├── caso-1/
│   └── nota.md                  máx. 1 página
├── caso-2/
│   ├── diagnostico.md           causas, cuantificación, evidencia
│   ├── plan.md                  inmediato vs estructural, quién hace qué
│   └── respuestas-stakeholders.md
└── caso-3/
    ├── diagrama.(png|svg|pdf|md)
    ├── matriz-datos.md          a partir de caso-3-p2p-regional/plantilla-datos.md
    └── decisiones.md            máx. media página
```

- Los cambios de código del caso 1 van directamente en `caso-1-inbound-mx/src` y `caso-1-inbound-mx/__tests__`. `npm test` tiene que pasar.
- Queries, scripts o notebooks de análisis: en `entrega/caso-N/analisis/`.
- Escribí en español. Código y nombres técnicos en inglés.
- En `TIEMPO.md`, sé honesto/a con las horas: nos sirve para ajustar el challenge, no se evalúa. Si algo de la consigna o de los datos te resultó confuso, contanos qué.
