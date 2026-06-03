"""
Descarga, parseo y expansion de los calendarios iCloud (feeds ICS publicos).

- Convierte webcal:// -> https:// para poder descargar.
- Parsea el ICS con `icalendar`.
- Expande eventos recurrentes (RRULE/RDATE/EXDATE y ediciones) con
  `recurring-ical-events`, que es justo lo que `icalendar` por si solo NO hace.
- Normaliza cada ocurrencia a un dict sencillo para el frontend.
"""
from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from zoneinfo import ZoneInfo

import httpx
import icalendar
import recurring_ical_events

# Zona horaria local del salon (eventos all-day se anclan a su medianoche).
LOCAL_TZ = ZoneInfo("Europe/Madrid")


@dataclass
class CalendarConfig:
    name: str
    color: str
    url: str


def _to_https(url: str) -> str:
    """iCloud da URLs webcal://; se descargan igual por https://."""
    if url.startswith("webcal://"):
        return "https://" + url[len("webcal://"):]
    return url


async def fetch_ics(url: str, timeout: float = 20.0) -> bytes:
    """Descarga el cuerpo del feed ICS. Lanza excepcion si falla."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
        resp = await client.get(
            _to_https(url),
            headers={"User-Agent": "family-wall-calendar/1.0"},
        )
        resp.raise_for_status()
        return resp.content


def _as_cmp_datetime(value: "dt.date | dt.datetime") -> dt.datetime:
    """Convierte date|datetime a datetime tz-aware para poder comparar de forma homogenea."""
    if isinstance(value, dt.datetime):
        return value if value.tzinfo is not None else value.replace(tzinfo=LOCAL_TZ)
    return dt.datetime(value.year, value.month, value.day, tzinfo=LOCAL_TZ)


def _normalize_event(component, cal: CalendarConfig) -> dict:
    start = component.get("DTSTART").dt
    dtend_prop = component.get("DTEND")
    end = dtend_prop.dt if dtend_prop is not None else None

    all_day = isinstance(start, dt.date) and not isinstance(start, dt.datetime)

    if all_day:
        start_date = start
        if end is not None and isinstance(end, dt.date) and not isinstance(end, dt.datetime):
            end_date = end
        elif end is not None:
            end_date = end.date()
        else:
            end_date = start_date + dt.timedelta(days=1)
        if end_date <= start_date:
            end_date = start_date + dt.timedelta(days=1)
        # En all-day, iCal usa DTEND exclusivo (el dia siguiente al ultimo).
        multi_day = (end_date - start_date).days > 1
        start_out = start_date.isoformat()        # YYYY-MM-DD
        end_out = end_date.isoformat()            # YYYY-MM-DD (exclusivo, convencion iCal)
        start_cmp = _as_cmp_datetime(start_date)
        end_cmp = _as_cmp_datetime(end_date)
    else:
        s = _as_cmp_datetime(start)
        e = _as_cmp_datetime(end) if end is not None else s
        if e < s:
            e = s
        multi_day = s.date() != e.date()
        start_out = s.isoformat()
        end_out = e.isoformat()
        start_cmp, end_cmp = s, e

    summary = component.get("SUMMARY")
    location = component.get("LOCATION")
    uid = str(component.get("UID", ""))

    return {
        "id": f"{uid}-{start_out}",
        "uid": uid,
        "calendar": cal.name,
        "color": cal.color,
        "title": str(summary) if summary is not None else "(sin titulo)",
        "location": str(location) if location else None,
        "all_day": all_day,
        "multi_day": multi_day,
        "start": start_out,
        "end": end_out,
        # Campos internos para filtrar por rango. Se eliminan antes de serializar.
        "_start_cmp": start_cmp,
        "_end_cmp": end_cmp,
    }


def parse_and_expand(
    ics_bytes: bytes,
    cal: CalendarConfig,
    start: dt.date,
    end: dt.date,
) -> list[dict]:
    """Parsea el ICS y expande las ocurrencias que solapan [start, end)."""
    calendar = icalendar.Calendar.from_ical(ics_bytes)
    occurrences = recurring_ical_events.of(calendar).between(start, end)
    events: list[dict] = []
    for comp in occurrences:
        try:
            events.append(_normalize_event(comp, cal))
        except Exception:
            # Un evento malformado no debe tumbar el feed entero.
            continue
    return events
