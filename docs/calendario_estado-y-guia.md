# Calendario Familiar de Pared — Estado del proyecto y guía de continuación

> **Actualización de operación (septiembre de 2026):** se ha añadido un instalador
> macOS con supervisor de kiosco, recuperación de foco y actualizaciones por
> versiones. Ver [macos-kiosco.md](macos-kiosco.md) para instalación y validación.
> Instalación y recuperación del foco confirmadas en el Mac mini el 6 de septiembre.
> Se añade doble Q para pausar 30 minutos; su comprobación en el Mac sigue pendiente.
> `dev.sh` queda para desarrollo.

> **Para qué sirve este documento:** handoff autocontenido para continuar la
> implementación desde otro entorno (VS Code + agente de código). Contiene
> contexto, hardware, arquitectura, qué está hecho fichero a fichero, el contrato
> de API entre backend y frontend, los issues abiertos ahora mismo (con
> diagnóstico y fix concreto), el roadmap priorizado y las decisiones técnicas a
> preservar. No hace falta contexto previo.
>
> **Estado:** §5 resuelta y las **tres vistas implementadas** — Vista 1 (dashboard),
> Vista 2 (mes completo), Vista 3 (3 meses: actual + 2 siguientes) — con rotación automática cada minuto
> y control manual por teclas. Lo pendiente es montaje/refinamiento (§6.C botón
> físico, §6.E barras multi-día, §6.F brillo, §6.G backend, §6.H kiosk).

---

## 1. Resumen del proyecto

Familia de 5 personas. Hoy usan un planner físico de pared en una esquina poco
visible del salón, que se desactualiza. **Objetivo:** sustituirlo por una pantalla
siempre encendida en una zona visible, mostrando un dashboard propio (no Google
Calendar embebido) con un layout pensado para uso familiar.

- Los calendarios viven en **iCloud** (iPhones de la familia). Maintainer de facto: **Leyanis**.
- Los eventos hoy llevan prefijo `[NOMBRE]` en el título; se irán quitando porque
  **el color por calendario hace ese trabajo** desde lejos.
- Diseño pensado para leerse a **3-4 metros**: tipografía grande, alto contraste,
  dark mode.

---

## 2. Hardware (definitivo)

Cambió respecto al brief original (que asumía mini PC N100 + Linux + monitor ASUS):

- **Host:** Mac mini **Late 2014** — Core i5 2.6 GHz (doble núcleo), 8 GB RAM,
  HDD mecánico 1 TB a 5400rpm. Corre **macOS Monterey (12)**, que es el máximo
  oficial para este modelo (Ventura ya lo dejó fuera).
- **Monitor:** Xiaomi por HDMI. *Pendiente confirmar:* patrón VESA y que **no sea
  OLED** (contenido estático = riesgo de burn-in en OLED).
- **Recomendación pendiente:** arrancar macOS desde un **SSD USB3 externo**
  (~25-40 €). El HDD de 5400rpm es el punto débil para algo encendido 24/7 y con
  8 GB de RAM (swap al disco lento = tirones). Los Mac Intel arrancan de USB sin
  problema; evita destripar el Mac.
- **Montaje físico:** Mac mini dentro del mueble + HDMI corto por canaleta. El
  "VESA sandwich" del brief original **no aplica** (el Mac mini 2014 no tiene VESA
  y es más grande/pesado que un N100). Monitor en soporte VESA fijo de pared.

**Implicación clave:** el brief original tenía toda la capa de kiosk en **Linux**
(`systemd`, `chromium --kiosk`, `xbindkeys`, `xrandr`, `xset`). Como el host va con
**macOS**, esa capa se reimplementa con equivalentes macOS (ver §6.H).

---

## 3. Arquitectura

```
iCloud (calendarios públicos, webcal://)
        │  descarga https:// cada N min
        ▼
Backend FastAPI (Python) :8000
  - parsea ICS (icalendar)
  - expande recurrencias (recurring-ical-events)
  - cachea en memoria + resiliencia
  - expone /events y /health (JSON)
        │  fetch cada 60s
        ▼
Frontend React+Vite+Tailwind v4 :5173
  - Vista 1 (dashboard) + auto-refresh + reloj en vivo
        │
        ▼
Chrome --kiosk en el Mac mini (pendiente, §6.H)
```

- **Fuente de datos:** cada calendario se publica en iCloud como "Calendario
  público" → URL `webcal://`. El backend la descarga por `https://` (apuntan al
  mismo `.ics`). El **color por calendario** se define en el config del backend
  (es la fuente de verdad, no se hardcodea en el frontend).
