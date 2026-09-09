"""
Prevision meteorologica para la pantalla, via Open-Meteo (gratis, sin clave).

Se reduce la respuesta a lo que la pared necesita: el ahora, las proximas horas
y los proximos dias. Los codigos de tiempo (WMO) se traducen a icono en el
frontend, que es quien decide como pintarlos.
"""
from __future__ import annotations

import datetime as dt
from urllib.parse import urlencode

import httpx

from calendar_source import LOCAL_TZ

API = "https://api.open-meteo.com/v1/forecast"
HOURS_AHEAD = 18


def build_url(latitude: float, longitude: float) -> str:
    query = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,weather_code,precipitation,is_day",
        "hourly": "temperature_2m,precipitation_probability,weather_code,is_day",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset",
        "timezone": "Europe/Madrid",
        "forecast_days": 8,
    }
    return f"{API}?{urlencode(query)}"


async def fetch_forecast(latitude: float, longitude: float, timeout: float = 15.0) -> dict:
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(build_url(latitude, longitude), headers={"User-Agent": "family-wall-calendar/1.0"})
        response.raise_for_status()
        return response.json()


def summarize(raw: dict, now: dt.datetime, place: str) -> dict:
    """Recorta el pronostico: desde la hora en curso hasta HOURS_AHEAD horas, y los dias."""
    current = raw["current"]
    hourly = raw["hourly"]
    daily = raw["daily"]
    floor = now.replace(minute=0, second=0, microsecond=0)
    hours = []
    for index, stamp in enumerate(hourly["time"]):
        when = dt.datetime.fromisoformat(stamp).replace(tzinfo=LOCAL_TZ)
        if when < floor or len(hours) >= HOURS_AHEAD:
            continue
        hours.append({
            "time": stamp,
            "temp": hourly["temperature_2m"][index],
            "code": hourly["weather_code"][index],
            "rain": hourly["precipitation_probability"][index],
            "is_day": bool(hourly["is_day"][index]),
        })
    days = [
        {
            "date": daily["time"][index],
            "code": daily["weather_code"][index],
            "tmax": daily["temperature_2m_max"][index],
            "tmin": daily["temperature_2m_min"][index],
            "rain": daily["precipitation_probability_max"][index],
            "sunrise": daily["sunrise"][index][11:16],
            "sunset": daily["sunset"][index][11:16],
        }
        for index in range(len(daily["time"]))
    ]
    return {
        "place": place,
        "updated": now.isoformat(),
        "current": {
            "temp": current["temperature_2m"],
            "code": current["weather_code"],
            "precipitation": current["precipitation"],
            "is_day": bool(current["is_day"]),
        },
        "hourly": hours,
        "daily": days,
    }
