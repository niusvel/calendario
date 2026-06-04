import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  monthMatrix, eventsOnDay, evStart, fmtTime, sameDay,
  MONTHS_LONG, WEEKDAYS_MINI,
} from "../lib/dates.js";

function tint(hex, alpha = "24") {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex + alpha : hex;
}

function DayCell({ cell, now, events }) {
  const day = cell.date;
  const dow = day.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const isToday = sameDay(day, now);

  const sorted = [...eventsOnDay(events, day)].sort((a, b) => {
    if (a.all_day && !b.all_day) return -1;
    if (!a.all_day && b.all_day) return 1;
    return evStart(a) - evStart(b);
  });

  // Truncado MEDIDO: cuantas pills quepan en la altura real de la celda + "+N más".
  const listRef = useRef(null);
  const [count, setCount] = useState(sorted.length);
  useEffect(() => setCount(sorted.length), [sorted.length]);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && el.scrollHeight > el.clientHeight + 1 && count > 1) {
      setCount((c) => Math.max(1, c - 1));
    }
  });
  useEffect(() => {
    const el = listRef.current;
    if (!el || !window.ResizeObserver) return;
    const ro = new ResizeObserver(() => setCount(sorted.length));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sorted.length]);

  const shown = sorted.slice(0, count);
  const extra = sorted.length - shown.length;

  return (
    <div
      className={
        "mf-cell" +
        (isWeekend ? " mf-weekend" : "") +
        (cell.inMonth ? "" : " mf-out") +
        (isToday ? " mf-today" : "")
      }
    >
      <div className="mf-num tabular">{day.getDate()}</div>
      <div className="mf-events" ref={listRef}>
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
    </div>
  );
}

export default function MonthFull({ now, events }) {
  const weeks = monthMatrix(now);

  return (
    <section className="mf reveal">
      <div className="panel-title capitalize">
        {MONTHS_LONG[now.getMonth()]} {now.getFullYear()}
      </div>

      <div className="mf-dow">
        {WEEKDAYS_MINI.map((d, i) => <span key={i}>{d}</span>)}
      </div>

      <div className="mf-grid" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.flat().map((cell, i) => (
          <DayCell key={i} cell={cell} now={now} events={events} />
        ))}
      </div>
    </section>
  );
}
