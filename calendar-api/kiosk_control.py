"""Pausa local del kiosco utilizando el protocolo del supervisor ya instalado."""

import json
from pathlib import Path
import tempfile
import time

from fastapi import HTTPException, Request

KIOSK_ORIGIN = "http://127.0.0.1:5173"
PAUSE_MINUTES = 30


def state_directory(config_path: Path) -> Path:
    """Identifica la instalación activa a través del enlace a su configuración privada."""
    # El instalador existente enlaza releases/<versión>/calendar-api/config.yaml
    # con <estado>/config.yaml. No requiere reinstalar ni modificar launchd.
    try:
        if not config_path.is_symlink():
            raise ValueError("No es una instalación administrada")
        state = config_path.resolve(strict=True).parent
        active = json.loads((state / "active.json").read_text(encoding="utf-8"))
        release = config_path.absolute().parent.parent.resolve()
        if (
            release.parent != state / "releases"
            or active.get("release") != release.name
            or not (state / "calendar_kiosk.py").is_file()
        ):
            raise ValueError("Esta API no pertenece a la versión activa")
        return state
    except (OSError, ValueError, AttributeError) as exc:
        raise HTTPException(503, "La pausa solo está disponible en el kiosco instalado") from exc


def pause_kiosk(request: Request, config_path: Path) -> dict:
    """Solicita una pausa de 30 minutos exclusivamente desde el calendario local."""
    # CORS de lectura sigue abierto. La operación de control exige origen local,
    # Host literal y cabecera explícita; no basta una petición desde otra web.
    if (
        request.client is None
        or request.client.host not in {"127.0.0.1", "::1"}
        or request.headers.get("origin") != KIOSK_ORIGIN
        or request.headers.get("host") != "127.0.0.1:8000"
        or request.headers.get("x-calendar-kiosk") != "1"
    ):
        raise HTTPException(403, "La pausa debe solicitarse desde el calendario local")
    state = state_directory(config_path)
    until = time.time() + PAUSE_MINUTES * 60
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=state, prefix=".pause-", delete=False) as output:
            temporary = Path(output.name)
            json.dump({"until": until}, output)
        temporary.replace(state / "pause.json")
    except OSError as exc:
        raise HTTPException(503, "No se pudo guardar la pausa; inténtalo de nuevo") from exc
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return {"paused": True, "minutes": PAUSE_MINUTES}
