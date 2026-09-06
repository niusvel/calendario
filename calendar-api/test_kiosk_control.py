"""Pruebas HTTP de la pausa, sin iCloud ni procesos de macOS."""

import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import Mock, patch

from fastapi import HTTPException
from fastapi.testclient import TestClient

import kiosk_control
from main import app


class KioskControlTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.state = Path(self.directory.name).resolve()
        self.headers = {"Origin": kiosk_control.KIOSK_ORIGIN, "X-Calendar-Kiosk": "1"}
        # No entrar en el contexto del lifespan: estas pruebas no descargan feeds.
        self.client = TestClient(app, base_url="http://127.0.0.1:8000", client=("127.0.0.1", 12345))
        self.addCleanup(self.client.close)

    def test_local_shortcut_writes_the_existing_supervisor_pause_protocol(self):
        with patch.object(kiosk_control, "state_directory", return_value=self.state):
            before = time.time()
            response = self.client.post("/kiosk/pause", headers=self.headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"paused": True, "minutes": 30})
        pause = json.loads((self.state / "pause.json").read_text())
        self.assertGreaterEqual(pause["until"], before + 1800)
        self.assertLessEqual(pause["until"], time.time() + 1800)
        self.assertEqual([path.name for path in self.state.iterdir()], ["pause.json"])

    def test_preflight_allows_the_local_shortcut(self):
        response = self.client.options("/kiosk/pause", headers={
            "Origin": kiosk_control.KIOSK_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "x-calendar-kiosk",
        })
        self.assertEqual(response.status_code, 200)
        self.assertIn("POST", response.headers["access-control-allow-methods"])

    def test_other_websites_missing_headers_and_wrong_host_cannot_pause(self):
        cases = [
            {**self.headers, "Origin": "https://example.com"},
            {"X-Calendar-Kiosk": "1"},
            {"Origin": kiosk_control.KIOSK_ORIGIN},
            {**self.headers, "Host": "example.com:8000"},
        ]
        with patch.object(kiosk_control, "state_directory") as state:
            for headers in cases:
                with self.subTest(headers=headers):
                    response = self.client.post("/kiosk/pause", headers=headers)
                    self.assertEqual(response.status_code, 403)
            state.assert_not_called()

    def test_lan_client_cannot_pause(self):
        client = TestClient(app, base_url="http://127.0.0.1:8000", client=("192.168.1.20", 12345))
        self.addCleanup(client.close)
        response = client.post("/kiosk/pause", headers=self.headers)
        self.assertEqual(response.status_code, 403)

    def test_get_cannot_pause(self):
        response = self.client.get("/kiosk/pause", headers=self.headers)
        self.assertEqual(response.status_code, 405)
        self.assertFalse((self.state / "pause.json").exists())

    def test_unmanaged_api_reports_unavailable(self):
        with patch("main.CONFIG_PATH", self.state / "config.yaml"):
            response = self.client.post("/kiosk/pause", headers=self.headers)
        self.assertEqual(response.status_code, 503)

    def test_write_failure_is_reported_instead_of_claiming_a_pause(self):
        with patch.object(kiosk_control, "state_directory", return_value=self.state), \
             patch.object(kiosk_control.tempfile, "NamedTemporaryFile", side_effect=PermissionError):
            response = self.client.post("/kiosk/pause", headers=self.headers)
        self.assertEqual(response.status_code, 503)
        self.assertFalse((self.state / "pause.json").exists())

    def test_configuration_link_must_belong_to_active_release(self):
        release = self.state / "releases" / "abc123-release"
        release.mkdir(parents=True)
        (self.state / "calendar_kiosk.py").touch()
        (self.state / "active.json").write_text(json.dumps({"release": release.name}))
        config = Mock()
        config.is_symlink.return_value = True
        config.resolve.return_value = self.state / "config.yaml"
        config.absolute.return_value = release / "calendar-api/config.yaml"
        self.assertEqual(kiosk_control.state_directory(config), self.state)
        (self.state / "active.json").write_text(json.dumps({"release": "another-release"}))
        with self.assertRaises(HTTPException) as caught:
            kiosk_control.state_directory(config)
        self.assertEqual(caught.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
