# 🧠 Mi Ahorro — Backend

API en **Node.js + Fastify + TypeScript** que consulta múltiples cadenas y devuelve **candidatos + ranking** para
comparar precios por ítem y calcular un **total global** por supermercado.

Incluye **Swagger/OpenAPI** para documentar endpoints y generar types para el cliente, y una arquitectura hexagonal para
mantener el core desacoplado de los retailers.

---

## ✅ Qué resuelve

Dada una búsqueda como:

- `coca cola 600ml`
- `salchichas 6 unidades`
- `yerba 1kg`

el backend:

1. Consulta al retailer (Carrefour / DIA / Vea / Jumbo, etc).
2. Arma un pool de **candidatos**.
3. Aplica un **matching + scoring** para quedar con los productos más relevantes.
4. Devuelve resultados por retailer, y en el endpoint de lista calcula:

- **best** (supermercado más barato)
- **ranking** global por total
- **faltantes** por retailer

---

## 🧱 Stack

- **Node.js**
- **Fastify**
- **TypeScript**
- **@fastify/swagger + @fastify/swagger-ui** (OpenAPI)
- **p-limit** (límite de concurrencia)
- **fast-fuzzy** (similaridad para el scoring)

---

## 🧩 Arquitectura (Hexagonal)

Este repo está organizado en capas:

- **Domain** (`src/domain`)
    - Modelos y reglas de negocio puras.
    - `ProductMatchingService`: normalización, extracción de tamaños, filtros y scoring.

- **Application** (`src/application`)
    - Casos de uso y orquestación.
    - `SearchService`: busca en retailers, aplica fallback de términos, junta candidatos, llama al matcher.

- **Infrastructure** (`src/infrastructure`)
    - Adaptadores concretos para cada retailer (VTEX).
    - Wrappers para control de concurrencia y cacheo.

- **Interfaces / HTTP** (`src/routes`)
    - Endpoints Fastify (`/retailers/item`, `/retailers/list`).
    - Schemas JSON para validación + OpenAPI.

---

## 📌 Endpoints

### 1) `POST /retailers/item`

Busca **un** ítem y devuelve resultados según uno o varios retailers.

**Body**

```json
{
  "query": "salchichas",
  "limit": 15,
  "retailers": [
    "carrefour",
    "dia",
    "vea",
    "jumbo"
  ]
}
```

**Response**

```json
{
  "query": "salchichas",
  "limit": 15,
  "retailers": [
    "carrefour",
    "dia"
  ],
  "results": [
    {
      "retailer": "carrefour",
      "products": [
        /* ... */
      ]
    },
    {
      "retailer": "dia",
      "products": [
        /* ... */
      ],
      "error": "RETAILER_FAILED"
    }
  ]
}
```

### 2) `POST /retailers/list`

Busca una **lista** de ítems (carrito textual) y calcula ranking global.

**Body**

```json
{
  "items": [
    "coca cola 600ml",
    "yerba 1kg",
    "arroz 1kg"
  ],
  "limit": 8,
  "retailers": [
    "carrefour",
    "dia",
    "vea"
  ]
}
```

**Response (resumen)**

- `detail`: resultados por ítem y retailer
- `ranking`: total por retailer + faltantes
- `best`: primer elemento del ranking

---

## 🧾 Swagger / OpenAPI

Al levantar el servidor:

- UI: `GET /docs`
- Esquema OpenAPI (JSON): `GET /openapi.json`

Esto permite que el frontend genere types de forma consistente, por ejemplo con:

```bash
openapi-typescript http://localhost:3000/openapi.json -o src/api/openapi.types.ts
```

---

## 🔐 Variables de entorno

En este repo hay un `.env` con valores locales. Variables esperadas:

- `PORT`: puerto del servidor (por defecto 3000 si no está seteado)
- `VTEX_SHA256_HASH`: token/hash usado por algunos retailers VTEX
- `VEA_VTEX_SHA256_HASH`: hash/token específico de Vea

> Estos HASH pueden variar con el tiempo requiriendo su actualización para el correcto funcionamiento de la aplicación.

---

## 🧠 Cómo funciona la búsqueda

### Flujo alto nivel

1. `routes/retailers.ts` valida body con schemas.
2. Llama a `fastify.services.search`.
3. `SearchService.byRetailer()`:

- obtiene `candidates` consultando al retailer (con fallback)
- ejecuta `ProductMatchingService.match(query, candidates, limit)`

4. Responde `products` ya ordenados por relevancia.

---

## 🔁 El “fallback” de búsqueda

Los buscadores VTEX y/o endpoints internos de cada retailer **no siempre responden igual** a un mismo concepto,
dependiendo del formato
del query.

Ejemplos típicos:

- `2 litros` vs `2l` vs `2 l` vs `2,25 lts` vs `2250 ml`
- `6 unidades` vs `6u` vs `x6`
- queries con signos, guiones o marcas (`coca-cola` vs `coca cola`)

Por eso, antes de matchear, el backend genera **variantes del término** para maximizar la chance de obtener candidatos.

Eso se hace en `buildSearchTerms()` (`src/application/search/search.utils.ts`). La idea general es:

- usar el query original
- probar versiones con unidades normalizadas
- probar sin tamaño (“removeSizeToken”)
- probar con la primera palabra (último recurso)

### ¿Cuántas llamadas puede hacer por query?

En `SearchService.fetchCandidatesWithFallback()`:

