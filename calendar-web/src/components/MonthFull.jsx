import { useRef } from "react";
import { monthMatrix, MONTHS_LONG, WEEKDAYS_MINI, eventDayRange, isVacationEvent, sameDay } from "../lib/dates.js";
import { packLanes } from "../lib/lanes.js";
import { useBarPositions } from "../lib/bars.js";
import { chip } from "../lib/colors.js";
import DayCell from "./DayCell.jsx";

const MAX_LANES = 2;
const DAY_MS = 86_400_000;
const HEAD_REM = 2.2;   // numero del dia + su margen inferior
const LANE_REM = 1.65;  // paso vertical entre carriles de barra

export default function MonthFull({ now, events }) {
  const weeks = monthMatrix(now);
  const gridRef = useRef(null);
  const cellRefs = useRef([]);

  // Los eventos de varios dias se fragmentan al cambiar de semana; cada
  // fragmento abarca exactamente sus columnas, huecos de la rejilla incluidos.
  const barsByWeek = weeks.map((week) => {
    const weekStart = week[0].date;
    const weekEnd = week[6].date;
    const items = events.flatMap((event) => {
      if (isVacationEvent(event)) return [];
      const [start, end] = eventDayRange(event);
      // Comparar dos Date con === compara referencias, no fechas: los eventos de
      // un solo dia se colaban como barras de varios dias.
      if (sameDay(start, end) || end < weekStart || start > weekEnd) return [];
      const clippedStart = start < weekStart ? weekStart : start;
      const clippedEnd = end > weekEnd ? weekEnd : end;
      return [{
        id: `${event.id}-${weekStart.toISOString()}`,
        event,
        startCol: Math.round((clippedStart - weekStart) / DAY_MS),
        endCol: Math.round((clippedEnd - weekStart) / DAY_MS),
      }];
    });
    return packLanes(items);
  });

  const multiDayIds = new Set(barsByWeek.flat().map((bar) => bar.event.id));
  // Dias tocados por una barra que se queda fuera de los carriles visibles.
  const hiddenByDay = new Map();
  barsByWeek.forEach((bars, weekIndex) => bars.filter((bar) => bar.lane >= MAX_LANES).forEach((bar) => {
    for (let column = bar.startCol; column <= bar.endCol; column++) {
      const key = weeks[weekIndex][column].date.getTime();
      hiddenByDay.set(key, (hiddenByDay.get(key) || 0) + 1);
    }
  }));

  const layoutKey = barsByWeek.flat().map((bar) => `${bar.id}:${bar.startCol}:${bar.endCol}:${bar.lane}`).join("|");
  const barPositions = useBarPositions({
    gridRef, cellRefs, rows: barsByWeek, columns: 7,
    headRem: HEAD_REM, laneRem: LANE_REM, layoutKey,
  });

  return (
    <section className="mf reveal">
      <div className="panel-title capitalize">{MONTHS_LONG[now.getMonth()]} {now.getFullYear()}</div>
      <div className="mf-dow">{WEEKDAYS_MINI.map((d, i) => <span key={i}>{d}</span>)}</div>
      <div ref={gridRef} className="mf-grid" style={{ gridTemplateRows: `repeat(${weeks.length}, 1fr)` }}>
        {weeks.flat().map((cell, index) => (
          <DayCell
            key={cell.date.toISOString()}
            cellRef={(node) => { cellRefs.current[index] = node; }}
            day={cell.date}
            now={now}
            events={events}
            multiDayIds={multiDayIds}
            hidden={hiddenByDay.get(cell.date.getTime()) || 0}
            muted={!cell.inMonth}
            laneCount={Math.min(MAX_LANES, Math.max(0, ...barsByWeek[Math.floor(index / 7)].map((bar) => bar.lane + 1)))}
          />
        ))}
        {barsByWeek.flatMap((bars) => bars.filter((bar) => bar.lane < MAX_LANES).map((bar) => (
          <div key={bar.id} className="mf-bar" title={bar.event.title} style={{ ...barPositions[bar.id], ...chip(bar.event.color) }}>
            <span className="mf-bar-label">{bar.event.title}</span>
          </div>
        )))}
      </div>
    </section>
  );
}
