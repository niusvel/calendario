"""El calendario laboral de Euskadi mezcla cientos de municipios y marca los dias
con una hora simbolica: el parser debe quedarse con lo local y tratarlo como dia."""

import datetime as dt
import unittest

from calendar_source import CalendarConfig, parse_and_expand

FEED = b"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//prueba//ES
BEGIN:VEVENT
UID:cae-1
DTSTAMP:20260101T000000Z
DTSTART:20260319T000001
SUMMARY:San Jose / San Joseren eguna
LOCATION:CAE / EAE
END:VEVENT
BEGIN:VEVENT
UID:gip-1
DTSTAMP:20260101T000000Z
DTSTART:20260731T000001
SUMMARY:San Ignacio / San Inazio
LOCATION:Gipuzkoa / Gipuzkoa
END:VEVENT
BEGIN:VEVENT
UID:don-1
DTSTAMP:20260101T000000Z
DTSTART:20260120T000001
SUMMARY:San Sebastian / Sebastian Deuna
LOCATION:Donostia-San Sebastian / Donostia-San Sebastian
END:VEVENT
BEGIN:VEVENT
UID:bil-1
DTSTAMP:20260101T000000Z
DTSTART:20260822T000001
SUMMARY:Fiesta local / Tokiko jai-eguna
LOCATION:Bilbao / Bilbao
END:VEVENT
BEGIN:VEVENT
UID:cita-1
DTSTAMP:20260101T000000Z
DTSTART:20260305T000000
DTEND:20260305T010000
SUMMARY:Turno de madrugada
LOCATION:Bilbao / Bilbao
END:VEVENT
END:VCALENDAR
"""

WINDOW = (dt.date(2026, 1, 1), dt.date(2026, 12, 31))


class HolidayFeedTests(unittest.TestCase):
    def events(self, **fields):
        cal = CalendarConfig(name="FESTIVOS", color="#a8433b", url="https://x/y.ics", **fields)
        return parse_and_expand(FEED, cal, *WINDOW)

    def test_sin_filtro_entra_todo(self):
        self.assertEqual(len(self.events()), 5)

    def test_el_filtro_deja_comunidad_territorio_y_municipio(self):
        titles = sorted(e["title"] for e in self.events(include_locations=("CAE / EAE", "Gipuzkoa", "Donostia")))
        self.assertEqual(titles, ["San Ignacio / San Inazio", "San Jose / San Joseren eguna", "San Sebastian / Sebastian Deuna"])

    def test_el_filtro_no_distingue_mayusculas(self):
        self.assertEqual([e["uid"] for e in self.events(include_locations=("bilbao",))], ["bil-1", "cita-1"])

    def test_hora_simbolica_sin_fin_es_un_dia_completo(self):
        event = next(e for e in self.events() if e["uid"] == "cae-1")
        self.assertTrue(event["all_day"])
        self.assertEqual((event["start"], event["end"]), ("2026-03-19", "2026-03-20"))

    def test_una_cita_real_a_medianoche_con_fin_sigue_siendo_cita(self):
        event = next(e for e in self.events() if e["uid"] == "cita-1")
        self.assertFalse(event["all_day"])
        self.assertTrue(event["start"].startswith("2026-03-05T00:00:00"))


if __name__ == "__main__":
    unittest.main()
