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
| Barra de menús de macOS sobre el kiosco | Causa confirmada (cursor en y=0); el supervisor aparta el puntero. |

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

Requiere el checkout limpio y actualizado. El instalador espera a que launchd
retire de verdad cada agente antes de volver a cargarlo: antes `bootout` volvía en
seguida, el `bootstrap` fallaba con `Input/output error` y el calendario quedaba
parado (pasó dos veces). Si aun así algún agente no aparece en `launchctl list`,
se carga a mano, y funciona por SSH:

```bash
U=$(id -u)
launchctl bootstrap "gui/$U" "$HOME/Library/LaunchAgents/local.family-calendar.run.plist"
launchctl bootstrap "gui/$U" "$HOME/Library/LaunchAgents/local.family-calendar.update.plist"
```

Para reiniciar el supervisor sin descargarlo (por ejemplo tras copiar a mano un
`calendar_kiosk.py` nuevo al directorio administrado):
`launchctl kickstart -k "gui/$(id -u)/local.family-calendar.run"`. Ojo: el
supervisor recién arrancado no repone una API caída hasta que los servicios llevan
4 minutos en marcha; un `pkill` de uvicorn justo después tarda ese tiempo en volver.

## Colores, vacaciones y festivos

Los colores de cada calendario viven en el `config.yaml` privado del Mac, no en
iCloud. Paleta sobria vigente (la usuaria pidió tonos apagados, tomando el suyo
como referencia):

| Calendario | Color | Tono |
| --- | --- | --- |
| LEYA | `#1E4C63` | teal marino (sin cambios) |
| NIUSVEL | `#B8623F` | terracota |
| NAIARA | `#B9788A` | rosa empolvado |
| NIUSVELITO | `#6E8F58` | salvia |
| BELINDA | `#6F5E9C` | ciruela |
| FAMILY | `#5D7A94` | azul acero |
| CUMPLES | `#D9B44A` | mostaza |
| FESTIVOS | `#A8433B` | rojo festivo |

La API lee la configuración solo al arrancar: tras cambiar colores hay que
reiniciarla (`pkill -f "uvicorn main:app"` en el Mac; el supervisor la levanta en
menos de un minuto, sin tocar Chrome).

Las vacaciones (evento con "vacaciones" en el título) y los festivos tiñen el
fondo del día entero, repartido en sectores si coinciden varias personas. Los
festivos se reconocen por el **nombre de calendario `FESTIVOS`** en el frontend.

Los festivos vienen del calendario laboral oficial de Open Data Euskadi, que en un
solo `.ics` mezcla comunidad, territorios y todos los municipios. El backend lo
filtra con `include_locations` (coincidencia parcial, sin mayúsculas) y trata su
hora simbólica `00:00:01` como día completo. Entrada en `config.yaml`:

```yaml
  - name: "FESTIVOS"
    color: "#A8433B"
    url: "https://opendata.euskadi.eus/contenidos/ds_eventos/calendario_laboral_2026/opendata/calendario_laboral_2026.ics"
    include_locations: ["CAE / EAE", "Gipuzkoa", "Donostia"]
```

**La URL cambia cada año** (`calendario_laboral_2027.ics` cuando lo publiquen,
normalmente en primavera). Fuente: Open Data Euskadi, dataset "Calendario laboral
de Euskadi para el 2026".

## Tiempo (Vista 1)

La previsión viene de Open-Meteo (gratis, sin clave) a través de `GET /weather`
del backend, que la descarga cada 30 minutos (`weather_minutes`) y conserva la
última buena si falla. Se activa con el lugar en `config.yaml`:

```yaml
weather:
  name: "Donostia"
  latitude: 43.3183
  longitude: -1.9812
```

Sin esa clave el endpoint responde 404 y la pantalla no muestra tiempo. Los códigos
WMO se traducen a icono y texto en `calendar-web/src/lib/weather.js`.

La Vista 1 tiene dos modos: con citas con hora ese día, la rejilla de horas con una
tira de tiempo encima (ahora, máx/mín, lluvia); sin citas con hora, una lista breve
y el tiempo en grande con las próximas 12 horas. Las tarjetas de "Próximos 7 días"
llevan icono y máx/mín de cada día.

## Pegatinas

Cada etiqueta lleva delante un icono deducido del título (🎂 cumple, 💇 peluquería,
🦷 dentista, 🩺 médico, 🔧 taller, ✈️ viaje, 🎉 fiesta…). La lista vive en
`calendar-web/src/lib/stickers.js`: para añadir o cambiar una basta con editar ahí
(palabra clave → emoji; la primera regla que coincide gana) y el kiosco la recibe
con la actualización normal. Si el título en iCloud ya trae un emoji, se respeta y
no se añade otro. Los festivos no llevan etiqueta ni pegatina: solo el fondo rojo.

## Barra de menús y cursor

Si el puntero se queda apoyado en el borde superior, macOS despliega la barra de
menús sobre el kiosco (lo deja ahí Chrome Remote Desktop o un roce del ratón). El
supervisor lo aparta a la esquina inferior derecha en cada ciclo cuando lo detecta
a menos de 2 px del borde, y la página oculta la flecha con `cursor: none`.

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

- Indicador de actualización que no refleja bien los fallos de iCloud.

Resueltos en esta sesión: comparación de `Date` por referencia (afectaba a semana y
mes), eventos ocultos al exceder los carriles y el fin a medianoche.

## Límites conocidos

El supervisor no desbloquea la sesión ni impide la suspensión de macOS. Tampoco detecta
salir manualmente de pantalla completa manteniendo la ventana abierta. La caché de
eventos sigue siendo en memoria.

Documentación adicional: [operación del kiosco](macos-kiosco.md) y
[arquitectura y guía histórica](calendario_estado-y-guia.md). Este documento prevalece
sobre los apartados históricos que aún describen el kiosco como pendiente.
