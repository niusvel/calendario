import {
  WEEKDAYS_MINI, MONTHS_LONG, MONTHS_SHORT, mondayOf, weeksFrom,
  addDays, startOfDay, sameDay,
} from "../lib/dates.js";
import { dayIcons } from "../lib/icons.js";
import { ink } from "../lib/colors.js";
import DayShade from "./DayShade.jsx";

// Vista densa de semanas consecutivas: la pasada, la actual y cuatro meses por
// delante. Con solo iconos por dia la fila baja a unos 50 px y la vista deja de
// solaparse con la del mes; aqui se ve de un vistazo lo que viene, alli el detalle.
export const PAST_WEEKS = 1;
export const TOTAL_WEEKS = 18;
const COLUMNS = 7;

// Rango completo que abarca la vista; el backend debe cubrirlo.
export function rollingRange(now) {
  const first = addDays(mondayOf(now), -PAST_WEEKS * 7);
  return [first, addDays(first, TOTAL_WEEKS * COLUMNS - 1)];
}

// El mes de una fila es el de su jueves: la semana se atribuye al mes en el que
// cae la mayoria de sus dias, que es como se leen los calendarios de pared.
const monthOfWeek = (week) => week[3];

function IconDay({ day, now, events, muted }) {
  const { icons, more } = dayIcons(events, day);
  const weekend = day.getDay() === 0 || day.getDay() === 6;
  // El 1 lleva el mes al lado: la numeracion es seguida y el cambio de mes puede
  // caer a mitad de fila, sin linea gruesa.
  const label = day.getDate() === 1 ? `1 ${MONTHS_SHORT[day.getMonth()]}` : day.getDate();
  return (
    <div className={"mf-cell ic-cell" + (weekend ? " mf-weekend" : "") + (muted ? " mf-out" : "") + (sameDay(day, now) ? " mf-today" : "")}>
      <DayShade day={day} events={events} />
      <div className="mf-num tabular">{label}</div>
      <div className="ic-row">
        {icons.map((icon) => (
          <span key={icon.id} className="ic" style={{ background: icon.color, color: ink(icon.color) }} title={icon.title}>{icon.glyph}</span>
        ))}
        {more > 0 && <span className="ic ic-more tabular">+{more}</span>}
      </div>
    </div>
  );
}

export default function RollingWeeks({ now, events }) {
  const today = startOfDay(now);
  const [first, last] = rollingRange(now);
  const weeks = weeksFrom(first, TOTAL_WEEKS);
  const title = first.getFullYear() === last.getFullYear()
    ? `${MONTHS_LONG[first.getMonth()]} – ${MONTHS_LONG[last.getMonth()]} ${last.getFullYear()}`
    : `${MONTHS_LONG[first.getMonth()]} ${first.getFullYear()} – ${MONTHS_LONG[last.getMonth()]} ${last.getFullYear()}`;

  return (
    <section className="roll roll-dense reveal">
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
          return (
            <div key={week[0].toISOString()} className={"roll-row" + (opensMonth ? " roll-month" : "")}>
              <div className="roll-gutter roll-month-name">{opensMonth ? MONTHS_SHORT[month] : ""}</div>
              <div className="roll-track">
                <div className="roll-grid">
                  {week.map((day) => <IconDay key={day.toISOString()} day={day} now={now} events={events} muted={day < today} />)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