- Dos servicios independientes (backend y frontend), sin auth, todo en localhost/LAN.

---

## 4. Estado actual: HECHO

Dos carpetas: `calendar-api/` (backend) y `calendar-web/` (frontend). Ambas
funcionan; el frontend ya está corriendo en el Mac con varios calendarios
publicados (CUMPLES, FAMILY, LEYA, NAIARA, NIUSVEL, NIUSVELITO).

### 4.1 Backend — `calendar-api/` (funcionando y probado)

| Fichero | Contenido |
| --- | --- |
| `main.py` | App FastAPI. `lifespan` hace una carga inicial y lanza un loop de refresco cada `refresh_minutes`. Cache en memoria por calendario (`LAST_GOOD`). **Resiliencia:** si un feed falla, conserva sus últimos eventos buenos y marca el error en `/health` (no rompe el dashboard). Endpoints: `GET /` (info), `GET /health`, `GET /events`. CORS abierto a propósito (localhost/LAN). `_normalize_color()` antepone `#` a colores sin él (evita que el navegador los descarte). |
| `calendar_source.py` | `fetch_ics` (convierte `webcal://`→`https://`, httpx async), parseo con `icalendar`, **expansión de recurrencias** con `recurring_ical_events.of(cal).between(start, end)` (RRULE/RDATE/EXDATE y ediciones puntuales — `icalendar` solo NO lo hace), y normalización de cada ocurrencia a dict. Zona horaria `Europe/Madrid`; los all-day se anclan a medianoche local. |
| `config.yaml` | Configuración (gitignored, sin plantilla). `refresh_minutes` (10), `window_past_days` (**400**, margen; la Vista 3 mira al futuro), `window_future_days` (400), y `calendars: [{name, color, url}]`. |
| `requirements.txt` | fastapi, uvicorn[standard], httpx, icalendar, recurring-ical-events, PyYAML, tzdata. |
| `test_smoke.py` | Test sin red: valida expansión de un semanal con EXDATE, un all-day multi-día y un evento puntual. **Pasa.** |
| `README.md` | Instalación, cómo publicar el calendario iCloud, arranque, notas (latencia, resiliencia). |

**Verificado:** `test_smoke.py` pasa y una prueba HTTP end-to-end (servir un ICS y
consultar `/events`) devuelve los eventos correctos con color, `all_day`,
`multi_day` y zona horaria.

**Ventanas temporales:** el backend expande de `hoy - window_past_days` a
`hoy + window_future_days`. `/events?from=&to=` filtra sobre esa cache.

### 4.2 Frontend — `calendar-web/` (Vista 1 funcionando)

Stack: **React 18 + Vite 6 + Tailwind v4** (plugin `@tailwindcss/vite` + `@import
"tailwindcss"`, **sin** `tailwind.config.js`; tokens vía `@theme`/`:root`).

> **Nota de estructura:** los componentes y helpers viven en `src/components/` y
> `src/lib/`; los imports usan rutas relativas a esa estructura. El proyecto
> arranca con `npm run dev` y compila con `npm run build` (33 módulos, verificado).

