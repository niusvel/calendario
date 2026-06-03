"""
Test de humo SIN red: valida que el parseo + expansion de recurrencias funciona.

Cubre:
- Evento semanal (RRULE COUNT=5) con un EXDATE -> deben salir 4 ocurrencias.
- Evento all-day de 3 dias -> all_day=True, multi_day=True.
- Evento puntual con hora.

Ejecutar:  python test_smoke.py
"""
import datetime as dt

from calendar_source import CalendarConfig, parse_and_expand

ICS = b"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//test//test//EN
BEGIN:VEVENT
UID:weekly-1
DTSTART;TZID=Europe/Madrid:20260601T090000
DTEND;TZID=Europe/Madrid:20260601T100000
RRULE:FREQ=WEEKLY;COUNT=5
EXDATE;TZID=Europe/Madrid:20260615T090000
SUMMARY:Clase semanal
END:VEVENT
BEGIN:VEVENT
UID:allday-1
DTSTART;VALUE=DATE:20260610
DTEND;VALUE=DATE:20260613
SUMMARY:Viaje
END:VEVENT
BEGIN:VEVENT
UID:single-1
DTSTART;TZID=Europe/Madrid:20260620T180000
DTEND;TZID=Europe/Madrid:20260620T190000
SUMMARY:Cena
END:VEVENT
END:VCALENDAR
"""

cal = CalendarConfig(name="Test", color="#E91E63", url="local")
events = parse_and_expand(ICS, cal, dt.date(2026, 6, 1), dt.date(2026, 7, 1))

weekly = sorted(e["start"] for e in events if e["uid"] == "weekly-1")
allday = [e for e in events if e["uid"] == "allday-1"]
single = [e for e in events if e["uid"] == "single-1"]

print(f"Total eventos: {len(events)}")
print(f"Ocurrencias semanales: {weekly}")
print(f"All-day: {allday[0] if allday else None}")

# --- Asserts ---
assert len(weekly) == 4, f"Esperaba 4 ocurrencias (5 - 1 EXDATE), salieron {len(weekly)}"
assert all("2026-06-15" not in s for s in weekly), "El EXDATE del 15 no se respeto"
assert [s[:10] for s in weekly] == ["2026-06-01", "2026-06-08", "2026-06-22", "2026-06-29"], \
    f"Fechas semanales inesperadas: {weekly}"

assert len(allday) == 1, "Falta el evento all-day"
assert allday[0]["all_day"] is True
assert allday[0]["multi_day"] is True, "El viaje de 3 dias deberia ser multi_day"

assert len(single) == 1, "Falta el evento puntual"
assert single[0]["all_day"] is False

assert len(events) == 6, f"Esperaba 6 eventos en total, salieron {len(events)}"

print("\nOK - expansion de recurrencias, EXDATE, all-day y multi-dia correctos.")
