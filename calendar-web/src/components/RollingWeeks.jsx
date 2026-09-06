import {
  WEEKDAYS_MINI, MONTHS_LONG, MONTHS_SHORT, mondayOf, weeksFrom,
  addDays, startOfDay, eventDayRange, isVacationEvent, sameDay,
} from "../lib/dates.js";
import { packLanes } from "../lib/lanes.js";
import { chip } from "../lib/colors.js";
import DayCell from "./DayCell.jsx";
import EventTitle from "./EventTitle.jsx";

// Semanas consecutivas en lugar de tres meses de calendario. Antes cada mes se
// partia en filas de catorce columnas, asi que un dia medida la mitad y los
// titulos no cabian; ademas los meses lejanos salian vacios mientras la semana
// en curso iba apretada. Ahora se ve la semana pasada, la actual y todo lo que
// entre hacia delante, con la numeracion seguida y una linea gruesa por mes.
export const PAST_WEEKS = 1;
export const TOTAL_WEEKS = 8;
const MAX_LANES = 2;
const COLUMNS = 7;
const DAY_MS = 86_400_000;

// Rango completo que abarca la vista; el backend debe cubrirlo.
export function rollingRange(now) {
  const first = addDays(mondayOf(now), -PAST_WEEKS * 7);
  return [first, addDays(first, TOTAL_WEEKS * COLUMNS - 1)];
}

// El mes de una fila es el de su jueves: la semana se atribuye al mes en el que
// cae la mayoria de sus dias, que es como se leen los calendarios de pared.
const monthOfWeek = (week) => week[3];

export default function RollingWeeks({ now, events }) {
  const today = startOfDay(now);
  const [first, last] = rollingRange(now);
  const weeks = weeksFrom(first, TOTAL_WEEKS);

  const barsByWeek = weeks.map((week) => {
    const weekStart = week[0];
    const weekEnd = week[6];
    const items = events.flatMap((event) => {
      if (isVacationEvent(event)) return [];
      const [start, end] = eventDayRange(event);
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
  const hiddenByDay = new Map();
  barsByWeek.forEach((bars, weekIndex) => bars.filter((bar) => bar.lane >= MAX_LANES).forEach((bar) => {
    for (let column = bar.startCol; column <= bar.endCol; column++) {
      const key = weeks[weekIndex][column].getTime();
      hiddenByDay.set(key, (hiddenByDay.get(key) || 0) + 1);
    }
  }));

  const colPct = 100 / COLUMNS;
  const title = first.getFullYear() === last.getFullYear()
    ? `${MONTHS_LONG[first.getMonth()]} – ${MONTHS_LONG[last.getMonth()]} ${last.getFullYear()}`
    : `${MONTHS_LONG[first.getMonth()]} ${first.getFullYear()} – ${MONTHS_LONG[last.getMonth()]} ${last.getFullYear()}`;

  return (
    <section className="roll reveal">
      <div className="panel-title capitalize">{title}</div>

      <div className="roll-head">
        <div className="roll-gutter" />
        <div className="roll-track">
          <div className="roll-grid">
            {WEEKDAYS_MINI.map((d, i) => <div key={i} className="roll-dow">{d}</div>)}
          </div>
        </div>
      </div>

      <div className="roll-body">
        {weeks.map((week, weekIndex) => {
          const month = monthOfWeek(week).getMonth();
          const opensMonth = weekIndex === 0 || monthOfWeek(weeks[weekIndex - 1]).getMonth() !== month;
          const laneCount = Math.min(MAX_LANES, Math.max(0, ...barsByWeek[weekIndex].map((bar) => bar.lane + 1)));
          return (
            <div key={week[0].toISOString()} className={"roll-row" + (opensMonth ? " roll-month" : "")}>
              <div className="roll-gutter roll-month-name">{opensMonth ? MONTHS_SHORT[month] : ""}</div>
              <div className="roll-track">
                <div className="roll-grid">
                  {week.map((day) => (
                    <DayCell
                      key={day.toISOString()}
                      day={day}
                      now={now}
                      events={events}
                      multiDayIds={multiDayIds}
                      hidden={hiddenByDay.get(day.getTime()) || 0}
                      muted={day < today}
                      laneCount={laneCount}
                      // El 1 lleva el mes al lado: la numeracion es seguida y el
                      // cambio de mes puede caer a mitad de fila, sin linea gruesa.
                      label={day.getDate() === 1 ? `1 ${MONTHS_SHORT[day.getMonth()]}` : day.getDate()}
                    />
                  ))}
                </div>
                {barsByWeek[weekIndex].filter((bar) => bar.lane < MAX_LANES).map((bar) => (
                  <div
                    key={bar.id}
                    className="mf-bar"
                    title={bar.event.title}
                    style={{
                      left: `${bar.startCol * colPct}%`,
                      width: `${(bar.endCol - bar.startCol + 1) * colPct}%`,
                      top: `calc(var(--roll-head) + ${bar.lane} * var(--roll-lane))`,
                      ...chip(bar.event.color),
                    }}
                  >
                    <span className="mf-bar-label"><EventTitle title={bar.event.title} /></span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