| Fichero | Contenido |
| --- | --- |
| `src/main.jsx` | Punto de entrada: monta `<App/>` en `#root` (React 18 `createRoot` + `StrictMode`) e importa `index.css`. |
| `src/App.jsx` | Estado `events/status/lastUpdated/now/view`. `load()` pide `/events` desde `primerDíaDelMes - 7` hasta el **último día de (mes + 2)** (cubre mini-mes, Vista 1 y los 3 meses de la Vista 3; maneja el cambio de año). Intervalos: refetch cada 60 s + reloj cada 1 s. Deriva la leyenda de personas. **Rotación automática** de vistas `1→2→3→1` cada `ROTATE_MS` (60 s) + **control manual** con teclas `1`/`2`/`3` (una pulsación reinicia el minuto). Render: `view===2` → `MonthFull` (mes), `view===3` → `QuarterView` (3 meses), si no el board. |
| `src/components/Header.jsx` | Reloj en vivo `HH:MM`, fecha (capitalizada con `capFirst`), leyenda por persona (cuadro de color + nombre) y `StatusDot` con la línea `Actualizado HH:MM · ● ONLINE · hace T` (ver §5.2). |
| `src/components/TodayTimeline.jsx` | Panel "Hoy": franja de todo-el-día arriba + rejilla horaria con eventos como bloques (con **algoritmo de carriles** para solapamientos) + **línea de la hora actual**. Ventana horaria adaptativa (mín 08, máx 22, se expande si hay eventos fuera). |
| `src/components/WeekGrid.jsx` | Panel "Próximos 7 días" (empieza **mañana**). Pills de **una línea** (hora + título, ellipsis) coloreadas; fin de semana resaltado; **truncado medido** por columna (cuántas caben + "+N más", `useLayoutEffect` + `ResizeObserver`); **ancho de columna adaptativo**: un día vacío se encoge a `--day-col-compact-w` si un vecino tiene eventos, cediendo ancho a los días ocupados (si nadie tiene eventos, 7 columnas iguales). |
| `src/components/MiniMonth.jsx` | Mini-mes del mes actual (lunes-primero), hoy resaltado, hasta 3 puntos de color en días con eventos. |
| `src/components/QuarterView.jsx` | **Vista 3 "3 meses"** (mes actual + 2 siguientes). Cada mes se reparte en filas de `SPLIT = 14` columnas (2 semanas) y ocupa **tantas filas como necesite** (`ceil((offset+dim)/14)`, 2–3). Menos datos = celdas grandes (~128×85 px). Días **alineados por día de semana** (`mondayOffset`); el shift de 14 = 2·7 mantiene las **bandas de finde** verticales. Cabecera `L M X J V S D` (×2), número por día, **hoy** resaltado. Eventos como **barras con el título dentro** (color = calendario, `.year-bar-label` con ellipsis) en carriles (`MAX_LANES = 3`; un evento que cruza el corte de 14 aparece en varias filas; el exceso no se pinta — ver §6.E). Reusa las clases CSS `.year-*`. |
| `src/components/MonthFull.jsx` | **Vista 2 "mes completo"**: calendario grande del mes actual (lunes-primero) vía `monthMatrix`. 7 cols × 5–6 semanas; cada celda = número + pills de evento (hora + título) con **truncado medido** (`useLayoutEffect` + `ResizeObserver`) + "+N más". Hoy resaltado, bandas de finde, días de otro mes atenuados (`.mf-out`), color = calendario. |
| `src/lib/dates.js` | Helpers: parseo **all-day vs con hora** (clave: all-day como fecha LOCAL para evitar off-by-one), nombres en español, `monthMatrix`, `layoutLanes`, `coversDay`, `eventsOnDay`, `fmtTime`, `fmtLongDate`, `fmtAgo` (tiempo relativo con unidad adaptativa). |
| `src/lib/api.js` | `API_BASE = import.meta.env.VITE_API_BASE \|\| "http://127.0.0.1:8000"`. `fetchEvents(from, to)`. |
| `src/index.css` | `@import "tailwindcss"` + tokens de tema (casi-negro cálido, fuentes Bricolage Grotesque + Hanken Grotesk) + **todo el layout y los estilos de los componentes** + animación de entrada. Variable `--day-col-compact-w` para el ancho de día vacío encogido. |
| `index.html` | Punto de montaje (`#root`), `<script src="/src/main.jsx">` y carga de las fuentes de Google (Bricolage Grotesque + Hanken Grotesk). |
| `.env.example` | Plantilla para `VITE_API_BASE` (base del backend). Se copia a `.env` solo si el backend NO está en `http://127.0.0.1:8000`. |
| `vite.config.js` | `react()` + `tailwindcss()`, server en `127.0.0.1:5173`. |

**Vista 1** = vista por defecto: Hoy (timeline) + Próximos 7 días + Mini-mes.
Dark mode, color=persona en las tres zonas, auto-refresh. **Compila limpio**
(`npm run build`). **Vista 1 COMPLETA y verificada** (issues §5 cerrados + pills de
una línea, colores corregidos, ancho de columna adaptativo). Verificación: build
limpio + capturas headless 1920×1080 y 1366×768 + medición de DOM por CDP.

### 4.3 Contrato de API (backend ↔ frontend) — NO ROMPER

`GET /events?from=YYYY-MM-DD&to=YYYY-MM-DD` →

```json
{
  "events": [
    {
      "id": "UID-2026-06-01T09:00:00+02:00",
      "uid": "…",
      "calendar": "LEYA",
      "color": "#E91E63",
      "title": "Clase semanal",
      "location": "Casa",      // o null
      "all_day": false,
      "multi_day": false,
      "start": "2026-06-01T09:00:00+02:00",
      "end":   "2026-06-01T10:00:00+02:00"
    }
  ],
  "count": 1,
  "from": "2026-06-01",
  "to": "2026-07-01",
  "last_updated": "2026-06-03T23:08:51+02:00"
}
```

