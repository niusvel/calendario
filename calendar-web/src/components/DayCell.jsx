import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { eventsOnDay, evStart, fmtTime, sameDay, isVacationEvent } from "../lib/dates.js";
import VacationShade from "./VacationShade.jsx";
import { chip } from "../lib/colors.js";

// Celda de un dia con su lista de eventos. Mide el desbordamiento real en vez de
// suponer cuantos caben: si la lista no entra, muestra uno menos y lo suma al
// contador. La comparten la vista de mes y la de semanas consecutivas.
export default function DayCell({
  day, now, events, multiDayIds, hidden = 0, laneCount = 0, muted = false, label, cellRef,
}) {
  const sorted = eventsOnDay(events, day)
    .filter((event) => !multiDayIds.has(event.id) && !isVacationEvent(event))
    .sort((a, b) => {
      if (a.all_day && !b.all_day) return -1;
      if (!a.all_day && b.all_day) return 1;
      return evStart(a) - evStart(b);
    });

  const listRef = useRef(null);
  const [count, setCount] = useState(sorted.length);
  useEffect(() => setCount(sorted.length), [sorted.length]);
  useLayoutEffect(() => {
    const el = listRef.current;
    // Si ni una sola etiqueta cabe entera, se baja a cero y el dia queda resumido
    // en el contador: preferible a un titulo cortado por la mitad.
    if (el && el.scrollHeight > el.clientHeight + 1 && count > 0) setCount((current) => Math.max(0, current - 1));
  });
  useEffect(() => {
    const el = listRef.current;
    if (!el || !window.ResizeObserver) return;
    const observer = new ResizeObserver(() => setCount(sorted.length));
    observer.observe(el);
    return () => observer.disconnect();
  }, [sorted.length]);

  const shown = sorted.slice(0, count);
  // Las barras que se quedan fuera de los carriles visibles se cuentan aqui en
  // lugar de desaparecer sin dejar rastro.
  const extra = sorted.length - shown.length + hidden;
  const weekend = day.getDay() === 0 || day.getDay() === 6;

  return (
    <div
      ref={cellRef}
      className={"mf-cell" + (weekend ? " mf-weekend" : "") + (muted ? " mf-out" : "") + (sameDay(day, now) ? " mf-today" : "")}
      style={{ "--mf-lanes": laneCount }}
    >
      <VacationShade day={day} events={events} />
      <div className="mf-num tabular">{label ?? day.getDate()}</div>
      <div className="mf-events" ref={listRef} data-lanes={laneCount}>
        {shown.map((ev) => (
          <div key={ev.id} className="day-pill" style={chip(ev.color)}>
            {!ev.all_day && <span className="day-pill-time tabular">{fmtTime(evStart(ev))}</span>}
            <span className="day-pill-title">{ev.title}</span>
          </div>
        ))}
        {extra > 0 && <div className="day-more">+{extra} más</div>}
      </div>
    </div>
  );
}
