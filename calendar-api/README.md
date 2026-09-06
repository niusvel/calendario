# Family Wall Calendar — Backend

Backend del calendario familiar de pared. Lee los calendarios de iCloud (feeds
ICS publicos), expande los eventos recurrentes y los sirve como JSON para que el
frontend los pinte.

Primer entregable del proyecto: validable de punta a punta sin tener todavia el
kiosk montado. Puedes desarrollarlo en cualquier maquina antes de configurar el
Mac mini.

## Que hace

- Descarga cada N minutos los feeds ICS de iCloud configurados.
- Expande eventos recurrentes (RRULE/RDATE/EXDATE y ediciones puntuales) — esto
  `icalendar` por si solo no lo hace; se usa `recurring-ical-events`.
- Normaliza cada ocurrencia (color por persona, all-day vs con hora, multi-dia).
- Cachea en memoria y, si un feed falla (caida de wifi), conserva los ultimos
  eventos buenos para que el dashboard no se rompa.

## Endpoints

| Endpoint | Que devuelve |
| --- | --- |
| `GET /events?from=YYYY-MM-DD&to=YYYY-MM-DD` | Eventos que solapan ese rango (JSON). Sin parametros: de hoy-7d a hoy+400d. |
| `GET /health` | Estado de cada calendario (ok/error, ultimo exito, nº de eventos). |
| `POST /kiosk/pause` | Pausa de 30 minutos mediante doble Q; solo desde la pantalla local de una instalación administrada. |
| `GET /` | Info basica. |

Forma de cada evento:

```json
{
  "id": "UID-2026-06-01T09:00:00+02:00",
  "uid": "...",
  "calendar": "Leya",
  "color": "#E91E63",
  "title": "Clase semanal",
  "location": "Casa",
  "all_day": false,
  "multi_day": false,
  "start": "2026-06-01T09:00:00+02:00",
  "end": "2026-06-01T10:00:00+02:00"
}
```

Notas de formato para el frontend:
- `all_day: true` -> `start`/`end` son fechas `YYYY-MM-DD`. El `end` es
  **exclusivo** (convencion iCal: el dia siguiente al ultimo).
- `all_day: false` -> `start`/`end` son ISO con zona horaria.
- `multi_day` indica si el evento cruza mas de un dia (para pintar barras).

## Requisitos

- Python 3.10+ (usa `zoneinfo` de la stdlib). En el Mac mini:
  `brew install python@3.12` (o desde python.org).

## Instalacion

```bash
cd calendar-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# crea config.yaml con tus calendarios (formato mas abajo: name, color, url webcal://)
```

## Publicar un calendario de iCloud y sacar su URL

Cada calendario que quieras mostrar hay que publicarlo como **Calendario publico**;
eso genera una URL `webcal://` que es la que va en `config.yaml`.

Desde el iPhone:
1. App **Calendario** -> boton **Calendarios** (abajo).
2. Toca el icono **(i)** a la derecha del calendario.
3. Activa **Calendario publico**.
4. Toca **Compartir enlace** y copia la URL (empieza por `webcal://`).

Desde iCloud.com (ordenador):
1. Entra en `icloud.com/calendar` e inicia sesion.
2. Pasa el raton por el calendario en la barra lateral y pulsa el icono de
   compartir.
3. Activa **Calendario publico**.
4. Pulsa **Copiar enlace**.

> **Privacidad**: un Calendario publico es de solo lectura, pero cualquiera con
> el enlace puede ver sus eventos. La URL es larga y aleatoria (no indexable en
> la practica), pero no la compartas a la ligera. Es el tradeoff ya asumido en
> el brief; la alternativa privada es CalDAV con contrasena de app.

Pega cada URL en `config.yaml` con su nombre y color:

```yaml
calendars:
  - name: "Leya"
    color: "#E91E63"
    url: "webcal://pXX-caldav.icloud.com/published/2/..."
```

Puedes pegar la `webcal://` tal cual; el backend la pasa a `https://` para
descargarla (apuntan al mismo .ics).

## Ejecutar

```bash
source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000
```

Comprobaciones rapidas:

```bash
curl "http://127.0.0.1:8000/health"
curl "http://127.0.0.1:8000/events?from=2026-06-01&to=2026-07-01"
```

## Test (sin red)

```bash
source .venv/bin/activate
python test_smoke.py
```

Valida la expansion de un evento semanal con EXDATE, un all-day multi-dia y un
evento puntual.

## Notas importantes

- **Latencia de iCloud**: el .ics publico lo regenera Apple a su ritmo y no se
  puede forzar desde fuera. En la practica suele tardar pocos minutos, pero no
  esta garantizado que sea inmediato. Por eso el objetivo "evento creado en el
  movil -> visible en <=10 min" depende en parte de Apple, no solo del refresco
  del backend. Si esa frescura llega a importar y el feed publico se queda corto,
  el plan B es CalDAV con contrasena de app (la alternativa ya documentada).
- **Resiliencia**: si un feed falla, `/health` marca ese calendario en error
  pero `/events` sigue sirviendo sus ultimos eventos cacheados. Para probarlo,
  corta el wifi y consulta ambos endpoints.
- **CORS** esta abierto a proposito: todo corre en localhost/LAN sin auth.

## Siguiente paso

El frontend (React + Vite + Tailwind) con la Vista 1 (hoy en timeline + proximos
7 dias + mini-mes), consumiendo `GET /events`.
