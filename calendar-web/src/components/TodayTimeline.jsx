import {
  evStart, evEnd, fmtTime, layoutLanes, startOfDay, sameDay,
} from "../lib/dates.js";

// Mezcla un color hex con transparencia (relleno tenue sobre fondo oscuro).
function tint(hex, alpha = "26") {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex + alpha;
  return hex;
}

export default function TodayTimeline({ now, events }) {
  const today = startOfDay(now);

  const todays = events.filter((ev) => {
    const s = startOfDay(evStart(ev));
    const e = startOfDay(evEnd(ev));
    if (ev.all_day) return today >= s && today < e;
    return today >= s && today <= e;
  });

  const allDay = todays.filter((e) => e.all_day || e.multi_day);
  const timed = todays.filter((e) => !e.all_day && !e.multi_day);

  // Ventana horaria visible: adaptativa para que entren todos los eventos.
  let startH = 8, endH = 22;
  for (const ev of timed) {
    startH = Math.min(startH, evStart(ev).getHours());
    endH = Math.max(endH, evEnd(ev).getHours() + (evEnd(ev).getMinutes() > 0 ? 1 : 0));
  }
  startH = Math.max(0, Math.min(startH, 8));
  endH = Math.min(24, Math.max(endH, 22));
  const totalMin = (endH - startH) * 60;
  const hours = [];
  for (let h = startH; h <= endH; h++) hours.push(h);

  const minutesFromStart = (d) => (d.getHours() - startH) * 60 + d.getMinutes();
  const laid = layoutLanes(timed);

  const nowTop =
    now.getHours() >= startH && now.getHours() < endH
      ? (minutesFromStart(now) / totalMin) * 100
      : null;

  return (
    <section className="panel reveal flex flex-col h-full" style={{ animationDelay: "0ms" }}>
      <div className="panel-title">Hoy</div>

      {allDay.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {allDay.map((ev) => (
            <div
              key={ev.id}
              className="allday-chip"
              style={{ background: tint(ev.color, "33"), borderLeft: `4px solid ${ev.color}` }}
            >
              {ev.title}
            </div>
          ))}
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        {/* rejilla de horas */}
        <div className="absolute inset-0">
          {hours.map((h, i) => (
            <div
              key={h}
              className="hour-row"
              style={{ top: `${(i / (endH - startH)) * 100}%` }}
            >
              <span className="hour-label tabular">{String(h).padStart(2, "0")}</span>
              <span className="hour-line" />
            </div>
          ))}
        </div>

        {/* eventos */}
        <div className="absolute inset-0" style={{ marginLeft: "3.2rem" }}>
          {laid.map(({ ev, lane, lanes }) => {
            const s = evStart(ev), e = evEnd(ev);
            const top = (minutesFromStart(s) / totalMin) * 100;
            const rawH = ((minutesFromStart(e) - minutesFromStart(s)) / totalMin) * 100;
            const height = Math.max(rawH, 3.2);
            const width = 100 / lanes;
            return (
              <div
                key={ev.id}
                className="event-block"
                style={{
                  top: `${top}%`,
                  height: `${height}%`,
                  left: `calc(${lane * width}% + 2px)`,
                  width: `calc(${width}% - 4px)`,
                  background: tint(ev.color, "2e"),
                  borderLeft: `4px solid ${ev.color}`,
                }}
              >
                <div className="event-time tabular">{fmtTime(s)}</div>
                <div className="event-title">{ev.title}</div>
                {ev.location && <div className="event-loc">{ev.location}</div>}
              </div>
            );
          })}
        </div>

        {/* linea de ahora */}
        {nowTop != null && (
          <div className="now-line" style={{ top: `${nowTop}%` }}>
            <span className="now-dot" />
          </div>
        )}

        {timed.length === 0 && allDay.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-dim" style={{ fontSize: "1.3rem" }}>
            Sin eventos hoy
          </div>
        )}
      </div>
    </section>
  );
}
