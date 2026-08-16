import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { monthMatrix, eventsOnDay, evStart, fmtTime, sameDay, MONTHS_LONG, WEEKDAYS_MINI, eventDayRange, isVacationEvent } from "../lib/dates.js";
import VacationShade from "./VacationShade.jsx";

const MAX_LANES = 3;
const DAY_MS = 86_400_000;

function tint(hex, alpha = "24") { return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex + alpha : hex; }

function packLanes(items) {
  const laneEnds = [];
  return [...items].sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol).map((item) => {
    let lane = laneEnds.findIndex((end) => end < item.startCol);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.endCol;
    return { ...item, lane };
  });
}

function DayCell({ cell, now, events, laneCount, multiDayIds, cellRef }) {
  const day = cell.date;
  const sorted = eventsOnDay(events, day).filter((event) => !multiDayIds.has(event.id) && !isVacationEvent(event)).sort((a, b) => {
    if (a.all_day && !b.all_day) return -1;
    if (!a.all_day && b.all_day) return 1;
    return evStart(a) - evStart(b);
  });
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
  const dow = day.getDay();
  return (
    <div ref={cellRef} className={"mf-cell" + (dow === 0 || dow === 6 ? " mf-weekend" : "") + (cell.inMonth ? "" : " mf-out") + (sameDay(day, now) ? " mf-today" : "")} style={{ "--mf-lanes": laneCount }}>
      <VacationShade day={day} events={events} />
      <div className="mf-num tabular">{day.getDate()}</div>
      <div className="mf-events" ref={listRef}>
        {shown.map((ev) => <div key={ev.id} className="day-pill" style={{ background: tint(ev.color, "24"), borderLeft: `3px solid ${ev.color}` }}>
          {!ev.all_day && <span className="day-pill-time tabular">{fmtTime(evStart(ev))}</span>}
          <span className="day-pill-title">{ev.title}</span>
        </div>)}
        {extra > 0 && <div className="day-more">+{extra} más</div>}
      </div>
    </div>
  );
}

export default function MonthFull({ now, events }) {
  const weeks = monthMatrix(now);
  const gridRef = useRef(null);
  const cellRefs = useRef([]);
  const [barPositions, setBarPositions] = useState({});
  // Se fragmentan al cambiar de semana; cada fragmento usa el grid para abarcar
  // exactamente las columnas, incluidos los huecos entre las celdas.
  const barsByWeek = weeks.map((week) => {
    const weekStart = week[0].date;
    const weekEnd = week[6].date;
    const items = events.flatMap((event) => {
      if (isVacationEvent(event)) return [];
      const [start, end] = eventDayRange(event);
      if (start === end || end < weekStart || start > weekEnd) return [];
      const clippedStart = start < weekStart ? weekStart : start;
      const clippedEnd = end > weekEnd ? weekEnd : end;
      return [{ id: `${event.id}-${weekStart.toISOString()}`, event, startCol: Math.round((clippedStart - weekStart) / DAY_MS), endCol: Math.round((clippedEnd - weekStart) / DAY_MS) }];
    });
    return packLanes(items);
  });
  const multiDayIds = new Set(barsByWeek.flat().map((bar) => bar.event.id));
  const layoutKey = barsByWeek.flat().map((bar) => `${bar.id}:${bar.startCol}:${bar.endCol}:${bar.lane}`).join("|");

  useLayoutEffect(() => {
    const measure = () => {
      const grid = gridRef.current;
      if (!grid) return;
      const gridBox = grid.getBoundingClientRect();
      const next = {};
      barsByWeek.forEach((bars, weekIndex) => bars.forEach((bar) => {
        const first = cellRefs.current[weekIndex * 7 + bar.startCol];
        const last = cellRefs.current[weekIndex * 7 + bar.endCol];
        if (!first || !last) return;
        const a = first.getBoundingClientRect();
        const b = last.getBoundingClientRect();
        next[bar.id] = {
          left: a.left - gridBox.left,
          width: b.right - a.left,
          top: a.top - gridBox.top + 25 + bar.lane * 18,
        };
      }));
      setBarPositions(next);
    };
    measure();
    const observer = window.ResizeObserver ? new ResizeObserver(measure) : null;
    if (observer && gridRef.current) observer.observe(gridRef.current);
    return () => observer?.disconnect();
  }, [layoutKey]);
  return (
    <section className="mf reveal">
      <div className="panel-title capitalize">{MONTHS_LONG[now.getMonth()]} {now.getFullYear()}</div>
      <div className="mf-dow">{WEEKDAYS_MINI.map((d, i) => <span key={i}>{d}</span>)}</div>
      <div ref={gridRef} className="mf-grid" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.flat().map((cell, index) => <DayCell key={cell.date.toISOString()} cellRef={(node) => { cellRefs.current[index] = node; }} cell={cell} now={now} events={events} multiDayIds={multiDayIds} laneCount={Math.min(MAX_LANES, Math.max(0, ...barsByWeek[Math.floor(index / 7)].map((bar) => bar.lane + 1)))} />)}
        {barsByWeek.flatMap((bars) => bars.filter((bar) => bar.lane < MAX_LANES).map((bar) => <div key={bar.id} className="mf-bar" title={bar.event.title} style={{ ...barPositions[bar.id], background: tint(bar.event.color, "40"), borderLeft: `3px solid ${bar.event.color}` }}><span className="mf-bar-label">{bar.event.title}</span></div>))}
      </div>
    </section>
  );
}
