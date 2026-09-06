# Estado del kiosco y punto de continuación — 6 de septiembre de 2026

Este es el punto de entrada para continuar la sesión. La usuaria trabaja desde el
PC de casa, que está en la misma red que el Mac mini del calendario.

## Resumen: la operación del kiosco está validada

Todas las comprobaciones que quedaban pendientes se han hecho sobre el Mac mini real.

| Comprobación | Resultado |
| --- | --- |
| Llegada automática de actualizaciones | Encadenó `0f7fe85` → `d72b5f4` → `2b18d22` sin intervención ni rechazos. |
| Doble Q en el calendario | Confirmado por la usuaria en la pantalla. |
| Endpoint `POST /kiosk/pause` en macOS | 200 con la petición legítima; 403 sin cabecera de control y 403 con origen ajeno. |
| Cierre real del Chrome de macOS | Se cierra en menos de 5 segundos tras la pausa. |
| Retorno tras `resume` y al caducar la pausa | Vuelve en 5–12 segundos, comprobado varias veces. |
| Arranque tras reiniciar | Confirmado por un corte de luz en casa. |
| Recuperación de servicios | Supervisor, API y frontend levantan solos; los 7 calendarios de iCloud descargan bien. |

Con esto, **el trabajo pendiente ya no es de operación sino de interfaz**: quedan los
arreglos visuales y de fechas listados más abajo.

## Acceso por SSH desde el PC de casa

Hay una clave ed25519 sin contraseña en el PC de casa (`~/.ssh/id_ed25519`),
autorizada en el Mac mini. Para revocarla, basta con borrar esa línea de
`~/.ssh/authorized_keys` en el Mac.

```bash
ssh leyanislopezavila@192.168.1.103
```

Dos trampas al usarlo, ambas encontradas en la práctica:

- Por SSH el `PATH` es mínimo y `python3` resuelve al 3.9 del sistema, que no vale.
  Usar siempre `/usr/local/bin/python3` para los comandos del kiosco.
- Reinstalar el supervisor por SSH exige exportar el `PATH` completo antes, o el
  instalador guardará en `settings.json` un `PATH` sin Node y romperá las
  actualizaciones. El valor correcto es el que ya está en ese archivo.

## Equipos

- PC de casa: Mac, usuario `leya`, checkout en `~/Documents/Projects/calendario`.
- Mac mini: `192.168.1.103`, macOS **12.7.6**, usuario `leyanislopezavila`.
  Checkout en `/Users/leyanislopezavila/Documents/calendario`.
- Python `/usr/local/bin/python3` **3.14.5**; Node **22.22.3** bajo NVM; Git **2.54.0**.

## Comandos de operación

Todos se ejecutan **en el Mac mini**, no en el PC de casa:

```bash
K="$HOME/Library/Application Support/FamilyCalendar/calendar_kiosk.py"
/usr/local/bin/python3 "$K" status
/usr/local/bin/python3 "$K" pause --minutes 30
/usr/local/bin/python3 "$K" resume
/usr/local/bin/python3 "$K" update          # consulta manual, sin pausa vigente
```

`update --retry` reintenta antes de una hora una versión rechazada. Los logs están en
`~/Library/Application Support/FamilyCalendar/logs/` (`kiosk.log` y `update-launchd.log`).

**No ejecutar `dev.sh` junto al supervisor**: competirían por los puertos. La
configuración privada de producción es la copia del directorio administrado, no la del
checkout. El perfil de Chrome administrado también es independiente.

## Reinstalar el supervisor

Los cambios de frontend y backend llegan solos; **modificar el propio supervisor exige
reinstalarlo**. `install` es idempotente: conserva `config.yaml`, `active.json` y el
repositorio operativo, y solo reemplaza el supervisor y los agentes.

```bash
export PATH="$(/usr/local/bin/python3 -c 'import json,pathlib;print(json.loads((pathlib.Path.home()/"Library/Application Support/FamilyCalendar/settings.json").read_text())["path"])')"
/usr/local/opt/python@3.14/bin/python3.14 "$HOME/Documents/calendario/scripts/macos/calendar_kiosk.py" install
```

Requiere el checkout limpio y actualizado. Si el `bootstrap` de launchctl falla con
`Input/output error`, es una carrera con el agente anterior mientras termina: los
agentes quedan descargados y el calendario parado. Se recupera cargándolos a mano,
y esta vez sí funciona por SSH:

```bash
U=$(id -u)
launchctl bootstrap "gui/$U" "$HOME/Library/LaunchAgents/local.family-calendar.run.plist"
launchctl bootstrap "gui/$U" "$HOME/Library/LaunchAgents/local.family-calendar.update.plist"
```

## Implementación de doble Q

- `calendar-web/src/components/KioskShortcut.jsx`: escucha el atajo, pide la pausa
  y muestra confirmación o error. Se monta en `App.jsx` para las tres vistas.
- `calendar-web/src/lib/kiosk.js`: dos pulsaciones dentro de un segundo; ignora
  repetición automática, edición y combinaciones Ctrl/Alt/Meta; perder foco cancela
  la primera pulsación.
- `calendar-api/kiosk_control.py` y `main.py`: `POST /kiosk/pause` valida cliente,
  origen y Host locales, más una cabecera de control. Identifica la instalación
  activa por el enlace de `config.yaml` y escribe `pause.json` de forma atómica.

## Lo que queda pendiente

Cuestiones visuales y de fechas detectadas en la revisión inicial, **todavía sin corregir**:

- Comparación de objetos `Date` por referencia en la vista semanal.
- Eventos ocultos al exceder tres carriles.
- Fin a medianoche incluido en el día siguiente.
- Indicador de actualización que no refleja bien los fallos de iCloud.

## Límites conocidos

El supervisor no desbloquea la sesión ni impide la suspensión de macOS. Tampoco detecta
salir manualmente de pantalla completa manteniendo la ventana abierta. La caché de
eventos sigue siendo en memoria.

Documentación adicional: [operación del kiosco](macos-kiosco.md) y
[arquitectura y guía histórica](calendario_estado-y-guia.md). Este documento prevalece
sobre los apartados históricos que aún describen el kiosco como pendiente.
