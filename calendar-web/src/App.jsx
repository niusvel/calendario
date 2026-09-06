import { useEffect, useMemo, useRef, useState } from "react";
import { fetchEvents } from "./lib/api.js";
import { addDays, startOfDay, coversDay } from "./lib/dates.js";
import { themeFor } from "./lib/theme.js";
import Header from "./components/Header.jsx";
import Confetti from "./components/Confetti.jsx";
import KioskShortcut from "./components/KioskShortcut.jsx";
import TodayTimeline from "./components/TodayTimeline.jsx";
import WeekGrid from "./components/WeekGrid.jsx";
import MiniMonth from "./components/MiniMonth.jsx";
import QuarterView from "./components/QuarterView.jsx";
import MonthFull from "./components/MonthFull.jsx";

const REFRESH_MS = 60_000;        // re-consulta al backend cada minuto
const ROTATE_MS = 60_000;         // rota a la siguiente vista cada minuto
const BIRTHDAY_CAL = "CUMPLES";   // calendario cuyos eventos disparan el confeti

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
    // from: inicio del mes actual - 7 (cubre el mini-mes y la Vista 1).
    const from = addDays(new Date(today.getFullYear(), today.getMonth(), 1), -7);
    // to: la Vista 3 muestra mes actual + 2 siguientes -> ultimo dia de (mes+2).
    const quarterEnd = new Date(today.getFullYear(), today.getMonth() + 3, 0);
    const v1to = addDays(today, 45);
    const to = v1to > quarterEnd ? v1to : quarterEnd;
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

  // Rotacion automatica de vistas (1 -> 2 -> 3 -> 1) cada ROTATE_MS, mas control
  // manual con teclas 1/2/3. Una pulsacion manual reinicia el minuto, de modo que
  // la vista elegida se ve un minuto completo antes de seguir rotando.
  const rotateTimer = useRef(null);
  useEffect(() => {
    const arm = () => {
      clearTimeout(rotateTimer.current);
      rotateTimer.current = setTimeout(() => {
        setView((v) => (v % 3) + 1);   // 1->2->3->1
        arm();                          // re-programa la siguiente rotacion
      }, ROTATE_MS);
    };
    const onKey = (e) => {
      const v = { "1": 1, "2": 2, "3": 3 }[e.key];
      if (!v) return;
      setView(v);
      arm();   // reinicia el minuto desde la seleccion manual
    };
    arm();     // arranca la rotacion
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(rotateTimer.current);
    };
  }, []);

  // Claro de dia y oscuro de noche: solo cambia dos veces al dia, asi que el
  // efecto no se dispara con el reloj de cada segundo.
  const theme = themeFor(now);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const calendars = useMemo(() => {
    const seen = new Map();
    for (const ev of events) if (!seen.has(ev.calendar)) seen.set(ev.calendar, ev.color);
    return [...seen.entries()]
      .map(([name, color]) => ({ name, color }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [events]);

  // Colores de los cumpleanos de HOY (calendario CUMPLES). null si no hay ninguno;
  // alimenta el confeti. Se recalcula solo al cambiar de dia o los eventos (no cada
  // segundo): la dependencia es la clave del dia, no el reloj `now`.
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  const birthdayColors = useMemo(() => {
    const [y, m, d] = todayKey.split("-").map(Number);
    const today = new Date(y, m, d);
    const colors = events
      .filter((ev) => ev.calendar === BIRTHDAY_CAL && coversDay(ev, today))
      .map((ev) => ev.color)
      .filter(Boolean);
    return colors.length ? colors : null;
  }, [events, todayKey]);

  return (
    <div className="app">
      <Header now={now} calendars={calendars} status={status} lastUpdated={lastUpdated} view={view} />
      {view === 2 ? (
        <MonthFull now={now} events={events} />
      ) : view === 3 ? (
        <QuarterView now={now} events={events} />
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
      <Confetti colors={birthdayColors} />
      <KioskShortcut />
    </div>
  );
}
