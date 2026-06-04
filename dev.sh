#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Arranca el backend (FastAPI) y luego el frontend (Vite) con un solo comando.
#   ./dev.sh
# Ctrl+C detiene ambos. Si falta el venv o node_modules, los crea/instala.
# -----------------------------------------------------------------------------

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API="$ROOT/calendar-api"
WEB="$ROOT/calendar-web"
API_HOST="127.0.0.1"
API_PORT="8000"
WEB_URL="http://127.0.0.1:5173"

BACK_PID=""
FRONT_PID=""

# Limpieza: al salir (Ctrl+C o cierre) detiene backend y frontend y sus hijos.
cleanup() {
  echo ""
  echo "Deteniendo backend y frontend..."
  [ -n "$FRONT_PID" ] && { pkill -P "$FRONT_PID" 2>/dev/null; kill "$FRONT_PID" 2>/dev/null; }
  [ -n "$BACK_PID" ]  && { pkill -P "$BACK_PID"  2>/dev/null; kill "$BACK_PID"  2>/dev/null; }
  exit 0
}
trap cleanup INT TERM

# --- Backend: crear venv e instalar dependencias si faltan --------------------
if [ ! -x "$API/.venv/bin/python" ]; then
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

echo ""
echo "Ambos en marcha. Abre $WEB_URL  ·  Ctrl+C para detener todo."

# Bloquear hasta que terminen; el trap se encarga de la limpieza con Ctrl+C.
wait