Semántica de fechas:
- `all_day: true` → `start`/`end` son `YYYY-MM-DD`. El `end` es **EXCLUSIVO**
  (convención iCal: el día siguiente al último).
- `all_day: false` → `start`/`end` son ISO con zona horaria.
- `multi_day` = el evento cruza más de un día (para pintar barras en el futuro).
- `last_updated` = última vez que el **backend** repobló desde iCloud (cada
  `refresh_minutes`), no cuándo hizo fetch el frontend.

`GET /health` →

```json
{
  "status": "ok",                 // "ok" si algún calendario va bien; si no "degraded"
  "last_updated": "…",
  "calendars": {
    "LEYA": { "ok": true, "last_success": "…", "error": null, "count": 12 }
  }
}
```

---

## 5. Issues §5 — RESUELTOS (verificado en monitor real + medición de DOM)

Surgieron al ver la Vista 1 en el monitor real. Los tres están corregidos y
verificados (build limpio + capturas headless a 1920×1080 y 1366×768 + medición de
alturas computadas por CDP). Se documentan aquí con el fix final aplicado.

### 5.1 La rejilla cabe en el viewport — RESUELTO

**Síntoma original:** el panel de "Próximos 7 días" quedaba por debajo del borde y
las pills se cortaban a media altura.

**Causa raíz (confirmada midiendo el DOM):** el `<section class="panel">` de
`WeekGrid` (y `MiniMonth`) **no rellenaba su celda del grid** porque le faltaba
`h-full` — solo `TodayTimeline` lo tenía. El panel tomaba altura por contenido, así
que cuando un día tenía muchos eventos crecía **más que su celda** y el sobrante se
recortaba por el `overflow: hidden`. Además `.day-events` no estaba acotada en
altura (`clientHeight: 0`), por lo que el truncado medido nunca llegaba a dispararse.

**Fix aplicado:**
- `src/index.css` → `.app { height: 100dvh; overflow: hidden }` y `.board` con
  `grid-template-*: minmax(0, …)` en ambos ejes (permite que las pistas encojan).
- `WeekGrid.jsx` y `MiniMonth.jsx` → añadido `h-full` al `<section class="panel">`
  para que rellene su celda.
- `src/index.css` → `.day-events { flex: 1 1 0 }` (la lista queda acotada a la
  altura de la columna → el truncado medido ya puede medir y actuar).
- `WeekGrid.jsx` → truncado **medido** por columna (`useLayoutEffect` +
  `ResizeObserver`): muestra solo las pills que caben + "+N más", robusto a cualquier
  resolución (sustituye al `MAX=5` fijo).

**Verificado:** a 1080 y 768 el dashboard entero cabe sin scroll; `weekPanel` mide
igual que su celda (318 px = 318 px) y `day-events` tiene altura real (155 px).

### 5.2 Indicador de "última actualización" — RESUELTO (formato actualizado)

La cabecera muestra ahora, en `Header.jsx`/`StatusDot`, una línea de estado con
**tres segmentos** separados por `·`:

```
Actualizado HH:MM · ● ONLINE · hace T
```

- `Actualizado HH:MM` → hora absoluta del sello `last_updated` (última repoblación
  del backend desde iCloud).
- `● ETIQUETA` → punto de color + estado: **ONLINE** (ok, verde) / **OFFLINE**
  (error, ámbar) / **CARGANDO** (loading, gris).
- `hace T` → tiempo transcurrido en la **unidad más representativa** (`fmtAgo` en
  `src/lib/dates.js`): `Xs` (<60 s) · `Xm` (<60 min) · `Xh` (<24 h) · `Xd Yh` (de
  24 h a 30 d) · `Xmm Yd` (al pasar de 30 d) · `Xyy Ymm` (al pasar de 12 mm).
  Aproximación: 1 mes = 30 días, 1 año = 12 meses. Cubierto por tests unitarios.

Nota: el sello solo avanza cada `refresh_minutes`, aunque el frontend haga fetch
cada 60 s; por eso el "hace T" puede llegar a ~`refresh_minutes`.

### 5.3 Capitalización de la fecha — RESUELTO

