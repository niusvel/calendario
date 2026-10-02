import { fmtLongDate, fmtTime, fmtAgo } from "../lib/dates.js";
import { WeatherHeadline } from "./Weather.jsx";

// Capitaliza solo la primera letra (no cada palabra: en es. "miércoles 3 de junio").
function capFirst(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Layout: Actualizado HH:MM · ● ONLINE · hace T
function StatusDot({ status, lastUpdated, now }) {
  const meta = {
    ok: { c: "var(--color-ok)", label: "ONLINE" },
    loading: { c: "var(--color-dim)", label: "CARGANDO" },
    error: { c: "var(--color-warn)", label: "OFFLINE" },
  }[status] || { c: "var(--color-dim)", label: "CARGANDO" };

  // Hora absoluta de la ultima repoblacion del backend desde iCloud.
  const at = lastUpdated ? fmtTime(new Date(lastUpdated)) : null;
  // Tiempo transcurrido desde ese sello, en la unidad mas representativa.
  const ago = lastUpdated
    ? fmtAgo((now.getTime() - new Date(lastUpdated).getTime()) / 1000)
    : null;

  const sep = <span style={{ opacity: 0.45 }}>·</span>;
  return (
    <div className="header-status text-dim">
      {at && <><span>Actualizado {at}</span>{sep}</>}
      <span className="status-label">
        <span className="status-dot" style={{ background: meta.c, boxShadow: `0 0 10px ${meta.c}` }} />
        {meta.label}
      </span>
      {ago && <>{sep}<span>hace {ago}</span></>}
    </div>
  );
}

// Tres zonas a lo ancho de la pantalla: reloj y fecha, el tiempo en el centro y,
// a la derecha, la leyenda de calendarios con el estado debajo.
export default function Header({ now, calendars, status, lastUpdated, view = 1, weather = null }) {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <header className="header">
      <div className="header-left">
        <div className="clock tabular">{hh}<span className="clock-colon">:</span>{mm}</div>
        <div className="leading-tight">
          <div className="font-display header-date">{capFirst(fmtLongDate(now))}</div>
          {view === 2 && <div className="view-tag">Vista 2 · mes completo</div>}
          {view === 3 && <div className="view-tag">Vista 3 · próximas semanas</div>}
        </div>
      </div>

      <div className="header-center">
        <WeatherHeadline weather={weather} now={now} />
      </div>

      <div className="header-right">
        <div className="header-legend">
          {calendars.map((c) => (
            <div key={c.name} className="legend-item">
              <span className="legend-swatch" style={{ background: c.color }} />
              <span className="legend-name">{c.name}</span>
            </div>
          ))}
        </div>
        <StatusDot status={status} lastUpdated={lastUpdated} now={now} />
      </div>
    </header>
  );
}
