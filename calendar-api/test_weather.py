import datetime as dt
import unittest

from calendar_source import LOCAL_TZ
from weather import build_url, summarize

RAW = {
    "current": {"time": "2026-09-09T09:00", "temperature_2m": 20.7, "weather_code": 2, "precipitation": 0.0, "is_day": 1},
    "hourly": {
        "time": [f"2026-09-09T{h:02d}:00" for h in range(24)] + [f"2026-09-10T{h:02d}:00" for h in range(24)],
        "temperature_2m": [20 + (h % 5) for h in range(48)],
        "precipitation_probability": [h * 2 for h in range(48)],
        "weather_code": [61] * 12 + [3] * 36,
        "is_day": [1 if 8 <= (h % 24) <= 20 else 0 for h in range(48)],
    },
    "daily": {
        "time": ["2026-09-09", "2026-09-10"],
        "weather_code": [61, 3],
        "temperature_2m_max": [21.0, 21.4],
        "temperature_2m_min": [19.0, 16.6],
        "precipitation_probability_max": [98, 45],
        "sunrise": ["2026-09-09T07:40", "2026-09-10T07:42"],
        "sunset": ["2026-09-09T20:29", "2026-09-10T20:27"],
    },
}
NOW = dt.datetime(2026, 9, 9, 9, 25, tzinfo=LOCAL_TZ)


class WeatherTests(unittest.TestCase):
    def test_la_url_pide_lo_justo_en_hora_local(self):
        url = build_url(43.3183, -1.9812)
        self.assertIn("latitude=43.3183", url)
        self.assertIn("timezone=Europe%2FMadrid", url)
        self.assertIn("daily=weather_code", url)

    def test_las_horas_empiezan_en_la_hora_en_curso(self):
        summary = summarize(RAW, NOW, "Donostia")
        self.assertEqual(summary["hourly"][0]["time"], "2026-09-09T09:00")
        self.assertEqual(len(summary["hourly"]), 18)
        self.assertEqual(summary["hourly"][0]["rain"], 18)

    def test_los_dias_llevan_maxima_minima_y_sol(self):
        day = summarize(RAW, NOW, "Donostia")["daily"][0]
        self.assertEqual((day["tmax"], day["tmin"], day["rain"]), (21.0, 19.0, 98))
        self.assertEqual((day["sunrise"], day["sunset"]), ("07:40", "20:29"))

    def test_el_ahora_se_conserva_con_su_codigo(self):
        current = summarize(RAW, NOW, "Donostia")["current"]
        self.assertEqual((current["temp"], current["code"], current["is_day"]), (20.7, 2, True))


if __name__ == "__main__":
    unittest.main()
