import { useEffect, useMemo, useRef, useState } from "react";
import { fetchEvents } from "./lib/api.js";
import { addDays, startOfDay } from "./lib/dates.js";
import Header from "./components/Header.jsx";
import TodayTimeline from "./components/TodayTimeline.jsx";
import WeekGrid from "./components/WeekGrid.jsx";
import MiniMonth from "./components/MiniMonth.jsx";
import YearLinear from "./components/YearLinear.jsx";

const REFRESH_MS = 60_000;        // re-consulta al backend cada minuto
const AUTO_RETURN_MS = 60_000;    // vuelve solo a la Vista 1 tras N s sin pulsar

export default function App() {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(new Date());
  const [view, setView] = useState(1);              // 1 = dashboard, 2 = ano linear
  const eventsRef = useRef(events);
  eventsRef.current = events;

  async function load() {
    const today = startOfDay(new Date());
    // Union de la ventana de la Vista 1 (mini-mes + 7 dias) y la Vista 2 (ano natural).
    const v1from = addDays(new Date(today.getFullYear(), today.getMonth(), 1), -7);
    const v1to = addDays(today, 45);
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const yearEnd = new Date(today.getFullYear(), 11, 31);
    const from = yearStart < v1from ? yearStart : v1from;
    const to = yearEnd > v1to ? yearEnd : v1to;
    try {
      const data = await fetchEvents(from, to);
      setEvents(data.events || []);
      setLastUpdated(data.last_updated || new Date().toISOString());
      setStatus("ok");
    } catch {
      // Mantener lo ultimo bueno; solo marcar sin conexion.
      setStatus(eventsRef.current.length ? "error" : "error");
    }
  }

  useEffect(() => {
    load();
    const refresh = setInterval(load, REFRESH_MS);
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => {
      clearInterval(refresh);
      clearInterval(clock);
    };
  }, []);

  // Conmutador de vistas (teclas 1/2/3) + auto-retorno a la Vista 1.
  const returnTimer = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      const v = { "1": 1, "2": 2 }[e.key];   // (3 reservado para la Vista 3)
      if (!v) return;
      setView(v);
      clearTimeout(returnTimer.current);
      if (v !== 1) returnTimer.current = setTimeout(() => setView(1), AUTO_RETURN_MS);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(returnTimer.current);
    };
  }, []);

  const calendars = useMemo(() => {
    const seen = new Map();
    for (const ev of events) if (!seen.has(ev.calendar)) seen.set(ev.calendar, ev.color);
    return [...seen.entries()]
      .map(([name, color]) => ({ name, color }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [events]);

  return (
    <div className="app">
      <Header now={now} calendars={calendars} status={status} lastUpdated={lastUpdated} view={view} />
      {view === 2 ? (
        <YearLinear now={now} events={events} />
      ) : (
        <main className="board">
          <div className="board-main">
            <TodayTimeline now={now} events={events} />
          </div>
          <div className="board-side">
            <MiniMonth now={now} events={events} />
          </div>
          <div className="board-week">
            <WeekGrid now={now} events={events} />
          </div>
        </main>
      )}
    </div>
  );
}
