import {
  monthMatrix, eventsOnDay, sameDay, MONTHS_LONG, WEEKDAYS_MINI,
} from "../lib/dates.js";

export default function MiniMonth({ now, events }) {
  const weeks = monthMatrix(now);

  return (
    <section className="panel reveal flex flex-col h-full" style={{ animationDelay: "240ms" }}>
      <div className="panel-title capitalize">
        {MONTHS_LONG[now.getMonth()]} {now.getFullYear()}
      </div>

      <div className="mini-dow">
        {WEEKDAYS_MINI.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="mini-grid flex-1">
        {weeks.flat().map((cell, idx) => {
          const isToday = sameDay(cell.date, now);
          const dayEvents = cell.inMonth ? eventsOnDay(events, cell.date) : [];
          // hasta 3 colores distintos de los calendarios con eventos ese dia
          const colors = [];
          for (const ev of dayEvents) {
            if (!colors.includes(ev.color)) colors.push(ev.color);
            if (colors.length >= 3) break;
          }
          return (
            <div
              key={idx}
              className={
                "mini-cell" +
                (cell.inMonth ? "" : " mini-out") +
                (isToday ? " mini-today" : "")
              }
            >
              <span className="mini-num tabular">{cell.date.getDate()}</span>
              {colors.length > 0 && (
                <span className="mini-dots">
                  {colors.map((c, i) => (
                    <span key={i} style={{ background: c }} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
