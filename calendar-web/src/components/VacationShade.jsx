import { vacationsOnDay } from "../lib/dates.js";

function tint(hex) {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}35` : hex;
}

export default function VacationShade({ day, events }) {
  const vacations = vacationsOnDay(events, day);
  if (!vacations.length) return null;

  const stops = vacations.map((event, index) => {
    const from = (index / vacations.length) * 100;
    const to = ((index + 1) / vacations.length) * 100;
    return `${tint(event.color)} ${from}% ${to}%`;
  }).join(", ");
  const owners = vacations.map((event) => event.calendar).join(", ");

  return <>
    <span className="vacation-shade" style={{ background: `conic-gradient(from 225deg, ${stops})` }} />
    <span className="vacation-marker" title={`Vacaciones: ${owners}`} aria-label={`Vacaciones: ${owners}`}>☀</span>
  </>;
}
