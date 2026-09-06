"""Instalación, supervisión y actualizaciones del calendario en macOS (Python 3.10+)."""

from __future__ import annotations

import argparse
import contextlib
import functools
import json
import logging
import logging.handlers
import os
from pathlib import Path
import plistlib
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import URLError
from urllib.request import urlopen
import uuid

DEFAULT_STATE = Path.home() / "Library/Application Support/FamilyCalendar"
CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")
LABEL = "local.family-calendar"
WEB_URL = "http://127.0.0.1:5173"
API_URL = "http://127.0.0.1:8000"
DEBUG_URL = "http://127.0.0.1:9223"
LOG = logging.getLogger("calendar-kiosk")


def read_json(path: Path, default=None):
    """Lee estado persistente; un archivo ausente devuelve el valor por defecto."""
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else default


def write_json(path: Path, value) -> None:
    """Publica un documento completo mediante reemplazo atómico."""
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}")
    temporary.write_text(json.dumps(value, indent=2), encoding="utf-8")
    temporary.replace(path)


@contextlib.contextmanager
def lock(state: Path, name: str):
    """Evita supervisores o actualizadores duplicados; macOS libera el lock al salir."""
    import fcntl

    with (state / f"{name}.lock").open("w") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def command(args: list, cwd: Path | None = None, timeout: int = 600) -> str:
    """Ejecuta sin shell, sin preguntas de Git y con tiempo máximo."""
    env = dict(os.environ, GIT_TERMINAL_PROMPT="0", GIT_SSH_COMMAND="ssh -oBatchMode=yes")
    result = subprocess.run(
        [str(arg) for arg in args], cwd=cwd, env=env, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=timeout,
    )
    if result.returncode:
        # La salida puede contener URLs privadas: los logs quedan en el directorio privado.
        LOG.error("Falló %s: %s", Path(args[0]).name, result.stdout[-4000:])
        raise RuntimeError(f"Falló {Path(args[0]).name}; consulta los logs del kiosco")
    return result.stdout.strip()


def fetch_json(url: str):
    """Consulta un servicio local con timeout corto."""
    with urlopen(url, timeout=2) as response:
        return json.load(response)


def api_ready(url: str = API_URL) -> bool:
    """Distingue una API accesible de la disponibilidad de Internet/iCloud."""
    try:
        data = fetch_json(url + "/health")
        return data.get("status") in {"ok", "degraded"} and isinstance(data.get("calendars"), dict)
    except (OSError, URLError, ValueError, AttributeError):
        return False


def port_available(port: int) -> bool:
    """Comprueba puertos sin detener procesos ajenos al supervisor."""
    with socket.socket() as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("127.0.0.1", port))
            return True
        except OSError:
            return False


def stop(process: subprocess.Popen | None) -> None:
    """Detiene únicamente un proceso creado por este supervisor."""
    if process is None or process.poll() is not None:
        return
    process.terminate()
    try:
        process.wait(timeout=8)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait(timeout=5)


def release_path(state: Path, release: str) -> Path:
    """Acepta solo directorios de versión dentro del almacén administrado."""
    root = (state / "releases").resolve()
    target = (root / release).resolve()
    if target.parent != root or not release or target == root:
        raise ValueError("Ruta de versión no válida")
    return target


def prune_releases(state: Path) -> None:
    """Conserva versiones referenciadas y tres recientes; elimina solo copias administradas."""
    protected = {
        read_json(state / f"{name}.json", {}).get("release")
        for name in ("active", "previous", "pending")
    }
    releases = sorted(
        (path for path in (state / "releases").iterdir()
         if path.is_dir() and re.fullmatch(r"[0-9a-f]{12}-[0-9a-f]{8}", path.name)),
        key=lambda path: path.stat().st_mtime, reverse=True,
    )
    protected.update(path.name for path in releases[:3])
    for path in releases:
        if path.name not in protected:
            target = release_path(state, path.name)
            command(["git", "--git-dir", state / "repository.git", "worktree", "remove", "--force", target])


