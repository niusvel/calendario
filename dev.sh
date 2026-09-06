#!/usr/bin/env bash
# Desarrollo/manual. Para arranque permanente, foco y actualización automática:
# python3 scripts/macos/calendar_kiosk.py install (ver docs/macos-kiosco.md).
# -----------------------------------------------------------------------------
# Arranca el backend (FastAPI), el frontend (Vite) y, cuando ambos responden,
# abre Google Chrome en modo kiosko apuntando al dashboard. Un solo comando:
#   ./dev.sh            -> levanta backend + frontend + kiosko
#   KIOSK=0 ./dev.sh    -> sin kiosko (util al desarrollar en local)
# Ctrl+C detiene los tres. Si falta el venv o node_modules, los crea/instala.
# -----------------------------------------------------------------------------

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API="$ROOT/calendar-api"
WEB="$ROOT/calendar-web"
API_HOST="127.0.0.1"
API_PORT="8000"
WEB_URL="http://127.0.0.1:5173"

# Kiosko (Chrome). KIOSK=0 lo desactiva. Perfil dedicado para no tocar tu Chrome
# normal y evitar la barra "¿Restaurar paginas?" tras un apagon.
KIOSK="${KIOSK:-1}"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
KIOSK_PROFILE="$HOME/.calendar-kiosk"

BACK_PID=""
FRONT_PID=""
CHROME_PID=""

# Limpieza: al salir (Ctrl+C o cierre) detiene backend, frontend, kiosko e hijos.
cleanup() {
  echo ""
  echo "Deteniendo backend, frontend y kiosko..."
  [ -n "$CHROME_PID" ] && { pkill -P "$CHROME_PID" 2>/dev/null; kill "$CHROME_PID" 2>/dev/null; }
  [ -n "$FRONT_PID" ]  && { pkill -P "$FRONT_PID"  2>/dev/null; kill "$FRONT_PID"  2>/dev/null; }
  [ -n "$BACK_PID" ]   && { pkill -P "$BACK_PID"   2>/dev/null; kill "$BACK_PID"   2>/dev/null; }
  exit 0
}
trap cleanup INT TERM

# --- Backend: crear venv e instalar dependencias si faltan --------------------
# Un venv "zombie" (creado en otra ruta y luego movido) tiene su python como symlink
# roto: existe pero no ejecuta. Comprobamos que ARRANQUE de verdad, no solo que este.
if ! "$API/.venv/bin/python" -c "" >/dev/null 2>&1; then
  if [ -e "$API/.venv" ]; then
    echo "El venv existente esta roto (¿proyecto movido de carpeta?). Recreandolo ..."
    rm -rf "$API/.venv"
  fi
  echo "Creando entorno virtual de Python en calendar-api/.venv ..."
  python3 -m venv "$API/.venv" || { echo "✗ No se pudo crear el venv"; exit 1; }
  "$API/.venv/bin/pip" install -q --upgrade pip
  "$API/.venv/bin/pip" install -q -r "$API/requirements.txt"
fi

if [ ! -f "$API/config.yaml" ]; then
  echo "⚠️  Falta calendar-api/config.yaml (tus calendarios). El backend no servirá eventos sin él."
fi

# --- Frontend: instalar dependencias si faltan --------------------------------
if [ ! -d "$WEB/node_modules" ]; then
  echo "Instalando dependencias del frontend (npm install) ..."
  ( cd "$WEB" && npm install ) || { echo "✗ Falló npm install"; exit 1; }
fi

# --- Arrancar backend ---------------------------------------------------------
echo "▶ Backend  → http://$API_HOST:$API_PORT"
( cd "$API" && exec .venv/bin/uvicorn main:app --host "$API_HOST" --port "$API_PORT" ) &
BACK_PID=$!

# Esperar a que el backend responda en /health (hasta ~30 s)
printf "Esperando al backend"
for _ in $(seq 1 30); do
  if curl -fsS "http://$API_HOST:$API_PORT/health" >/dev/null 2>&1; then
    echo " ✓ listo"
    break
  fi
  # Si el backend murió (p.ej. sin config.yaml), no seguir esperando en balde.
  kill -0 "$BACK_PID" 2>/dev/null || { echo ""; echo "⚠️  El backend se detuvo (¿falta config.yaml?). Sigo con el frontend igualmente."; break; }
  printf "."
  sleep 1
done

# --- Arrancar frontend (Vite dev, con HMR) ------------------------------------
echo "▶ Frontend → $WEB_URL"
( cd "$WEB" && exec npm run dev ) &
FRONT_PID=$!

# --- Kiosko: abrir Chrome cuando el frontend responda de verdad ---------------
if [ "$KIOSK" = "1" ]; then
  if [ ! -x "$CHROME" ]; then
    echo "⚠️  No encuentro Google Chrome en \"$CHROME\". Sigo sin kiosko (abre $WEB_URL a mano)."
  else
    # Esperar a que Vite sirva la pagina (hasta ~30 s) antes de abrir el kiosko.
    printf "Esperando al frontend"
    for _ in $(seq 1 30); do
      if curl -fsS "$WEB_URL" >/dev/null 2>&1; then
        echo " ✓ listo"
        break
      fi
      kill -0 "$FRONT_PID" 2>/dev/null || { echo ""; echo "⚠️  El frontend se detuvo; no abro el kiosko."; break; }
      printf "."
      sleep 1
    done

    if kill -0 "$FRONT_PID" 2>/dev/null && curl -fsS "$WEB_URL" >/dev/null 2>&1; then
      echo "▶ Kiosko   → Chrome en pantalla completa sobre $WEB_URL"
      # Perfil dedicado + flags que evitan barras/dialogos sobre el dashboard.
      "$CHROME" \
        --kiosk --app="$WEB_URL" \
        --user-data-dir="$KIOSK_PROFILE" \
        --no-first-run --no-default-browser-check \
        --disable-session-crashed-bubble --disable-infobars \
        --noerrdialogs --disable-features=TranslateUI \
        --autoplay-policy=no-user-gesture-required \
        >/dev/null 2>&1 &
      CHROME_PID=$!
    fi
  fi
fi

echo ""
echo "Todo en marcha. Abre $WEB_URL  ·  Ctrl+C para detener todo."

# Bloquear hasta que terminen; el trap se encarga de la limpieza con Ctrl+C.
wait
