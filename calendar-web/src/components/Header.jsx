import { fmtLongDate, fmtTime, fmtAgo } from "../lib/dates.js";

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
  const dot = (
    <span
      style={{
        width: 9, height: 9, borderRadius: "50%", background: meta.c,
        boxShadow: `0 0 10px ${meta.c}`, display: "inline-block",
      }}
    />
  );

  return (
    <div className="flex items-center gap-2 text-dim" style={{ fontSize: "0.95rem" }}>
      {at && <><span>Actualizado {at}</span>{sep}</>}
      <span className="flex items-center gap-1.5" style={{ letterSpacing: "0.06em" }}>
        {dot}{meta.label}
      </span>
      {ago && <>{sep}<span>hace {ago}</span></>}
    </div>
  );
}

export default function Header({ now, calendars, status, lastUpdated, view = 1 }) {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return (
    <header className="flex items-end justify-between px-8 pt-6 pb-4">
      <div className="flex items-baseline gap-5">
        <div className="clock tabular">{hh}<span className="clock-colon">:</span>{mm}</div>
        <div className="leading-tight">
          <div className="font-display" style={{ fontSize: "1.7rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
            {capFirst(fmtLongDate(now))}
          </div>
          {view === 2 && <div className="view-tag">Vista 2 · mes completo</div>}
          {view === 3 && <div className="view-tag">Vista 3 · próximas semanas</div>}
        </div>
      </div>

      <div className="flex flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1">
          {calendars.map((c) => (
            <div key={c.name} className="flex items-center gap-2">
              <span style={{ width: 12, height: 12, borderRadius: 3, background: c.color }} />
              <span className="text-dim" style={{ fontSize: "1.05rem" }}>{c.name}</span>
            </div>
          ))}
        </div>
        <StatusDot status={status} lastUpdated={lastUpdated} now={now} />
      </div>
    </header>
  );
}
