# JM Assistant — evaluación preliminar, fuera de esta feature

**Consulta documental: 2026-11-06.** No se elige proveedor, no se crea una integración,
no se generan claves ni se hacen inferencias. Una futura feature necesita su propio
Specify → Clarify → Plan → Tasks → Implement. No es requisito para instalar la PWA.

| Alternativa | Costo sin contratar planes | Restricciones y encaje preliminar |
|---|---|---|
| Cloudflare Workers AI | Asignación de 10.000 Neurons/día sin cargo en Free. Superarla requiere Workers Paid; precio publicado de exceso: USD 0,011 por 1.000 Neurons en Paid. No se autoriza pasar a Paid. | El consumo depende del modelo y de las entradas/salidas; no equivale a un número fijo de chats. Revisar modelo, licencia, cuotas y consumo del Worker. Por proximidad al entorno actual es el candidato inicial a evaluar, no una integración aprobada. |
| Gemini Developer API, nivel gratuito | USD 0 solo en modelos y cuotas elegibles del nivel gratuito. Tarifas pagas dependen del modelo y se excluyen de la propuesta actual. | Elegibilidad, límites por modelo/proyecto y disponibilidad deben comprobarse en el proyecto antes de elegir. Firebase Spark no concede por sí mismo una cuota universal de IA. Nunca activar facturación, Blaze o Identity Platform para resolver un límite. |
| Orientador con catálogo y FAQ mediante reglas | Sin cargo de inferencia externa; consume los recursos existentes y tiempo de desarrollo. | No es IA generativa. Es una alternativa funcional sencilla para filtros, preguntas frecuentes y enlaces a productos, con respuestas controlables y sin enviar datos a un proveedor. No debe venderse como IA si solo son reglas. |

El precio y asignación de Workers AI proceden de su
[documentación oficial](https://developers.cloudflare.com/workers-ai/platform/pricing/).
Los límites y modelos gratuitos de Gemini deben contrastarse con
[precios](https://ai.google.dev/gemini-api/docs/pricing),
[facturación](https://ai.google.dev/gemini-api/docs/billing/) y
[límites de uso](https://ai.google.dev/gemini-api/docs/rate-limits).
No se promete gratuidad ilimitada ni disponibilidad permanente de un modelo.

## Privacidad y restricciones que condicionan la elección futura

Workers AI declara no entrenar modelos con el contenido del cliente; su política
distingue inferencia estándar de funciones que almacenan datos y contempla excepciones
operativas/legales. No se debe convertir eso en una promesa de ausencia absoluta de
procesamiento o almacenamiento. [Política de datos](https://developers.cloudflare.com/workers-ai/platform/data-usage/).

Los términos de servicios gratuitos de Gemini contemplan usar entradas y respuestas
para mejorar servicios y advierten contra enviar información personal, sensible o
confidencial. Su alcance y excepciones regionales deben revisarse para el proyecto.
Por ello, una evaluación gratuita debe limitarse a productos públicos y preguntas
sintéticas, sin pedidos, direcciones ni perfiles. [Términos oficiales](https://ai.google.dev/gemini-api/terms).

Como límites propuestos para una futura especificación: recomendaciones basadas solo
en catálogo real; precios/stock revalidados; sin ofertas inventadas; ninguna contraseña,
cookie o token en prompts; no acceso administrativo; sin compras o cambios de pedidos
por decisión autónoma del modelo; límites de uso y respuesta honesta al agotar cuota,
sin escalado automático de pago. Son temas para aprobar, no funciones implementadas.

La recomendación preliminar es comparar Workers AI Free con un orientador de reglas,
y mantener Gemini gratuito como alternativa condicionada a privacidad/eligibilidad.
No hace falta crear recursos ni cambiar la PWA para tomar esa futura decisión.