- se generan varios términos (`buildSearchTerms`)
- se consultan de forma **secuencial** hasta juntar suficientes candidatos o alcanzar límites
- existe un `MAX_TERMS` (3) que corta cuando ya hubo suficientes respuestas “útiles”
- además hay un `MAX_ITEMS` para cortar acumulación

**Peor caso:** si el retailer devuelve vacío para varias variantes, se pueden intentar más términos (porque `used` solo
incrementa cuando la respuesta trae items).

---

## 🛡️ Medidas para mitigarlo

Este proyecto incluye wrappers para que el fallback sea “tolerable”:

### 1) Límite de concurrencia por retailer

`LimitedRetailerAdapter` limita cuántas requests simultáneas puede ejecutar un adapter.

Se configura en `src/plugins/services.ts` (ej. `pLimit(2)` por retailer).

### 2) Cache server-side + dedupe de requests iguales

Para mitigar el costo del *fallback* (y también los “reintentos” del usuario), el backend envuelve cada adapter de
retailer con `CachedRetailerAdapter`.

Qué hace exactamente:

- **Cache en memoria por TTL (hits)**: si ya se consultó el mismo `term` para el mismo retailer hace poco, se devuelve
  el resultado desde memoria sin volver a pegarle al retailer.
- **Negative cache (misses)**: si un `term` devolvió **0 resultados**, se cachea ese vacío por un TTL más corto para no
  insistir inmediatamente con algo que ya sabemos que no trae nada.
- **In‑flight dedupe**: si entran varias requests concurrentes pidiendo exactamente el mismo `(retailer, term)`, se
  ejecuta **una sola** llamada real al retailer y el resto espera el mismo `Promise` (evita “tormentas” cuando un
  usuario dispara varias búsquedas o cuando llega tráfico simultáneo).

Cómo se calcula la clave:

- La clave es efectiva por **retailer + término** (internamente combina `retailerId` y el `term` normalizado). Eso
  significa que el fallback **sigue pudiendo** hacer varias variantes de `term`, pero si esas variantes se repiten entre
  requests (o en listas), el cache corta muchas llamadas.

Configuración actual (ver `src/plugins/services.ts`):

- `ttlMs`: TTL de **hits** (ej: `20000` ms)
- `negTtlMs`: TTL de **misses** (ej: `5000` ms)
- `max`: tamaño máximo del LRU (ej: `800` entradas)

Impacto práctico:

- En `/retailers/list`, si varios ítems repiten términos o si el usuario re‑ejecuta la lista (o cambia el orden/filtrado
  en el front), el backend suele reutilizar cache.
- En picos de concurrencia, el *in‑flight dedupe* evita que una misma búsqueda “explote” en múltiples fetch iguales.

Consideraciones sobre el caché server side:

- Es un cache **en memoria**: no agrega dependencias y mantiene el proyecto fácil de correr.
- No persiste entre reinicios del servidor.
- En caso de desplegar múltiples instancias, cada instancia mantiene su propio cache.
- Aún así, la arquitectura está preparada para evolucionar hacia un cache distribuido

### 3) Limites de carga

En `routes/retailers.ts`:

- `MAX_ITEMS = 60`
- `MAX_COST = 240` (ej: 60 items × 4 retailers)
- si se excede, se corta con error para evitar abuso.

Además, para listas se aplica `pLimit(3)` por ítem (no dispara todo en paralelo sin control).

---

## 🎯 Matching y ranking de resultados

El core de relevancia se implementa en  
`src/domain/services/product-matching.service.ts`.

El backend no devuelve simplemente lo que responde el retailer, sino que aplica
un proceso de normalización y scoring para priorizar los productos más
relevantes para el usuario.

### 🧹 Normalización

La búsqueda se transforma a un formato comparable:

- normalización de texto (minúsculas, sin acentos)
- unificación de unidades (ml, l, kg, etc.)
- extracción de volumen o peso cuando existe
- limpieza del texto para obtener el “core” del producto

Esto permite comparar de forma consistente queries como:

- `2 litros`
- `2l`
- `2,25 lts`

---

### 🔍 Filtrado inteligente

Antes de rankear, el sistema reduce falsos positivos:

- evita combos/pack cuando el usuario no los pidió
- penaliza versiones zero/light si no coinciden con la intención
- requiere coincidencia de tokens cuando la búsqueda es específica

---

### 🧮 Scoring de relevancia

Cada candidato se evalúa combinando:

- similitud textual (fuzzy matching)
- penalizaciones por inconsistencias

Luego los resultados se ordenan priorizando:

1. mayor relevancia
2. mayor cercanía al tamaño buscado
3. menor precio
4. orden alfabético (desempate)

---

### 🎯 Resultado

Este enfoque permite que:

- búsquedas **específicas** sean muy precisas
- búsquedas **genéricas** mantengan buena cobertura
- se reduzcan falsos positivos

---

## ▶️ Correr en local

```bash
npm install
npm run dev
```

Servidor por defecto:

- `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`

---

## 🧪 Probar con PowerShell

Ejemplo `/retailers/list`:

```powershell
$body = @{
  items = @(
    "coca cola 600ml"
    "yerba 1kg"
    "arroz 1kg"
  )
  retailers = @("carrefour","dia","vea")
  limit = 8
} | ConvertTo-Json -Depth 10

$res = Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:3000/retailers/list" `
  -ContentType "application/json" `
  -Body $body

$res | ConvertTo-Json -Depth 20
```

---

## ⚠️ Disclaimer

- Los precios, stock y resultados dependen de cada cadena y pueden variar.
- Mi Ahorro no está afiliado a ninguna cadena de supermercado.