Quitada la clase CSS `capitalize` del elemento de fecha en `Header.jsx`; ahora un
helper `capFirst()` capitaliza **solo la primera letra** sobre `fmtLongDate(now)` →
"Jueves 4 de junio" (antes "Jueves 4 **De Junio**"). El título del mini-mes
("Junio 2026") sigue con `capitalize` por ser una sola palabra.

---

## 6. Roadmap (lo que falta), priorizado

**A. Issues de §5 (viewport, last-updated, capitalización) — HECHO.** Ver §5.

**B. Vista 3 — "3 meses"** (mes actual + 2 siguientes) — **HECHO**, ver
`QuarterView.jsx` en §4.2. Sustituye a la antigua "año linear" (12 meses), que se
veía demasiado pequeña. Grid de **14 columnas** (2 semanas) y cada mes ocupa las
filas que necesite → celdas grandes y **título visible dentro de cada barra**.
**Verificado:** "junio – agosto 2026", 14 cols (L M X J V S D ×2), 9 sub-filas
(3 meses), celdas ~128×85 px, barras con texto, hoy resaltado, sin desbordar,
captura headless 1920×1080. Pendiente de refinar: §6.E (eventos por encima de
`MAX_LANES` no se pintan).
- Nota: `window_past_days = 400` en `config.yaml` ya no es imprescindible (la Vista 3
  mira al futuro); se mantiene como margen y es inocuo.

**C. Cambio de vista — frontend HECHO; botón físico PENDIENTE:**
- **Rotación automática** en `App.jsx`: cada 60 s (`ROTATE_MS`) avanza `1→2→3→1`,
  mostrando cada vista un minuto. **Control manual** con teclas `1`/`2`/`3`; una
  pulsación reinicia el minuto (la vista elegida se ve un minuto completo antes de
  seguir rotando). Indicador de vista activa en el header (`.view-tag`).
  **Verificado:** intercambio de teclas y avance automático 1→2 tras 65 s.
  (Sustituye al antiguo auto-retorno a la Vista 1.)
- **Pendiente (montaje):** en **macOS** mapear el numérico USB con
  **Karabiner-Elements** o **Hammerspoon** → que el navegador reciba esos `keydown`
  (el frontend ya los escucha).

**D. Vista 2 — "Mes completo" — HECHO (MVP)**, ver `MonthFull.jsx` en §4.2. Mes
actual (lunes-primero), rejilla grande 7 cols × 5–6 semanas; cada celda = número de
día + eventos como pills (hora + título) con **truncado medido + "+N más"**; hoy
resaltado, bandas de finde, días de otro mes atenuados, color = calendario.
**Verificado:** 35 celdas (junio), cabecera `L M X J V S D`, hoy marcado, títulos sin
cortar, sin desbordamiento, captura headless, 0 errores de consola.

**E. Refinamientos de eventos (visual):**
- Multi-día como **barras que cruzan días** en la rejilla de 7 días y en el mini-mes
  (ahora se muestran como pill en cada día).
- **Vista 3 (3 meses) — desborde de carriles:** hoy una fila pinta hasta `MAX_LANES = 3` barras;
  los eventos que no caben **no se muestran** (sin indicador). Opciones: subir
  carriles según altura de fila, o un marcador "+N" por celda con exceso.

**F. Gestión de brillo / "no convertir la pantalla en lámpara":**
- Dark mode: **hecho**.
- **Auto-dim por hora:** recomendado hacerlo **en la propia app** (overlay/filtro
  CSS por franja horaria) — agnóstico al SO y al monitor, cero dependencias.
  Alternativa hardware: `ddcctl` (CLI, backlight real, scriptable por launchd/cron)
  — funciona en Mac Intel por HDMI, **pero DDC/CI depende de que el monitor Xiaomi
  lo respete**, así que el plan fiable es el CSS in-app.
- **Apagado nocturno:** `pmset` (programar sleep de pantalla ~23h-7h).

**G. Backend (opcional):**
- **Persistencia SQLite** para sobrevivir a reinicios sin esperar al primer refresh
  (hoy es solo memoria).
- **CalDAV privado con contraseña de app** como alternativa a los feeds públicos si
  la **latencia** de iCloud molesta (ver §7). ~50 líneas extra. Mantiene el mismo
  contrato de `/events`.
- (Opcional) servir el frontend ya compilado desde el backend para tener un solo
  servicio.

**H. Setup del kiosk en el Mac mini (macOS Monterey)** — traducción de la capa
Linux del brief original:

