import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { addDays, startOfDay, eventsOnDay, evStart, fmtTime, WEEKDAYS_SHORT, eventDayRange, isVacationEvent, isHolidayEvent, sameDay } from "../lib/dates.js";
import EventTitle from "./EventTitle.jsx";
import EventPill from "./EventPill.jsx";
import { WeatherDay } from "./Weather.jsx";
import { dailyFor } from "../lib/weather.js";
import DayShade from "./DayShade.jsx";
import { chip } from "../lib/colors.js";
import { packLanes } from "../lib/lanes.js";
import { useBarPositions } from "../lib/bars.js";

const MAX_LANES = 2;
const DAY_MS = 86_400_000;
const HEAD_REM = 3.4;   // alto de la cabecera del dia (dia de semana + numero)
const LANE_REM = 1.7;   // paso vertical entre carriles de barra

function DayColumn({ day, events, isWeekend, compact, laneCount, multiDayIds, columnRef, forecast }) {
  const sorted = events.filter((event) => !multiDayIds.has(event.id) && !isVacationEvent(event) && !isHolidayEvent(event)).sort((a, b) => (a.all_day === b.all_day ? evStart(a) - evStart(b) : a.all_day ? -1 : 1));
  const listRef = useRef(null);
  const [count, setCount] = useState(sorted.length);
  useEffect(() => setCount(sorted.length), [sorted.length]);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && el.scrollHeight > el.clientHeight + 1 && count > 1) setCount((current) => Math.max(1, current - 1));
  });
  useEffect(() => {
    const el = listRef.current;
    if (!el || !window.ResizeObserver) return;
    const observer = new ResizeObserver(() => setCount(sorted.length));
    observer.observe(el);
    return () => observer.disconnect();
  }, [sorted.length]);
  const shown = sorted.slice(0, count);
  const extra = sorted.length - shown.length;
  return <div ref={columnRef} className={"day-col" + (isWeekend ? " day-col-weekend" : "") + (compact ? " day-col-compact" : "")} style={{ "--week-lanes": laneCount }}>
    <DayShade day={day} events={events} />
    <div className="day-col-head"><span className="day-dow">{WEEKDAYS_SHORT[day.getDay()]}</span><WeatherDay day={forecast} compact={compact} /><span className="day-num tabular">{day.getDate()}</span></div>
    {!compact && <div className="day-events" ref={listRef}>{shown.map((ev) => <EventPill key={ev.id} event={ev} />)}{extra > 0 && <div className="day-more">+{extra} más</div>}</div>}
  </div>;
}

export default function WeekGrid({ now, events, weather }) {
  const gridRef = useRef(null);
  const columnRefs = useRef([]);
  const start = addDays(startOfDay(now), 1);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const bars = packLanes(events.flatMap((event) => {
    if (isVacationEvent(event)) return [];
    const [eventStart, eventEnd] = eventDayRange(event);
    // eventDayRange devuelve dos Date distintos: compararlos con === solo mide la
    // referencia, nunca la fecha, y todo evento de un dia acababa pintado como barra.
    if (sameDay(eventStart, eventEnd) || eventEnd < start || eventStart > end) return [];
    const clippedStart = eventStart < start ? start : eventStart;
    const clippedEnd = eventEnd > end ? end : eventEnd;
    return [{ id: `${event.id}-${start.toISOString()}`, event, startCol: Math.round((clippedStart - start) / DAY_MS), endCol: Math.round((clippedEnd - start) / DAY_MS) }];
  }));
  const laneCount = Math.min(MAX_LANES, Math.max(0, ...bars.map((bar) => bar.lane + 1)));
  const multiDayIds = new Set(bars.map((bar) => bar.event.id));
  const cols = days.map((day) => { const dayEvents = eventsOnDay(events, day); return { day, events: dayEvents, isWeekend: [0, 6].includes(day.getDay()), hasEvents: dayEvents.length > 0 }; });
  const compact = cols.map((column, index) => !column.hasEvents && Boolean(cols[index - 1]?.hasEvents || cols[index + 1]?.hasEvents));
  const template = cols.map((_, index) => compact[index] ? "var(--day-col-compact-w, 3.2rem)" : "minmax(0, 1fr)").join(" ");
  const layoutKey = bars.map((bar) => `${bar.id}:${bar.startCol}:${bar.endCol}:${bar.lane}`).join("|");

  const barPositions = useBarPositions({
    gridRef, cellRefs: columnRefs, rows: [bars], columns: 7,
    headRem: HEAD_REM, laneRem: LANE_REM, layoutKey: `${layoutKey}|${template}`,
  });
  return <section className="panel reveal flex flex-col h-full" style={{ animationDelay: "120ms" }}>
    <div className="panel-title">Próximos 7 días</div>
    <div ref={gridRef} className="week-grid flex-1" style={{ gridTemplateColumns: template }}>
      {cols.map((column, index) => <DayColumn key={column.day.toISOString()} columnRef={(node) => { columnRefs.current[index] = node; }} {...column} compact={compact[index]} laneCount={laneCount} multiDayIds={multiDayIds} forecast={dailyFor(weather, column.day)} />)}
      {bars.filter((bar) => bar.lane < MAX_LANES).map((bar) => <div key={bar.id} className="week-bar" title={bar.event.title} style={{ ...barPositions[bar.id], ...chip(bar.event.color) }}><span className="week-bar-label"><EventTitle title={bar.event.title} /></span></div>)}
    </div>
  </section>;
}
