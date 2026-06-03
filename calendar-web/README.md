# Family Wall Calendar — Frontend (Vista 1)

Dashboard del calendario familiar. React + Vite + Tailwind v4. Consume el
endpoint `/events` del backend y pinta la **Vista 1**:

- **Hoy** en timeline horario (eventos como bloques coloreados por persona, con
  franja de "todo el día" arriba y una línea de la hora actual).
- **Próximos 7 días** en columnas, con los eventos de cada día como pills.
- **Mini-mes** del mes actual, con hoy resaltado y puntos de color en los días
  con eventos.

Color = persona en todas las vistas (viene del backend, sin prefijos `[NOMBRE]`).
Dark mode, tipografía grande pensada para leerse desde 3-4 m, y refresco
automático cada minuto. Si el backend no responde, mantiene lo último que cargó
y marca "sin conexión" en la cabecera.

## Requisitos

- Node.js 18+ (en el Mac: `brew install node`).
- El **backend corriendo** en `http://127.0.0.1:8000` (arráncalo primero).

## Instalación

```bash
cd calendar-web
npm install
```

Si tu backend NO está en `127.0.0.1:8000`, copia `.env.example` a `.env` y ajusta
`VITE_API_BASE`.

## Arranque (desarrollo)

```bash
npm run dev
```

Abre `http://127.0.0.1:5173` en el navegador. Deberías ver tu calendario con los
eventos reales. (Con un solo evento se ve vacío pero funcional; al publicar más
calendarios irán apareciendo automáticamente con su color.)

## Modo kiosk (pantalla de pared)

Lo más simple para el MVP:

```bash
npm run build        # genera dist/
npm run preview      # sirve dist/ en http://127.0.0.1:5173
```

Y abres Chrome a pantalla completa apuntando ahí:

```bash
# macOS
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --kiosk --app=http://127.0.0.1:5173
```

(En el montaje final, tanto `preview` como el backend irán como servicios
`launchd` que arrancan al iniciar sesión, según el mapeo Linux→macOS que vimos.)

## Notas

- La ventana de datos que pide al backend cubre el mes actual + ~6 semanas, así
  que mini-mes y los 7 días siempre tienen lo que necesitan.
- Los eventos **multi-día** aparecen como pill en cada día que ocupan. Las barras
  que cruzan días de un tirón quedan para la iteración post-MVP (como en tu brief).
- Diseño en `src/index.css` (tokens de color y tipografía arriba del todo, fácil
  de retocar). Los colores de cada persona NO se definen aquí: vienen del backend.

## Siguiente paso

- **Vista 2: "año linear"** (formato planner físico, fechas alineadas por día de
  la semana, bandas de fin de semana) + **cambio de vista con el botón físico**
  (state machine + auto-return a la Vista 1).
