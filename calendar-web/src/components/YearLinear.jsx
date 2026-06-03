import { useMemo } from "react";
import {
  WEEKDAYS_MINI, MONTHS_SHORT, daysInMonth, mondayOffset,
  eventDayRange, startOfDay, sameDay,
} from "../lib/dates.js";

// Cada mes se parte en DOS sub-filas de SPLIT columnas (3 semanas) -> menos
// columnas = celdas mas anchas. El desplazamiento de 21 (=3 semanas) preserva la
// alineacion de dia de semana, asi que las bandas de finde siguen verticales.
const SPLIT = 21;
const MAX_LANES = 2; // carriles de evento por sub-fila (las filas son mas bajas)

function tint(hex, alpha = "40") {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? hex + alpha : hex;
}

const isWeekendCol = (c) => c % 7 === 5 || c % 7 === 6; // col 0 = lunes

// Empaqueta barras (con startCol/endCol) en carriles sin solapamiento (greedy).
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

export default function YearLinear({ now, events }) {
  const year = now.getFullYear();

  // 24 sub-filas (12 meses × 2). Cada una con sus barras ya empaquetadas.
  const rows = useMemo(() => {
    const out = [];
    for (let m = 0; m < 12; m++) {
      const offset = mondayOffset(year, m);
      const dim = daysInMonth(year, m);
      const monthStart = new Date(year, m, 1);
      const monthEnd = new Date(year, m, dim);
      for (let r = 0; r < 2; r++) {
        // dias (1-based) que caen en esta sub-fila (segun la columna global).
        const domLo = Math.max(1, r * SPLIT - offset + 1);
        const domHi = Math.min(dim, r * SPLIT + SPLIT - 1 - offset + 1);
        const items = [];
        if (domLo <= domHi) {
          for (const ev of events) {
            const [s, e] = eventDayRange(ev);
            if (e < monthStart || s > monthEnd) continue;       // no toca el mes
            const cs = Math.max(domLo, s < monthStart ? 1 : s.getDate());
            const ce = Math.min(domHi, e > monthEnd ? dim : e.getDate());
            if (cs > ce) continue;                              // no toca esta mitad
            items.push({
              id: `${ev.id}-${m}-${r}`, color: ev.color, title: ev.title,
              startCol: offset + cs - 1 - r * SPLIT,
              endCol: offset + ce - 1 - r * SPLIT,
            });
          }
        }
        out.push({ m, r, offset, dim, bars: packLanes(items) });
      }
    }
    return out;
  }, [year, events]);

  const colPct = 100 / SPLIT;
  const today = startOfDay(now);
  const gridCols = { gridTemplateColumns: `repeat(${SPLIT}, 1fr)` };

  return (
    <section className="year reveal">
      <div className="panel-title">{year} · año</div>

      {/* Cabecera de columnas: L M X J V S D (×3 semanas) */}
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

      {/* 24 sub-filas (2 por mes) */}
      <div className="year-body">
        {rows.map(({ m, r, offset, dim, bars }) => (
          <div key={`${m}-${r}`} className={"year-row" + (r === 0 ? " year-row-first" : "")}>
            <div className="year-label year-month">{r === 0 ? MONTHS_SHORT[m] : ""}</div>
            <div className="year-track">
              <div className="year-grid" style={gridCols}>
                {Array.from({ length: SPLIT }, (_, c) => {
                  const dom = r * SPLIT + c - offset + 1;
                  const valid = dom >= 1 && dom <= dim;
                  const isToday = valid && sameDay(new Date(year, m, dom), today);
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
              {bars.filter((it) => it.lane < MAX_LANES).map((it) => (
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
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
