"""Pruebas de actualización y recuperación sin iCloud, launchd ni Chrome reales."""

import contextlib
import functools
from http.server import ThreadingHTTPServer
import os
from pathlib import Path
import tempfile
import threading
import time
import unittest
from unittest.mock import Mock, patch
from urllib.error import HTTPError
from urllib.request import urlopen

import calendar_kiosk as kiosk


class KioskTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.state = Path(self.directory.name).resolve()
        (self.state / "logs").mkdir()
        (self.state / "releases").mkdir()
        self.active = {"revision": "a" * 40, "release": "aaaaaaaaaaaa-11111111"}
        self.candidate = {"revision": "b" * 40, "release": "bbbbbbbbbbbb-22222222"}
        kiosk.write_json(self.state / "active.json", self.active)
        kiosk.write_json(self.state / "settings.json", {
            "branch": "main", "python": "/python with spaces/python3",
            "npm": "/usr/local/bin/npm", "path": "/usr/local/bin:/usr/bin:/bin",
        })

    def supervisor(self):
        supervisor = kiosk.Supervisor(self.state)
        self.addCleanup(supervisor.output.close)
        supervisor.start_services = Mock()
        supervisor.start_browser = Mock()
        supervisor.recover_browser = Mock()
        supervisor.services_ready = Mock(return_value=True)
        return supervisor

    @contextlib.contextmanager
    def update_mocks(self, revision=None):
        with patch.object(kiosk, "lock", return_value=contextlib.nullcontext()), \
             patch.object(kiosk, "command", return_value=revision or self.candidate["revision"]), \
             patch.object(kiosk, "prune_releases"), \
             patch.object(kiosk, "prepare", return_value=self.candidate) as prepare:
            yield prepare

    def test_failed_build_preserves_active_and_private_config(self):
        config = self.state / "config.yaml"
        config.write_text("private calendar data", encoding="utf-8")
        with self.update_mocks() as prepare:
            prepare.side_effect = RuntimeError("build failed")
            with self.assertRaisesRegex(RuntimeError, "build failed"):
                kiosk.update(self.state)
        self.assertEqual(kiosk.read_json(self.state / "active.json"), self.active)
        self.assertFalse((self.state / "pending.json").exists())
        self.assertEqual(config.read_text(), "private calendar data")

    def test_update_only_publishes_candidate(self):
        with self.update_mocks():
            kiosk.update(self.state)
        self.assertEqual(kiosk.read_json(self.state / "active.json"), self.active)
        self.assertEqual(kiosk.read_json(self.state / "pending.json"), self.candidate)

    def test_same_revision_does_not_build(self):
        with self.update_mocks(self.active["revision"]) as prepare:
            kiosk.update(self.state)
            prepare.assert_not_called()

    def test_rejected_revision_requires_explicit_retry(self):
        kiosk.write_json(self.state / "rejected.json", {**self.candidate, "failed_at": time.time()})
        with self.update_mocks() as prepare:
            kiosk.update(self.state)
            prepare.assert_not_called()
            kiosk.update(self.state, retry=True)
            prepare.assert_called_once()

    def test_failed_revision_is_retried_after_cooldown(self):
        kiosk.write_json(self.state / "rejected.json", {
            **self.candidate, "failed_at": time.time() - 3601,
        })
        with self.update_mocks() as prepare:
            kiosk.update(self.state)
            prepare.assert_called_once()

    def test_pause_defers_even_downloading_an_update(self):
        kiosk.write_json(self.state / "pause.json", {"until": time.time() + 1800})
        with self.update_mocks() as prepare, patch.object(kiosk, "command") as command:
            kiosk.update(self.state)
            prepare.assert_not_called()
            command.assert_not_called()

    def test_pruning_preserves_active_and_ignores_unmanaged_directories(self):
        (self.state / "releases" / self.active["release"]).mkdir()
        old = "cccccccccccc-33333333"
        (self.state / "releases" / old).mkdir()
        (self.state / "releases" / "user-data").mkdir()
        for index in range(3):
            path = self.state / "releases" / f"dddddddddddd-{index:08x}"
            path.mkdir()
            # Hacer el orden independiente de la precisión temporal del filesystem.
            os.utime(path, (time.time() + index + 10, time.time() + index + 10))
        with patch.object(kiosk, "command") as command:
            kiosk.prune_releases(self.state)
        command.assert_called_once()
        self.assertEqual(command.call_args.args[0][-1], self.state / "releases" / old)

    def test_network_failure_does_not_replace_running_version(self):
        with self.update_mocks(), patch.object(kiosk, "command", side_effect=RuntimeError("offline")):
            with self.assertRaises(RuntimeError):
                kiosk.update(self.state)
        self.assertEqual(kiosk.read_json(self.state / "active.json"), self.active)
        self.assertFalse((self.state / "pending.json").exists())

    def test_healthy_candidate_is_committed_and_browser_reloaded(self):
        kiosk.write_json(self.state / "pending.json", self.candidate)
        supervisor = self.supervisor()
        supervisor.tick()
        self.assertEqual(kiosk.read_json(self.state / "active.json"), self.candidate)
        self.assertEqual(kiosk.read_json(self.state / "previous.json"), self.active)
        self.assertFalse((self.state / "pending.json").exists())
        supervisor.start_browser.assert_called_once()

    def test_unhealthy_candidate_rolls_back_without_marking_it_active(self):
        kiosk.write_json(self.state / "pending.json", self.candidate)
        supervisor = self.supervisor()
        supervisor.services_ready.return_value = False
        supervisor.started = time.monotonic() - 300
        for _ in range(3):
            supervisor.tick()
        self.assertEqual(kiosk.read_json(self.state / "active.json"), self.active)
        self.assertEqual(kiosk.read_json(self.state / "rejected.json")["revision"], self.candidate["revision"])
        supervisor.start_services.assert_called_with(self.active)
        self.assertFalse((self.state / "pending.json").exists())

    def test_spawn_failure_restores_previous_services(self):
        kiosk.write_json(self.state / "pending.json", self.candidate)
        supervisor = self.supervisor()
        supervisor.start_services.side_effect = [OSError("cannot start"), None]
        with self.assertRaises(OSError):
            supervisor.tick()
        supervisor.start_services.assert_called_with(self.active)
        self.assertIsNone(supervisor.candidate)
        self.assertEqual(kiosk.read_json(self.state / "active.json"), self.active)

    def test_maintenance_stops_browser_and_defers_updates(self):
        kiosk.write_json(self.state / "pending.json", self.candidate)
        kiosk.write_json(self.state / "pause.json", {"until": time.time() + 1800})
        supervisor = self.supervisor()
        supervisor.chrome = Mock()
        with patch.object(kiosk, "stop") as stop:
            supervisor.tick()
            stop.assert_called_once()
        supervisor.start_services.assert_not_called()
        supervisor.start_browser.assert_not_called()
        supervisor.recover_browser.assert_not_called()
        self.assertIsNone(supervisor.chrome)

    def test_expired_pause_reopens_browser(self):
        kiosk.write_json(self.state / "pause.json", {"until": time.time() - 1})
        supervisor = self.supervisor()
        supervisor.tick()
        supervisor.start_browser.assert_called_once()

    def test_focus_targets_owned_chrome_pid(self):
        supervisor = self.supervisor()
        supervisor.chrome = Mock(pid=1234)
        supervisor.chrome.poll.return_value = None
        with patch.object(kiosk, "fetch_json", return_value=[{
            "type": "page", "url": kiosk.WEB_URL, "id": "calendar",
        }]), patch.object(kiosk, "urlopen"), patch.object(kiosk, "command") as command:
            kiosk.Supervisor.recover_browser(supervisor)
        self.assertIn("runningApplicationWithProcessIdentifier(1234)", command.call_args.args[0][-1])

    def test_chrome_not_yet_registered_is_not_a_supervision_error(self):
        # Justo tras arrancar Chrome, AppKit todavía no conoce el PID: reintentar en silencio.
        supervisor = self.supervisor()
        supervisor.chrome = Mock(pid=1234)
        supervisor.chrome.poll.return_value = None
        with patch.object(kiosk, "fetch_json", return_value=[{
            "type": "page", "url": kiosk.WEB_URL, "id": "calendar",
        }]), patch.object(kiosk, "urlopen"), patch.object(kiosk, "command", return_value="ausente"), \
                patch.object(kiosk.LOG, "warning") as warning:
            kiosk.Supervisor.recover_browser(supervisor)
        warning.assert_not_called()
        self.assertEqual(supervisor.focus_failures, 0)

    def test_rejected_focus_warns_once_before_repeating(self):
        supervisor = self.supervisor()
        supervisor.chrome = Mock(pid=1234)
        supervisor.chrome.poll.return_value = None
        with patch.object(kiosk, "fetch_json", return_value=[{
            "type": "page", "url": kiosk.WEB_URL, "id": "calendar",
        }]), patch.object(kiosk, "urlopen"), patch.object(kiosk, "command", return_value="rechazada"), \
                patch.object(kiosk.LOG, "warning") as warning:
            for _ in range(30):
                kiosk.Supervisor.recover_browser(supervisor)
        self.assertEqual(warning.call_count, 1)
        self.assertEqual(supervisor.focus_failures, 30)

    def test_recovered_focus_clears_previous_rejections(self):
        supervisor = self.supervisor()
        supervisor.chrome = Mock(pid=1234)
        supervisor.chrome.poll.return_value = None
        supervisor.focus_failures = 7
        with patch.object(kiosk, "fetch_json", return_value=[{
            "type": "page", "url": kiosk.WEB_URL, "id": "calendar",
        }]), patch.object(kiosk, "urlopen"), patch.object(kiosk, "command", return_value="recuperada"):
            kiosk.Supervisor.recover_browser(supervisor)
        self.assertEqual(supervisor.focus_failures, 0)

    def test_missing_browser_window_is_recreated_after_three_failures(self):
        supervisor = self.supervisor()
        supervisor.chrome = Mock()
        supervisor.chrome.poll.return_value = None
        supervisor.browser_started = time.monotonic() - 60
        with patch.object(kiosk, "fetch_json", return_value=[]), patch.object(kiosk, "command"):
            for _ in range(3):
                kiosk.Supervisor.recover_browser(supervisor)
        supervisor.start_browser.assert_called_once()

    def test_degraded_feed_is_not_a_service_crash(self):
        with patch.object(kiosk, "fetch_json", return_value={"status": "degraded", "calendars": {}}):
            self.assertTrue(kiosk.api_ready())

    def test_release_cannot_escape_managed_directory(self):
        for name in ("../private", "", "nested/path", str(self.state / "private")):
            with self.assertRaises(ValueError):
                kiosk.release_path(self.state, name)

    def test_launch_agent_keeps_paths_with_spaces_as_single_arguments(self):
        run = kiosk.agent_definition(self.state, "run")
        update = kiosk.agent_definition(self.state, "update")
        self.assertEqual(run["ProgramArguments"][0], "/python with spaces/python3")
        self.assertEqual(run["ProgramArguments"][-1], str(self.state))
        self.assertTrue(run["KeepAlive"])
        self.assertEqual(update["StartInterval"], 300)
        self.assertNotIn("KeepAlive", update)

    def test_static_server_serves_build_without_cache_or_directory_listing(self):
        (self.state / "index.html").write_text('<div id="root"></div>', encoding="utf-8")
        (self.state / "empty").mkdir()
        handler = functools.partial(kiosk.StaticHandler, directory=str(self.state))
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            base = f"http://127.0.0.1:{server.server_port}"
            with urlopen(base) as response:
                self.assertIn(b'id="root"', response.read())
                self.assertEqual(response.headers["Cache-Control"], "no-store")
            with self.assertRaises(HTTPError) as caught:
                urlopen(base + "/empty/")
            self.assertEqual(caught.exception.code, 404)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
