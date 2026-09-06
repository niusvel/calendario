# Continuación desde el PC de casa — 6 de septiembre de 2026

Este es el punto de entrada para continuar la sesión desde otro equipo o agente.
La usuaria cambia del PC de oficina al de casa por problemas de conexión remota.

## Objetivo y estado

Antes de hacer cambios visuales, conseguir que el calendario del Mac mini reciba
actualizaciones del repositorio y recupere el kiosco/foco sin conectar un ratón.
Se tomó como referencia el supervisor y actualizador de la plataforma de proyección
(`capture_service/player-watchdog.ps1` y `update-capture-service.ps1`), adaptando el
enfoque a macOS. No se migró el stack: sigue siendo React/Vite y FastAPI/Python.

| Cambio | Git | Comprobación en el Mac mini |
| --- | --- | --- |
| Supervisor, recuperación de foco y actualizador | Publicado en `5ae27ba` | Instalación completada. La usuaria confirmó que se abrió el calendario y recuperó el foco al usar Terminal. |
| Doble Q: cierre con pausa de 30 minutos | Publicado en `0f7fe85` | Pendiente confirmar recepción automática y funcionamiento real. |
| Arranque después de reiniciar/iniciar sesión | Implementado con LaunchAgents | Pendiente comprobar. |
| Retorno tras los 30 minutos y recuperación de procesos caídos | Implementado y probado con simulaciones | Pendiente comprobar en el Mac. |

El último commit de **código** de esta sesión es `0f7fe85`. Los commits posteriores
de documentación no implican cambios funcionales. No asumir que la revisión de la
copia en Documents coincide con la versión que sirve el supervisor: son copias distintas.

## Equipos y acceso

- PC usado durante esta sesión: Windows en la oficina, proyecto en
  `C:\Users\LeyanisLopez\Proyectos\calendario`.
- Mac mini: en casa; la usuaria lo controla con Chrome Remote Desktop.
- macOS **12.7.6**, usuario `leyanislopezavila`, nombre `Mini-de-Leyanis`.
- Checkout del Mac: `/Users/leyanislopezavila/Documents/calendario`.
- Python: `/usr/local/bin/python3`, versión **3.14.5**.
- Node: `/Users/leyanislopezavila/.nvm/versions/node/v22.22.3/bin/node`, versión **22.22.3**.
- npm: en ese mismo directorio de NVM. Git **2.54.0**.
- Se activó Sesión remota y macOS mostró `ssh leyanislopezavila@mini-de-leyanis`.
  **No se estableció una conexión SSH**: oficina y casa están en redes distintas.
  Desde casa podría probarse si ambos equipos comparten red, pero todavía no está
  validado. No hay credenciales guardadas en el repositorio.

## Lo instalado en el Mac

La usuaria ejecutó correctamente:

```bash
python3 "$HOME/Documents/calendario/scripts/macos/calendar_kiosk.py" install
```

Estado administrado:

```text
/Users/leyanislopezavila/Library/Application Support/FamilyCalendar/
```

En ese directorio están la configuración privada `config.yaml`, el supervisor
instalado, el repositorio operativo, las versiones, `active.json`, la posible
actualización `pending.json`, `pause.json` y los logs.

Los agentes son `local.family-calendar.run` y `local.family-calendar.update`.
El supervisor comprueba cada unos 10 segundos; el actualizador consulta `main`
cada 5 minutos y prepara una versión aislada antes de activarla. La preparación
añade tiempo a esos cinco minutos. Se comprueban build, smoke test y API candidata;
si falla la activación se recupera la versión anterior.

**No volver a ejecutar `dev.sh` junto al supervisor**: competirían por los puertos.
La configuración privada usada en producción es la copia del directorio administrado,
no la del checkout original. El perfil del Chrome administrado también es independiente.

## Primeros pasos al retomar

1. En el PC de casa, actualizar el checkout con `git pull --ff-only origin main`
   desde su carpeta del proyecto y leer este documento. Si no hay checkout, clonar
   `https://github.com/niusvel/calendario.git`.