def start_api(release: Path, port: int, output) -> subprocess.Popen:
    """Arranca la API con el entorno virtual de su propia versión."""
    return subprocess.Popen(
        [str(release / ".venv/bin/python"), "-m", "uvicorn", "main:app",
         "--host", "127.0.0.1", "--port", str(port)],
        cwd=release / "calendar-api", stdout=output, stderr=subprocess.STDOUT,
    )


def prepare(state: Path, revision: str) -> dict:
    """Construye y comprueba una versión aislada antes de ofrecerla al supervisor."""
    print(f"Preparando versión {revision[:12]}...", flush=True)
    settings = read_json(state / "settings.json")
    name = f"{revision[:12]}-{uuid.uuid4().hex[:8]}"
    release = release_path(state, name)
    command(["git", "--git-dir", state / "repository.git", "worktree", "add", "--detach", release, revision])
    try:
        (release / "calendar-api/config.yaml").symlink_to(state / "config.yaml")
        print("Instalando dependencias de Python y comprobando el backend...", flush=True)
        command([settings["python"], "-m", "venv", release / ".venv"])
        python = release / ".venv/bin/python"
        command([python, "-m", "pip", "install", "-r", release / "calendar-api/requirements.txt"])
        command([python, "test_smoke.py"], cwd=release / "calendar-api")
        print("Instalando dependencias de Node y compilando la pantalla...", flush=True)
        command([settings["npm"], "ci", "--no-audit", "--no-fund"], cwd=release / "calendar-web")
        command([settings["npm"], "run", "build"], cwd=release / "calendar-web")
        index = release / "calendar-web/dist/index.html"
        if not index.is_file() or 'id="root"' not in index.read_text(encoding="utf-8"):
            raise RuntimeError("El build no contiene el punto de entrada del calendario")
        if not port_available(18000):
            raise RuntimeError("Puerto de comprobación 18000 ocupado")
        print("Comprobando el arranque de la API (hasta 4 minutos)...", flush=True)
        with (state / "logs/candidate.log").open("w") as output:
            process = start_api(release, 18000, output)
            try:
                deadline = time.monotonic() + 240
                while not api_ready("http://127.0.0.1:18000"):
                    if process.poll() is not None or time.monotonic() >= deadline:
                        raise RuntimeError("La API candidata no arrancó en 240 segundos")
                    time.sleep(1)
                events = fetch_json("http://127.0.0.1:18000/events")
                if not isinstance(events.get("events"), list):
                    raise RuntimeError("La API candidata no devuelve una lista de eventos")
            finally:
                stop(process)
        # Node solo se necesita durante la compilación, no para servir el kiosco.
        shutil.rmtree(release / "calendar-web/node_modules")
        return {"revision": revision, "release": name}
    except BaseException:
        command(["git", "--git-dir", state / "repository.git", "worktree", "remove", "--force", release])
        raise


def update(state: Path, retry: bool = False) -> None:
    """Descarga la rama elegida sin modificar el checkout de desarrollo."""
    with lock(state, "update"):
        if (state / "pending.json").exists() or paused(state):
            return
        settings = read_json(state / "settings.json")
        repository = state / "repository.git"
        command(["git", "--git-dir", repository, "fetch", "origin", f"refs/heads/{settings['branch']}"], timeout=120)
        revision = command(["git", "--git-dir", repository, "rev-parse", "FETCH_HEAD"])
        active = read_json(state / "active.json", {})
        rejected = read_json(state / "rejected.json", {})
        recently_rejected = time.time() - rejected.get("failed_at", 0) < 3600
        if revision == active.get("revision") or (
            revision == rejected.get("revision") and recently_rejected and not retry
        ):
            return
        # No retroceder silenciosamente por un force-push o un cambio de rama.
        if active:
            command(["git", "--git-dir", repository, "merge-base", "--is-ancestor", active["revision"], revision])
        LOG.info("Preparando actualización %s", revision[:12])
        try:
            candidate = prepare(state, revision)
        except Exception:
            write_json(state / "rejected.json", {"revision": revision, "failed_at": time.time()})
            raise
        write_json(state / "pending.json", candidate)
        LOG.info("Versión %s comprobada y pendiente de activación", revision[:12])
        prune_releases(state)


