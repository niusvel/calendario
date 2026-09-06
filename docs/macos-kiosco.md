# Mac mini: actualizaciones automáticas y recuperación del kiosco

El arranque permanente pasa de `dev.sh` a dos agentes de usuario de macOS:

- **Supervisor**: inicia API, frontend compilado y Chrome; revisa los procesos y
  recupera el foco del calendario cada 10 segundos. Si desaparece su ventana,
  la vuelve a abrir después de tres comprobaciones fallidas.
- **Actualizador**: consulta `origin/main` cada 5 minutos. Prepara otra versión,
  instala dependencias, ejecuta el smoke test del backend, compila el frontend y
  comprueba la API en otro puerto antes de solicitar el cambio.

El supervisor activa la versión candidata y comprueba ambos servicios. Si no
arrancan en 240 segundos más tres comprobaciones, vuelve a iniciar la versión
anterior. Chrome se reinicia al completar el cambio para cargar el nuevo frontend.
Durante la preparación sigue funcionando la versión anterior; la activación
requiere un breve reinicio de los servicios.

Se utiliza el mismo enfoque del supervisor y actualizador de la plataforma de
proyección, adaptado a macOS con `launchd` y AppKit. Referencias oficiales:
[agentes de launchd](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html),
[NSRunningApplication](https://developer.apple.com/documentation/appkit/nsrunningapplication?language=objc) y
[copias de trabajo de Git](https://git-scm.com/docs/git-worktree).

## Primera instalación (en el Mac mini)

Requisitos: Python 3.10+, Node/npm compatibles con este proyecto, Git, Google
Chrome en `/Applications` y el archivo privado `calendar-api/config.yaml`.
El usuario de macOS debe poder leer el repositorio remoto sin introducir una
contraseña en cada descarga. Para repositorios privados, configurar antes las
credenciales de Git o una clave SSH con acceso de lectura; no pegar tokens en
los scripts. El instalador conserva el PATH y las rutas de Python/npm de la terminal.

1. Publicar los cambios en el repositorio y descargarlos en el Mac:

   ```bash
   cd /ruta/al/calendario
   git pull --ff-only origin main
   ```

2. Detener el `dev.sh` anterior con `Ctrl+C` y cerrar su ventana de kiosco.
   Si se configuró otro arranque automático, quitarlo para que no compita por
   los puertos. El instalador no mata procesos que no haya creado.

3. Ejecutar desde la sesión gráfica del usuario habitual del Mac, **sin sudo**:

   ```bash
   python3 scripts/macos/calendar_kiosk.py install
   ```

   La primera preparación puede tardar varios minutos en el Mac mini. Los detalles
   quedan en `~/Library/Application Support/FamilyCalendar/logs/kiosk.log`.
   Se instala inicialmente el commit local `HEAD`; después se sigue `origin/main`.
   Los cambios sin commit en archivos versionados detienen la instalación.

4. Comprobar:

   ```bash
   python3 scripts/macos/calendar_kiosk.py status
   launchctl print "gui/$(id -u)/local.family-calendar.run"
   launchctl print "gui/$(id -u)/local.family-calendar.update"
   ```

Los agentes arrancan al **iniciar sesión** y se recuperan si terminan. No desbloquean
el Mac ni configuran el inicio de sesión automático. Si el problema real es que
el equipo se bloquea o suspende, habrá que ajustar esa configuración en el Mac;
recuperar el foco de una ventana no elimina una pantalla de bloqueo.

## Flujo para los próximos cambios

Después de comprobar y publicar un commit en `main`, el Mac lo detectará en la
siguiente consulta (hasta cinco minutos), lo preparará y recargará el calendario.
No hace falta conectar ratón, ejecutar `git pull` ni arrancar procesos en el Mac.

La instalación usa un repositorio y versiones propios en:

```text
~/Library/Application Support/FamilyCalendar/
  config.yaml             # configuración privada utilizada por todas las versiones
  settings.json           # rama, rutas y PATH de la instalación
  calendar_kiosk.py       # supervisor instalado
  repository.git/         # repositorio de solo operación
  releases/               # versiones con build y entorno Python propios
  active.json             # versión comprobada y activa
  previous.json           # versión anterior
  pending.json            # candidata, solo durante una actualización
  rejected.json           # último fallo y momento del fallo
  chrome-profile/         # perfil exclusivo del calendario
  logs/
```

Tu checkout original permanece separado. La configuración privada se copia una
vez al directorio de operación y no se sobrescribe en cada actualización.
Para cambiar calendarios, editar ese `config.yaml` y reiniciar el supervisor.
Esta instalación sirve la API local; no importa los `.env` de desarrollo.

Se conservan las tres versiones más recientes y cualquiera que todavía figure
como activa, anterior o pendiente. Las compilaciones fallidas se eliminan. Los
fallos se reintentan tras una hora o inmediatamente con `--retry`; un commit
nuevo se evalúa en la siguiente consulta. Una caída al descargar Git conserva
la instalación actual. Un retroceso no compatible con el historial se rechaza.

Para forzar una consulta ahora:

```bash
python3 scripts/macos/calendar_kiosk.py update
# Reintentar inmediatamente una versión que haya fallado:
python3 scripts/macos/calendar_kiosk.py update --retry
```

La API sigue teniendo caché **en memoria**: los reinicios no conservan sus eventos.
El control de salud distingue una caída del proceso de un feed iCloud degradado,
para evitar reiniciar continuamente cuando falla Internet.

Los cambios futuros en el propio supervisor/instalador requieren descargar el
script y volver a ejecutar `install`. El frontend y el backend sí se actualizan
automáticamente. La reinstalación conserva configuración y versión activa;
también permite retomar una instalación interrumpida.

## Mantenimiento sin que Chrome reclame el foco

Con el calendario enfocado, pulsa **Q dos veces en menos de un segundo**. Aparecerá
un aviso y el supervisor cerrará su ventana en unos 10 segundos, con una pausa de
30 minutos. Mantener Q pulsada no activa el atajo. Funciona en las tres vistas.
Al acabar la pausa vuelve a abrirse automáticamente.

Este atajo utiliza el archivo de pausa que ya reconoce el supervisor: llega por
actualización normal del frontend/backend, sin reinstalar los agentes.

Desde una terminal del Mac, o mediante SSH con el mismo usuario:

```bash
python3 scripts/macos/calendar_kiosk.py pause --minutes 30
python3 scripts/macos/calendar_kiosk.py resume
```

La pausa cierra únicamente el Chrome administrado, deja API/frontend funcionando
y aplaza nuevas activaciones. Caduca automáticamente. Los comandos también pueden
ejecutarse mediante la copia instalada si se ha movido el checkout:

```bash
python3 "$HOME/Library/Application Support/FamilyCalendar/calendar_kiosk.py" status
```

El perfil de Chrome es exclusivo y la recuperación de foco usa su PID, no el
nombre de la aplicación. El puerto de control de Chrome `9223` y los servicios
`8000`, `5173` y `18000` están destinados a localhost. El supervisor restaura el
foco y recrea ventanas ausentes; salir manualmente de pantalla completa sin
cerrar la ventana no se detecta. Pausar y reanudar vuelve a abrirla en modo kiosco.

## Diagnóstico y desinstalación

```bash
tail -n 80 "$HOME/Library/Application Support/FamilyCalendar/logs/kiosk.log"
tail -n 80 "$HOME/Library/Application Support/FamilyCalendar/logs/services.log"
launchctl kickstart -k "gui/$(id -u)/local.family-calendar.run"
python3 scripts/macos/calendar_kiosk.py uninstall
```

Desinstalar quita los agentes y detiene los procesos administrados. Conserva
configuración, perfil y versiones. Se puede volver a ejecutar `dev.sh`.

## Validación

Pruebas de lógica, fallos y servidor estático (también ejecutables en Windows):

```bash
python -m unittest discover -s scripts/macos -p test_calendar_kiosk.py -v
# Con las dependencias del backend instaladas:
python -m unittest discover -s calendar-api -p test_kiosk_control.py -v
# Dentro de calendar-web:
npm test
```

Comprobaciones que deben hacerse en el Mac mini antes de dar la instalación por
validada:

1. Iniciar sesión y verificar que aparece el calendario.
2. Abrir otra aplicación y comprobar la recuperación del foco en unos 10 segundos.
3. Cerrar la ventana del kiosco y comprobar que vuelve a abrirse.
4. Pulsar Q dos veces, utilizar el escritorio y reanudar (o esperar 30 minutos).
5. Publicar un cambio visible y comprobar la nueva revisión en `status` y en pantalla.
6. Reiniciar un proceso administrado y comprobar su recuperación.

Las pruebas locales simulan launchd/AppKit/Chrome; no sustituyen estas
comprobaciones del sistema operativo y la pantalla reales.
