import { useMemo } from "react";
import {
  WEEKDAYS_MINI, MONTHS_LONG, MONTHS_SHORT, daysInMonth, mondayOffset,
  eventDayRange, startOfDay, sameDay,
} from "../lib/dates.js";

// 3 meses (actual + 2 siguientes). Cada mes se reparte en filas de SPLIT columnas
// (2 semanas); el mes ocupa tantas filas como necesite. Menos datos en pantalla =
// celdas grandes y legibles. El shift de 14 (=2·7) preserva la alineacion de dia
// de semana, asi las bandas de finde quedan verticales.
const SPLIT = 14;
const MAX_LANES = 3; // carriles de evento por fila

function tint(hex, alpha = "40") {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex + alpha : hex;
}

const isWeekendCol = (c) => c % 7 === 5 || c % 7 === 6; // col 0 = lunes

function packLanes(items) {
  const sorted = [...items].sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
  const laneEnds = [];
  for (const it of sorted) {
    let lane = laneEnds.findIndex((end) => end < it.startCol);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.endCol); }
    else laneEnds[lane] = it.endCol;
    it.lane = lane;
  }
  return sorted;
}

export default function QuarterView({ now, events }) {
  const baseYear = now.getFullYear();
  const baseMonth = now.getMonth();

  const { subRows, title } = useMemo(() => {
    const subRows = [];
    let first = null, last = null;
    for (let i = 0; i < 3; i++) {
      const d = new Date(baseYear, baseMonth + i, 1);  // maneja el cambio de año
      const y = d.getFullYear();
      const m = d.getMonth();
      const offset = mondayOffset(y, m);
      const dim = daysInMonth(y, m);
      const nRows = Math.ceil((offset + dim) / SPLIT);
      const monthStart = new Date(y, m, 1);
      const monthEnd = new Date(y, m, dim);
      if (i === 0) first = { y, m };
      if (i === 2) last = { y, m };

      for (let r = 0; r < nRows; r++) {
        // rango de dias (1-based) que caen en esta fila
        const domLo = Math.max(1, r * SPLIT - offset + 1);
        const domHi = Math.min(dim, r * SPLIT + SPLIT - 1 - offset + 1);
        const items = [];
        if (domLo <= domHi) {
          for (const ev of events) {
            const [s, e] = eventDayRange(ev);
            if (e < monthStart || s > monthEnd) continue;
            const cs = Math.max(domLo, s < monthStart ? 1 : s.getDate());
            const ce = Math.min(domHi, e > monthEnd ? dim : e.getDate());
            if (cs > ce) continue;
            items.push({
              id: `${ev.id}-${y}-${m}-${r}`, color: ev.color, title: ev.title,
              startCol: offset + cs - 1 - r * SPLIT,
              endCol: offset + ce - 1 - r * SPLIT,
            });
          }
        }
        subRows.push({ y, m, r, offset, dim, isFirst: r === 0, bars: packLanes(items) });
      }
    }
    const title = first.y === last.y
      ? `${MONTHS_LONG[first.m]} – ${MONTHS_LONG[last.m]} ${last.y}`
      : `${MONTHS_LONG[first.m]} ${first.y} – ${MONTHS_LONG[last.m]} ${last.y}`;
    return { subRows, title };
  }, [baseYear, baseMonth, events]);

  const colPct = 100 / SPLIT;
  const today = startOfDay(now);
  const gridCols = { gridTemplateColumns: `repeat(${SPLIT}, 1fr)` };

  return (
    <section className="year reveal">
      <div className="panel-title">{title}</div>

      {/* Cabecera: L M X J V S D (×2 semanas) */}
      <div className="year-head">
        <div className="year-label" />
        <div className="year-track">
          <div className="year-grid" style={gridCols}>
            {Array.from({ length: SPLIT }, (_, c) => (
              <div key={c} className={"year-dow" + (isWeekendCol(c) ? " year-weekend" : "")}>
                {WEEKDAYS_MINI[c % 7]}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="year-body">
        {subRows.map((row, idx) => (
          <div key={idx} className={"year-row" + (row.isFirst ? " year-row-first" : "")}>
            <div className="year-label year-month">{row.isFirst ? MONTHS_SHORT[row.m] : ""}</div>
            <div className="year-track">
              <div className="year-grid" style={gridCols}>
                {Array.from({ length: SPLIT }, (_, c) => {
                  const dom = row.r * SPLIT + c - row.offset + 1;
                  const valid = dom >= 1 && dom <= row.dim;
                  const isToday = valid && sameDay(new Date(row.y, row.m, dom), today);
                  return (
                    <div
                      key={c}
                      className={
                        "year-cell" +
                        (isWeekendCol(c) ? " year-weekend" : "") +
                        (valid ? "" : " year-cell-out") +
                        (isToday ? " year-today" : "")
                      }
                    >
                      {valid && <span className="year-num tabular">{dom}</span>}
                    </div>
                  );
                })}
              </div>
              {row.bars.filter((it) => it.lane < MAX_LANES).map((it) => (
                <div
                  key={it.id}
                  className="year-bar"
                  title={it.title}
                  style={{
                    left: `${it.startCol * colPct}%`,
                    width: `${(it.endCol - it.startCol + 1) * colPct}%`,
                    top: `calc(var(--year-num-h) + ${it.lane} * var(--year-lane-h))`,
                    background: tint(it.color, "40"),
                    borderLeft: `3px solid ${it.color}`,
                  }}
                >
                  <span className="year-bar-label">{it.title}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