2. En el **Mac mini**, comprobar la versión activa con el comando siguiente. No
   ejecutarlo en Windows ni confundir el PC de casa con el Mac:

   ```bash
   python3 "$HOME/Library/Application Support/FamilyCalendar/calendar_kiosk.py" status
   ```

3. Si el calendario reclama el foco mientras se intenta utilizar Terminal, pedir
   una pausa mediante el supervisor ya instalado:

   ```bash
   python3 "$HOME/Library/Application Support/FamilyCalendar/calendar_kiosk.py" pause --minutes 30
   ```

   Se aplica en unos 10 segundos. Durante la pausa también se aplaza la consulta
   y activación de nuevas versiones. Para continuar las comprobaciones:

   ```bash
   python3 "$HOME/Library/Application Support/FamilyCalendar/calendar_kiosk.py" resume
   ```

4. Con la actualización que incluye `0f7fe85` activa, enfocar el calendario y pulsar
   **Q dos veces en menos de un segundo**. Debe aparecer un aviso, cerrarse la ventana
   en unos 10 segundos y dejar de recuperar el foco durante 30 minutos. Mantener Q
   pulsada no cuenta. Funciona desde cualquiera de las tres vistas.
5. Confirmar que se vuelve a abrir tras `resume` o al caducar la pausa. Después
   verificar el arranque al iniciar sesión, antes de abordar los cambios visuales.

Si no llega la actualización, revisar primero estos logs **en el Mac**:

```bash
tail -n 80 "$HOME/Library/Application Support/FamilyCalendar/logs/kiosk.log"
tail -n 80 "$HOME/Library/Application Support/FamilyCalendar/logs/update-launchd.log"
```

Para solicitar una consulta manual, sin una pausa vigente:

```bash
python3 "$HOME/Library/Application Support/FamilyCalendar/calendar_kiosk.py" update
```

`update --retry` permite reintentar antes de una hora una versión rechazada. No
reinstalar ni borrar el estado como primer recurso: conservar la configuración y
la versión que está funcionando.

## Implementación de doble Q

- `calendar-web/src/components/KioskShortcut.jsx`: escucha el atajo, pide la pausa
  y muestra confirmación o error. Se monta en `App.jsx` para las tres vistas.
- `calendar-web/src/lib/kiosk.js`: dos pulsaciones dentro de un segundo; ignora
  repetición automática, edición y combinaciones Ctrl/Alt/Meta; perder foco cancela
  la primera pulsación.
- `calendar-api/kiosk_control.py` y `main.py`: `POST /kiosk/pause` valida cliente,
  origen y Host locales, más una cabecera de control. Identifica la instalación
  activa por el enlace de `config.yaml` y escribe `pause.json` de forma atómica.
- El supervisor de `5ae27ba` ya reconoce ese archivo. **Doble Q no necesita una
  reinstalación del supervisor**, solo la actualización normal del frontend/backend.

## Validación realizada y límites

En Windows pasaron **19 pruebas del supervisor, 8 de control HTTP y 6 de frontend**,
además del smoke test del backend y `npm run build`. Se probó en navegador la
doble Q y el aviso en las tres vistas, simulando la respuesta de la API. Eso no
equivale a comprobar el cierre real del Chrome de macOS.

El supervisor no desbloquea la sesión ni impide la suspensión de macOS. Tampoco
detecta salir manualmente de pantalla completa manteniendo la ventana abierta.
La caché de eventos sigue siendo en memoria. Las modificaciones futuras del
propio supervisor requieren reinstalarlo; los cambios del frontend/backend se
actualizan automáticamente.

La revisión inicial también detectó cuestiones visuales/de fechas que **no se
han corregido en esta sesión**: comparación de objetos Date por referencia en la
vista semanal, eventos ocultos al exceder tres carriles, fin a medianoche incluido
en el día siguiente e indicador de actualización que no refleja bien fallos de
iCloud. Retomarlas después de validar la operación, según las prioridades de la usuaria.

Documentación adicional: [operación del kiosco](macos-kiosco.md) y
[arquitectura y guía histórica](calendario_estado-y-guia.md). Este documento prevalece
para el estado de esta sesión sobre apartados históricos que aún describen el
kiosco como pendiente de implementar.