def paused(state: Path) -> bool:
    """Una pausa caduca automáticamente, incluso después de reiniciar el supervisor."""
    return read_json(state / "pause.json", {}).get("until", 0) > time.time()


class StaticHandler(SimpleHTTPRequestHandler):
    """Sirve exclusivamente el build local sin cachear respuestas antiguas."""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def list_directory(self, path):
        self.send_error(404)
        return None


def serve(directory: Path, port: int) -> None:
    """Servidor de archivos estáticos enlazado únicamente a localhost."""
    handler = functools.partial(StaticHandler, directory=str(directory))
    ThreadingHTTPServer(("127.0.0.1", port), handler).serve_forever()


class Supervisor:
    """Mantiene la versión activa y el navegador, recuperando fallos de procesos."""

    def __init__(self, state: Path) -> None:
        self.state = state
        self.active = read_json(state / "active.json")
        self.candidate = None
        self.api = None
        self.web = None
        self.chrome = None
        self.started = 0.0
        self.browser_started = 0.0
        self.failures = 0
        self.browser_failures = 0
        self.focus_failures = 0
        self.reloaded = False
        # El supervisor rota la salida de servicios al arrancar (el log principal rota en vivo).
        service_log = state / "logs/services.log"
        if service_log.exists() and service_log.stat().st_size > 5_000_000:
            service_log.replace(state / "logs/services.previous.log")
        self.output = (state / "logs/services.log").open("a")

    def start_services(self, version: dict) -> None:
        """Cambia ambos servicios juntos y deja visible el navegador mientras arrancan."""
        stop(self.api)
        stop(self.web)
        if not all(port_available(port) for port in (8000, 5173)):
            raise RuntimeError("8000/5173 ocupado: cierra dev.sh antes de iniciar el kiosco")
        release = release_path(self.state, version["release"])
        self.api = start_api(release, 8000, self.output)
        self.web = subprocess.Popen(
            [sys.executable, str(Path(__file__).resolve()), "serve", "--directory",
             str(release / "calendar-web/dist"), "--port", "5173"],
            stdout=self.output, stderr=subprocess.STDOUT,
        )
        self.started = time.monotonic()
        self.failures = 0
        self.reloaded = False

    def services_ready(self) -> bool:
        """Comprueba respuestas y procesos propios para no aceptar otro servidor por error."""
        if self.api.poll() is not None or self.web.poll() is not None or not api_ready():
            return False
        try:
            with urlopen(WEB_URL, timeout=2) as response:
                return b'id="root"' in response.read()
        except (OSError, URLError):
            return False

    def start_browser(self) -> None:
        """Usa un perfil exclusivo; nunca cierra el Chrome personal del usuario."""
        stop(self.chrome)
        if not port_available(9223):
            raise RuntimeError("Puerto 9223 ocupado por otro proceso")
        self.chrome = subprocess.Popen(
            [str(CHROME), "--kiosk", f"--app={WEB_URL}",
             f"--user-data-dir={self.state / 'chrome-profile'}",
             "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=9223",
             "--no-first-run", "--no-default-browser-check",
             "--disable-session-crashed-bubble", "--noerrdialogs",
             "--autoplay-policy=no-user-gesture-required"],
            stdout=self.output, stderr=subprocess.STDOUT,
        )
        self.browser_started = time.monotonic()
        self.browser_failures = 0

    def recover_browser(self) -> None:
        """Recupera ventanas cerradas y lleva al frente el PID del kiosco cada diez segundos."""
        if self.chrome is None or self.chrome.poll() is not None:
            self.start_browser()
            return
        try:
            pages = fetch_json(DEBUG_URL + "/json/list")
            target = next((page for page in pages if page.get("type") == "page"
                           and page.get("url", "").rstrip("/") == WEB_URL), None)
            if target is None:
                raise RuntimeError("No existe la ventana del calendario")
            with urlopen(DEBUG_URL + "/json/activate/" + target["id"], timeout=2) as response:
                response.read()
            self.browser_failures = 0
        except (OSError, URLError, ValueError, RuntimeError):
            self.browser_failures += 1
            if self.browser_failures >= 3 and time.monotonic() - self.browser_started > 30:
                LOG.warning("Recuperando la ventana del calendario")
                self.start_browser()
                return
        # AppKit activa el proceso exacto sin controlar el Chrome personal por nombre.
        # Chrome tarda en registrarse como aplicación gráfica tras cada arranque: el guion
        # distingue ese caso del rechazo de macOS en lugar de interrumpir la supervisión.
        script = (
            'ObjC.import("AppKit"); '
            '(function () { '
            f'var app = $.NSRunningApplication.runningApplicationWithProcessIdentifier({self.chrome.pid}); '
            'if (!app || typeof app.activateWithOptions !== "function") { return "ausente"; } '
            'if (app.isActive) { return "activa"; } '
            'return app.activateWithOptions(3) ? "recuperada" : "rechazada"; '
            '})()'
        )
        outcome = command(["/usr/bin/osascript", "-l", "JavaScript", "-e", script], timeout=5)
        if outcome == "ausente":
            return
        if outcome == "rechazada":
            # Un aviso al primer rechazo y luego cada cinco minutos, sin inundar el log.
            if self.focus_failures % 30 == 0:
                LOG.warning("macOS rechazó devolver el foco al calendario")
            self.focus_failures += 1
            return
        self.focus_failures = 0

    def park_cursor(self) -> None:
        """Aparta el puntero del borde superior: apoyado ahi, macOS despliega la barra
        de menus sobre el kiosco (lo deja asi el escritorio remoto o un roce del raton)."""
        script = (
            'ObjC.import("AppKit"); ObjC.import("CoreGraphics"); '
            '(function () { '
            'var frame = $.NSScreen.mainScreen.frame; '
            'var fromTop = frame.size.height - $.NSEvent.mouseLocation.y; '
            'if (fromTop > 2) { return "lejos"; } '
            '$.CGWarpMouseCursorPosition({x: frame.size.width - 2, y: frame.size.height - 2}); '
            'return "apartado"; '
            '})()'
        )
        if command(["/usr/bin/osascript", "-l", "JavaScript", "-e", script], timeout=5) == "apartado":
            LOG.info("Puntero apartado del borde superior")

    def tick(self) -> None:
        """Evalúa una actualización, la salud de los servicios y el estado del kiosco."""
        if os.fstat(self.output.fileno()).st_size > 5_000_000:
            shutil.copyfile(self.state / "logs/services.log", self.state / "logs/services.previous.log")
            self.output.truncate(0)
        maintenance = paused(self.state)
        pending = read_json(self.state / "pending.json")
        if pending and not self.candidate and not maintenance:
            self.candidate = pending
            LOG.info("Activando %s", pending["revision"][:12])
            try:
                self.start_services(pending)
            except Exception:
                write_json(self.state / "rejected.json", {**pending, "failed_at": time.time()})
                (self.state / "pending.json").unlink(missing_ok=True)
                self.candidate = None
                self.start_services(self.active)
                raise
        if self.services_ready():
            self.failures = 0
            if self.candidate:
                write_json(self.state / "previous.json", self.active)
                write_json(self.state / "active.json", self.candidate)
                self.active = self.candidate
                self.candidate = None
                (self.state / "pending.json").unlink(missing_ok=True)
                LOG.info("Actualización activa: %s", self.active["revision"][:12])
            if not maintenance and not self.reloaded:
                self.start_browser()
                self.reloaded = True
        elif time.monotonic() - self.started > 240:
            self.failures += 1
            if self.failures >= 3:
                if self.candidate:
                    LOG.error("Falló la activación; restaurando la versión anterior")
                    write_json(self.state / "rejected.json", {**self.candidate, "failed_at": time.time()})
                    (self.state / "pending.json").unlink(missing_ok=True)
                    self.candidate = None
                self.start_services(self.active)
        if maintenance:
            stop(self.chrome)
            self.chrome = None
        elif self.chrome is not None or self.reloaded:
            self.recover_browser()
            self.park_cursor()

    def run(self) -> None:
        """Supervisa hasta recibir una señal de salida de launchd o del usuario."""
        def shutdown(signum, frame):
            raise KeyboardInterrupt

        signal.signal(signal.SIGTERM, shutdown)
        signal.signal(signal.SIGINT, shutdown)
        try:
            self.start_services(self.active)
            while True:
                try:
                    self.tick()
                except Exception:
                    LOG.exception("Error de supervisión; se reintentará")
                time.sleep(10)
        finally:
            for process in (self.chrome, self.web, self.api):
                stop(process)
            self.output.close()