| Brief (Linux) | macOS |
| --- | --- |
| `systemd` (backend + frontend) | `launchd` → un `.plist` en `~/Library/LaunchAgents` por servicio (uvicorn + `vite preview`/estático) |
| `chromium --kiosk --app=URL` | `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --kiosk --app=http://127.0.0.1:5173` |
| `xbindkeys` (numérico USB) | Karabiner-Elements / Hammerspoon |
| `xrandr --brightness` | dim in-app (CSS) — ver §6.F; o `ddcctl` |
| `xset dpms force off` | `pmset` (sleep de pantalla programado) |
| `unclutter` (ocultar cursor) | el kiosk de Chrome lo oculta; o Cursorcerer |
| autologin de sesión X | Preferencias del Sistema → Usuarios y grupos → Opciones de inicio de sesión → Inicio de sesión automático |
| (anti-suspensión) | `caffeinate` / `pmset` |

Recordatorio hardware: **SSD USB3 externo** muy recomendable (§2).

**I. Extras post-MVP:** widget de clima, foto rotativa de fondo en zonas vacías,
flash de color cuando alguien añade un evento, tipografía/densidad ajustable por
distancia, sensor de luz para brillo adaptativo.

---

## 7. Decisiones y datos técnicos a preservar

- **Mac mini Late 2014 → macOS Monterey (12) máximo** (verificado). La API moderna
  de EventKit (`requestFullAccessToEvents`, macOS 14) **no está disponible**, pero
  **da igual**: la fuente de datos son feeds ICS por HTTP, agnósticos al SO.
- **iCloud público:** publicar calendario → URL `webcal://` → se descarga por
  `https://` (mismo `.ics`).
  - *Privacidad:* cualquiera con el enlace puede ver esos eventos (tradeoff
    asumido). Alternativa privada: CalDAV + contraseña de app.
  - *Latencia:* Apple regenera el `.ics` público a su ritmo y **no se puede forzar**
    desde fuera (suele tardar minutos, no garantizado instantáneo). Por eso el
    objetivo "evento nuevo visible en ≤10 min" no depende solo del backend.
- **Versiones:** `recurring-ical-events` 3.x (`of(cal).between(start, end)`),
  `icalendar` 7.x. Frontend: React 18, Vite 6, Tailwind 4.
- **Tailwind v4 + Vite:** plugin `@tailwindcss/vite` + `@import "tailwindcss"`,
  **sin** `tailwind.config.js`; tokens con `@theme` (o `:root`).
- **Color = persona:** definido en `config.yaml` del backend, viaja en cada evento
  (`color`). El frontend NO lo hardcodea. El color debe ser hex CSS válido; el
  backend normaliza anteponiendo `#` si falta (`_normalize_color`), porque sin `#`
  el navegador descarta el color (cae a `currentColor`).
- **Fechas:** all-day con `end` exclusivo; parsear all-day como fecha **local** en
  el frontend (evitar `new Date("YYYY-MM-DD")`, que es UTC).

---

## 8. Cómo arrancar (desarrollo)

**Backend** (`calendar-api/`):

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# crear config.yaml con tus calendarios (name, color, url webcal://)
uvicorn main:app --host 127.0.0.1 --port 8000
# comprobar: curl http://127.0.0.1:8000/health   (count > 0 en cada calendario)
```

**Frontend** (`calendar-web/`, con el backend ya arriba):

```bash
npm install
npm run dev        # http://127.0.0.1:5173
# build de producción: npm run build  &&  npm run preview
```

Publicar un calendario iCloud (para obtener su `webcal://`): iPhone → app
Calendario → Calendarios → (i) del calendario → activar **Calendario público** →
**Compartir enlace**. (Detalle en el `README.md` del backend.)

---

## 9. Convenciones y preferencias del usuario

- **Verificar datos concretos** (versiones, APIs, nombres, comandos) **antes de
  afirmarlos**; no tirar de memoria. Si no se verifica algo, marcarlo como "dato no
  verificado". Aplica también al trabajo del agente.
- Stack fijado: **Python/FastAPI** (backend) + **React/Vite/Tailwind** (frontend).
- Comentarios en **español**, identificadores en **inglés**.
- El usuario trabaja con varios asistentes/agentes en paralelo y compara salidas;
  mantener el código y las decisiones claras y autoexplicadas facilita ese flujo.
- Prioridad de producto: legibilidad a distancia, dark mode + dimming (no
  "lámpara"), color por persona, y fiabilidad 24/7.
```
