import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  addDays, startOfDay, eventsOnDay, evStart, fmtTime,
  WEEKDAYS_SHORT, sameDay,
} from "../lib/dates.js";

function tint(hex, alpha = "26") {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex + alpha;
  return hex;
}

function DayColumn({ day, events, isWeekend, compact }) {
  const sorted = [...events].sort((a, b) => {
    if (a.all_day && !b.all_day) return -1;
    if (!a.all_day && b.all_day) return 1;
    return evStart(a) - evStart(b);
  });

  // Truncado MEDIDO: mostramos cuantas pills quepan en la altura real de la
  // columna (en vez de un tope fijo), recalculando al cambiar tamano/eventos.
  const listRef = useRef(null);
  const [count, setCount] = useState(sorted.length);

  // Al cambiar los eventos, reintenta mostrarlos todos antes de volver a medir.
  useEffect(() => setCount(sorted.length), [sorted.length]);

  // Si la lista desborda, reduce de 1 en 1 hasta que quepa (converge sin parpadeo).
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && el.scrollHeight > el.clientHeight + 1 && count > 1) {
      setCount((c) => Math.max(1, c - 1));
    }
  });

  // Recalcular cuando la columna cambia de tamano (resize del viewport/monitor).
  useEffect(() => {
    const el = listRef.current;
    if (!el || !window.ResizeObserver) return;
    const ro = new ResizeObserver(() => setCount(sorted.length));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sorted.length]);

  const shown = sorted.slice(0, count);
  const extra = sorted.length - shown.length;

  const cls =
    "day-col" +
    (isWeekend ? " day-col-weekend" : "") +
    (compact ? " day-col-compact" : "");

  return (
    <div className={cls}>
      <div className="day-col-head">
        <span className="day-dow">{WEEKDAYS_SHORT[day.getDay()]}</span>
        <span className="day-num tabular">{day.getDate()}</span>
      </div>
      {/* Dia vacio encogido: solo dia+numero, sin lista de eventos. */}
      {!compact && (
        <div className="day-events" ref={listRef}>
          {shown.map((ev) => (
            <div
              key={ev.id}
              className="day-pill"
              style={{ background: tint(ev.color, "24"), borderLeft: `3px solid ${ev.color}` }}
            >
              {!ev.all_day && <span className="day-pill-time tabular">{fmtTime(evStart(ev))}</span>}
              <span className="day-pill-title">{ev.title}</span>
            </div>
          ))}
          {extra > 0 && <div className="day-more">+{extra} más</div>}
        </div>
      )}
    </div>
  );
}

export default function WeekGrid({ now, events }) {
  // Empieza mañana (hoy ya va en el timeline) y muestra 7 dias.
  const start = addDays(startOfDay(now), 1);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  const cols = days.map((day) => {
    const evs = eventsOnDay(events, day);
    const dow = day.getDay();
    return { day, events: evs, isWeekend: dow === 0 || dow === 6, hasEvents: evs.length > 0 };
  });

  // Regla: un dia vacio se encoge SOLO si un vecino inmediato tiene eventos.
  // Asi devuelve su ancho al pool y los dias con eventos se ensanchan (menos
  // titulos cortados). Un dia vacio aislado conserva su ancho normal.
  const compact = cols.map((c, i) => {
    if (c.hasEvents) return false;
    const prev = cols[i - 1]?.hasEvents;
    const next = cols[i + 1]?.hasEvents;
    return Boolean(prev || next);
  });

  // Dias encogidos -> ancho minimo fijo; el resto reparte el espacio sobrante.
  const template = cols
    .map((_, i) => (compact[i] ? "var(--day-col-compact-w, 3.2rem)" : "minmax(0, 1fr)"))
    .join(" ");

  return (
    <section className="panel reveal flex flex-col h-full" style={{ animationDelay: "120ms" }}>
      <div className="panel-title">Próximos 7 días</div>
      <div className="week-grid flex-1" style={{ gridTemplateColumns: template }}>
        {cols.map((c, i) => (
          <DayColumn
            key={c.day.toISOString()}
            day={c.day}
            events={c.events}
            isWeekend={c.isWeekend}
            compact={compact[i]}
          />
        ))}
      </div>
    </section>
  );
}
