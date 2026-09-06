import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { eventsOnDay, evStart, sameDay, isVacationEvent, isHolidayEvent } from "../lib/dates.js";
import EventPill from "./EventPill.jsx";
import DayShade from "./DayShade.jsx";

// Celda de un dia con su lista de eventos. Mide el desbordamiento real en vez de
// suponer cuantos caben: si la lista no entra, muestra uno menos y lo suma al
// contador. La comparten la vista de mes y la de semanas consecutivas.
export default function DayCell({
  day, now, events, multiDayIds, hidden = 0, laneCount = 0, muted = false, label, cellRef, showTime = true,
}) {
  const sorted = eventsOnDay(events, day)
    // Vacaciones y festivos ya tinen el dia: no necesitan etiqueta.
    .filter((event) => !multiDayIds.has(event.id) && !isVacationEvent(event) && !isHolidayEvent(event))
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
    // Sin barras la celda ensena siempre al menos una etiqueta, aunque roce el
    // borde. Con barras el sitio es escaso y la etiqueta puede ceder al contador:
    // mejor "+1 mas" que un titulo cortado por la mitad. Un contenedor sin altura
    // aun no esta medido, no esta lleno.
    const floor = laneCount > 0 ? 0 : 1;
    if (el && el.clientHeight > 0 && el.scrollHeight > el.clientHeight + 1 && count > floor) setCount((current) => Math.max(floor, current - 1));
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
      <DayShade day={day} events={events} />
      <div className="mf-num tabular">{label ?? day.getDate()}</div>
      <div className="mf-events" ref={listRef} data-lanes={laneCount}>
        {shown.map((ev) => <EventPill key={ev.id} event={ev} showTime={showTime} />)}
        {extra > 0 && <div className="day-more">+{extra} más</div>}
      </div>
    </div>
  );
}
