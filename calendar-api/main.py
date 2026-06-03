"""
Backend del calendario familiar de pared.

Lee los feeds ICS publicos de iCloud configurados en config.yaml, expande los
eventos recurrentes y los cachea en memoria. Expone:

  GET /events?from=YYYY-MM-DD&to=YYYY-MM-DD  -> eventos en ese rango (JSON)
  GET /health                                 -> estado de cada calendario
  GET /                                        -> info basica

Resiliencia: si la descarga de un calendario falla (p.ej. caida de wifi), se
conservan sus ultimos eventos buenos y el dashboard sigue funcionando.

Arranque:
  uvicorn main:app --host 127.0.0.1 --port 8000
"""
from __future__ import annotations

import asyncio
import datetime as dt
import logging
from contextlib import asynccontextmanager
from pathlib import Path

import yaml
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from calendar_source import CalendarConfig, LOCAL_TZ, fetch_ics, parse_and_expand

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("family-calendar")

CONFIG_PATH = Path(__file__).parent / "config.yaml"

# ---- Estado en memoria ------------------------------------------------------
CONFIG: dict = {}
CALENDARS: list[CalendarConfig] = []
LAST_GOOD: dict[str, list[dict]] = {}   # nombre -> ultima lista buena de eventos
STATUS: dict[str, dict] = {}            # nombre -> {ok, last_success, error, count}
LAST_UPDATED: "dt.datetime | None" = None
_refresh_task: "asyncio.Task | None" = None


def _normalize_color(value: "str | None") -> str:
    """Asegura un hex CSS valido. iCloud/usuario a veces pega 'F09343' sin '#';
    sin el '#' el navegador descarta el color (cae a currentColor). Lo anteponemos."""
    c = (value or "").strip()
    if not c:
        return "#888888"
    return c if c.startswith("#") else f"#{c}"


def load_config() -> None:
    global CONFIG, CALENDARS
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(
            f"No existe {CONFIG_PATH}. Crea config.yaml con tus calendarios (name, color, url)."
        )
    CONFIG = yaml.safe_load(CONFIG_PATH.read_text(encoding="utf-8")) or {}
    CALENDARS = [
        CalendarConfig(name=c["name"], color=_normalize_color(c.get("color")), url=c["url"])
        for c in CONFIG.get("calendars", [])
    ]
    if not CALENDARS:
        log.warning("config.yaml no tiene calendarios configurados.")


def _window() -> "tuple[dt.date, dt.date]":
    today = dt.datetime.now(LOCAL_TZ).date()
    past = int(CONFIG.get("window_past_days", 35))
    future = int(CONFIG.get("window_future_days", 400))
    return today - dt.timedelta(days=past), today + dt.timedelta(days=future)


async def refresh_once() -> None:
    """Refresca todos los calendarios. Conserva lo ultimo bueno si alguno falla."""
    global LAST_UPDATED
    start, end = _window()
    for cal in CALENDARS:
        try:
            raw = await fetch_ics(cal.url)
            events = parse_and_expand(raw, cal, start, end)
            LAST_GOOD[cal.name] = events
            STATUS[cal.name] = {
                "ok": True,
                "last_success": dt.datetime.now(LOCAL_TZ).isoformat(),
                "error": None,
                "count": len(events),
            }
            log.info("OK %s: %d eventos", cal.name, len(events))
        except Exception as exc:  # noqa: BLE001
            prev = STATUS.get(cal.name, {})
            kept = len(LAST_GOOD.get(cal.name, []))
            STATUS[cal.name] = {
                "ok": False,
                "last_success": prev.get("last_success"),
                "error": f"{type(exc).__name__}: {exc}",
                "count": kept,
            }
            log.warning("FALLO %s: %s (se mantienen %d eventos cacheados)", cal.name, exc, kept)
    LAST_UPDATED = dt.datetime.now(LOCAL_TZ)


async def _refresh_loop() -> None:
    interval = int(CONFIG.get("refresh_minutes", 10)) * 60
    while True:
        await asyncio.sleep(interval)
        try:
            await refresh_once()
        except Exception as exc:  # noqa: BLE001
            log.error("Error en el ciclo de refresco: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_config()
    try:
        await refresh_once()  # primera carga al arrancar
    except Exception as exc:  # noqa: BLE001
        log.error("Fallo en la carga inicial: %s", exc)
    global _refresh_task
    _refresh_task = asyncio.create_task(_refresh_loop())
    yield
    if _refresh_task:
        _refresh_task.cancel()


app = FastAPI(title="Family Wall Calendar", lifespan=lifespan)

# localhost / LAN, sin auth: CORS abierto a proposito (Vite dev + kiosk).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


def _all_events() -> list[dict]:
    out: list[dict] = []
    for events in LAST_GOOD.values():
        out.extend(events)
    return out


def _public(ev: dict) -> dict:
    return {k: v for k, v in ev.items() if not k.startswith("_")}


@app.get("/")
def root():
    return {
        "service": "Family Wall Calendar backend",
        "endpoints": ["/events?from=YYYY-MM-DD&to=YYYY-MM-DD", "/health"],
        "calendars": [c.name for c in CALENDARS],
        "last_updated": LAST_UPDATED.isoformat() if LAST_UPDATED else None,
    }


@app.get("/health")
def health():
    return {
        "status": "ok" if any(s.get("ok") for s in STATUS.values()) else "degraded",
        "last_updated": LAST_UPDATED.isoformat() if LAST_UPDATED else None,
        "calendars": STATUS,
    }


@app.get("/events")
def get_events(
    from_: "str | None" = Query(default=None, alias="from"),
    to: "str | None" = Query(default=None),
):
    today = dt.datetime.now(LOCAL_TZ).date()
    start_d = dt.date.fromisoformat(from_) if from_ else today - dt.timedelta(days=7)
    end_d = dt.date.fromisoformat(to) if to else today + dt.timedelta(days=400)

    win_start = _as_midnight(start_d)
    win_end = _as_midnight(end_d) + dt.timedelta(days=1)  # 'to' inclusivo (hasta fin de dia)

    result = []
    for ev in _all_events():
        # Solapa el rango si empieza antes del fin y termina despues del inicio.
        if ev["_start_cmp"] < win_end and ev["_end_cmp"] > win_start:
            result.append(_public(ev))

    result.sort(key=lambda e: (e["start"], e["title"]))
    return {
        "events": result,
        "count": len(result),
        "from": start_d.isoformat(),
        "to": end_d.isoformat(),
        "last_updated": LAST_UPDATED.isoformat() if LAST_UPDATED else None,
    }


def _as_midnight(d: dt.date) -> dt.datetime:
    return dt.datetime(d.year, d.month, d.day, tzinfo=LOCAL_TZ)
