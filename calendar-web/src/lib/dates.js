// Utilidades de fechas para el dashboard.
// Clave: distinguir eventos all-day (fechas "YYYY-MM-DD", fin EXCLUSIVO segun
// convencion iCal) de eventos con hora (ISO con zona). Parsear el all-day como
// fecha LOCAL evita el clasico off-by-one con new Date("YYYY-MM-DD") (que es UTC).

export const WEEKDAYS_LONG = [
  "domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado",
];
export const WEEKDAYS_SHORT = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
// Cabecera del mini-mes, empezando en lunes:
export const WEEKDAYS_MINI = ["L", "M", "X", "J", "V", "S", "D"];
export const MONTHS_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
// Etiqueta de fila en la Vista 2 (ano linear):
export const MONTHS_SHORT = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

// --- Parseo --------------------------------------------------------------

// Fecha local (00:00) a partir de "YYYY-MM-DD".
export function localDate(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Inicio del evento como Date local.
export function evStart(ev) {
  return ev.all_day ? localDate(ev.start) : new Date(ev.start);
}

// Fin del evento como Date local. En all-day el "end" es exclusivo.
export function evEnd(ev) {
  return ev.all_day ? localDate(ev.end) : new Date(ev.end);
}

// --- Comparaciones de dias ----------------------------------------------

export function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ¿El evento cubre (toca) ese dia?
export function coversDay(ev, day) {
  const d0 = startOfDay(day).getTime();
  const s = startOfDay(evStart(ev)).getTime();
  if (ev.all_day) {
    // end exclusivo: cubre [s, end)
    const e = startOfDay(evEnd(ev)).getTime();
    return d0 >= s && d0 < e;
  }
  // con hora: cubre [diaInicio, diaFin] inclusive (normalmente un solo dia)
  const e = startOfDay(evEnd(ev)).getTime();
  return d0 >= s && d0 <= e;
}

export function eventsOnDay(events, day) {
  return events.filter((ev) => coversDay(ev, day));
}

// Las vacaciones se identifican por el texto del titulo, sin depender de
// mayusculas, tildes o de que el calendario añada mas texto al resumen.
export function isVacationEvent(ev) {
  return ev.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("vacaciones");
}

export function vacationsOnDay(events, day) {
  const seen = new Set();
  return eventsOnDay(events, day).filter((ev) => {
    if (!isVacationEvent(ev) || seen.has(ev.calendar)) return false;
    seen.add(ev.calendar);
    return true;
  });
}

// --- Formato -------------------------------------------------------------

export function fmtTime(date) {
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtLongDate(d) {
  return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
}

// "Tiempo desde" en la unidad que mejor lo representa. Hasta horas se muestra una
// sola unidad; a partir de dias se acompana de la unidad inferior (d+h, mm+d, yy+mm).
// Umbrales (redaccion del brief): hasta 60s -> s, hasta 60min -> m, hasta 24h -> h,
// a partir de 24h -> d; se pasa DE 30d -> mm; se pasa DE 12mm -> yy.
// Aproximaciones: 1 mes = 30 dias, 1 ano = 12 meses.
export function fmtAgo(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  if (s < 60) return `${s}s`;

  const min = Math.floor(s / 60);
  if (min < 60) return `${min}m`;

  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;

  const d = Math.floor(h / 24);
  if (d <= 30) return `${d}d ${h % 24}h`;     // 30d aun se muestra como dias

  const mm = Math.floor(d / 30);
  if (mm <= 12) return `${mm}mm ${d % 30}d`;   // 12mm aun se muestra como meses

  const yy = Math.floor(mm / 12);
  return `${yy}yy ${mm % 12}mm`;
}

// --- Rejilla del mes -----------------------------------------------------

// Matriz de semanas (lunes-primero) que contiene al dia dado. Cada celda:
// { date, inMonth }.
export function monthMatrix(anchor) {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const first = new Date(year, month, 1);
  // getDay: 0=domingo. Queremos lunes-primero -> offset.
  const offset = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -offset);
  const weeks = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let i = 0; i < 7; i++) {
      row.push({ date: cursor, inMonth: cursor.getMonth() === month });
      cursor = addDays(cursor, 1);
    }
    weeks.push(row);
  }
  // Quitar la ultima semana si esta entera fuera del mes (meses de 5 semanas).
  if (weeks.length && weeks[weeks.length - 1].every((c) => !c.inMonth)) weeks.pop();
  return weeks;
}

// --- Lanes de solapamiento (timeline) -----------------------------------

// Agrupa eventos solapados en clusters y asigna carriles dentro de cada cluster.
// Devuelve [{ ev, lane, lanes }] para calcular ancho/posicion horizontal.
export function layoutLanes(events) {
  const sorted = [...events].sort((a, b) => evStart(a) - evStart(b));
  const out = [];
  let cluster = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    if (!cluster.length) return;
    const laneEnds = []; // fin de cada carril
    const placed = [];
    for (const ev of cluster) {
      const s = evStart(ev).getTime();
      const e = evEnd(ev).getTime();
      let lane = laneEnds.findIndex((end) => end <= s);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(e);
      } else {
        laneEnds[lane] = e;
      }
      placed.push({ ev, lane });
    }
    const lanes = laneEnds.length;
    for (const p of placed) out.push({ ...p, lanes });
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const ev of sorted) {
    const s = evStart(ev).getTime();
    const e = evEnd(ev).getTime();
    if (cluster.length && s >= clusterEnd) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, e);
  }
  flush();
  return out;
}

// --- Vista 2: ano linear -------------------------------------------------

// Numero de dias del mes (month: 0-11).
// Lunes de la semana a la que pertenece la fecha (semanas lunes-primero).
export function mondayOf(d) {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() + 6) % 7));
}

// Semanas consecutivas de siete dias a partir de un lunes. A diferencia de
// monthMatrix no se corta por meses: la numeracion sigue de largo.
export function weeksFrom(firstMonday, total) {
  return Array.from({ length: total }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(firstMonday, week * 7 + day)));
}

// Rango de dias [primero, ultimo] (Date a medianoche local, AMBOS inclusive) que
// cubre un evento. En all-day el 'end' es exclusivo, asi que el ultimo dia real
// es end - 1.
export function eventDayRange(ev) {
  const start = startOfDay(evStart(ev));
  let last;
  if (ev.all_day) {
    last = addDays(startOfDay(evEnd(ev)), -1);
    if (last < start) last = start;
  } else {
    last = startOfDay(evEnd(ev));
  }
  return [start, last];
}