def agent_definition(state: Path, task: str) -> dict:
    """Genera LaunchAgents con rutas absolutas y PATH explícito para Homebrew."""
    settings = read_json(state / "settings.json")
    definition = {
        "Label": f"{LABEL}.{task}",
        "ProgramArguments": [settings["python"], str(state / "calendar_kiosk.py"), task, "--state", str(state)],
        "WorkingDirectory": str(state),
        "EnvironmentVariables": {"PATH": settings["path"]},
        "RunAtLoad": True,
        "LimitLoadToSessionType": "Aqua",
        "StandardOutPath": str(state / "logs" / f"{task}-launchd.log"),
        "StandardErrorPath": str(state / "logs" / f"{task}-launchd.log"),
    }
    if task == "run":
        definition.update(KeepAlive=True, ThrottleInterval=15, ExitTimeOut=30)
    else:
        definition["StartInterval"] = 300
    return definition


def install(state: Path, repo: Path, branch: str) -> None:
    """Prepara una instalación de usuario y registra los dos agentes de macOS."""
    config = repo / "calendar-api/config.yaml"
    existing = read_json(state / "settings.json")
    if not (config.is_file() or (state / "config.yaml").is_file()) or not CHROME.is_file():
        raise RuntimeError("Se necesitan Google Chrome y calendar-api/config.yaml en este Mac")
    npm = shutil.which("npm")
    if not npm or not shutil.which("git"):
        raise RuntimeError("Se necesitan Node/npm y Git en PATH")
    command(["git", "check-ref-format", f"refs/heads/{branch}"])
    if not (state / "active.json").exists() and not all(port_available(port) for port in (8000, 5173, 9223, 18000)):
        raise RuntimeError("Cierra dev.sh y el kiosco anterior: hay puertos ocupados")
    if command(["git", "status", "--porcelain", "--untracked-files=no"], cwd=repo):
        raise RuntimeError("Hay cambios locales sin commit. La instalación utiliza solo código versionado")
    revision = command(["git", "rev-parse", "HEAD"], cwd=repo)
    remote = command(["git", "remote", "get-url", "origin"], cwd=repo)
    if existing and existing["branch"] != branch:
        raise RuntimeError("La rama instalada es distinta; no se cambia automáticamente")
    settings = {"python": sys.executable, "npm": npm, "branch": branch, "path": os.environ["PATH"]}
    write_json(state / "settings.json", settings)
    if not (state / "config.yaml").exists():
        shutil.copy2(config, state / "config.yaml")
        (state / "config.yaml").chmod(0o600)
    if not (state / "repository.git").exists():
        command(["git", "clone", "--bare", "--no-hardlinks", repo, state / "repository.git"])
    command(["git", "--git-dir", state / "repository.git", "remote", "set-url", "origin", remote])
    if not (state / "active.json").exists():
        version = prepare(state, revision)
        write_json(state / "active.json", version)
    for task in ("update", "run"):
        subprocess.run(["launchctl", "bootout", f"gui/{os.getuid()}/{LABEL}.{task}"],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    shutil.copy2(Path(__file__), state / "calendar_kiosk.py")
    agents = Path.home() / "Library/LaunchAgents"
    agents.mkdir(parents=True, exist_ok=True)
    for task in ("run", "update"):
        plist = agents / f"{LABEL}.{task}.plist"
        with plist.open("wb") as handle:
            plistlib.dump(agent_definition(state, task), handle)
        command(["launchctl", "bootstrap", f"gui/{os.getuid()}", plist])
    print(f"Instalado. Estado y logs: {state}")


def main() -> None:
    """Entrada única de instalación, operación y servidor estático."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["install", "run", "update", "pause", "resume", "status", "uninstall", "serve"])
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--repo", type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument("--branch", default="main")
    parser.add_argument("--minutes", type=int, default=30)
    parser.add_argument("--retry", action="store_true")
    parser.add_argument("--directory", type=Path)
    parser.add_argument("--port", type=int, default=5173)
    args = parser.parse_args()
    if args.action == "serve":
        if not args.directory:
            parser.error("serve requiere --directory")
        serve(args.directory, args.port)
        return
    if sys.platform != "darwin":
        parser.error("Este instalador se ejecuta en el Mac mini, no en Windows/Linux")
    if sys.version_info < (3, 10):
        parser.error("Se necesita Python 3.10 o posterior")
    os.umask(0o077)
    state = args.state.expanduser().resolve()
    state.mkdir(parents=True, exist_ok=True)
    (state / "logs").mkdir(exist_ok=True)
    (state / "releases").mkdir(exist_ok=True)
    handler = logging.handlers.RotatingFileHandler(state / "logs/kiosk.log", maxBytes=2_000_000, backupCount=3)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    LOG.addHandler(handler)
    LOG.setLevel(logging.INFO)
    try:
        if args.action == "install":
            with lock(state, "update"):
                install(state, args.repo.resolve(), args.branch)
        elif args.action == "run":
            with lock(state, "supervisor"):
                Supervisor(state).run()
        elif args.action == "update":
            update(state, args.retry)
        elif args.action == "pause":
            if not 1 <= args.minutes <= 1440:
                parser.error("La pausa debe durar entre 1 y 1440 minutos")
            write_json(state / "pause.json", {"until": time.time() + args.minutes * 60})
            print(f"Pausa durante {args.minutes} minutos; se aplica en unos 10 segundos")
        elif args.action == "resume":
            (state / "pause.json").unlink(missing_ok=True)
            print("El supervisor recuperará el kiosco en unos 10 segundos")
        elif args.action == "status":
            for name in ("active", "previous", "pending", "rejected", "pause"):
                print(f"{name}: {read_json(state / (name + '.json'))}")
            print(f"API accesible: {api_ready()}; pausa vigente: {paused(state)}")
        elif args.action == "uninstall":
            for task in ("update", "run"):
                subprocess.run(["launchctl", "bootout", f"gui/{os.getuid()}/{LABEL}.{task}"], check=False)
                (Path.home() / f"Library/LaunchAgents/{LABEL}.{task}.plist").unlink(missing_ok=True)
            print("Agentes desinstalados. Configuración y versiones conservadas")
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        LOG.exception("Operación fallida")
        print(f"{exc}\nDetalles: {state / 'logs/kiosk.log'}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
