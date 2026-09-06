import { vacationsOnDay } from "../lib/dates.js";

// Las vacaciones se marcaban rellenando el dia entero con color translucido, que
// sobre fondo claro se leia como una mancha gris. Ahora van como una cinta de
// color solido en el borde inferior: identifican al propietario sin tapar nada.
export default function VacationShade({ day, events }) {
  const vacations = vacationsOnDay(events, day);
  if (!vacations.length) return null;

  const stops = vacations.map((event, index) => {
    const from = (index / vacations.length) * 100;
    const to = ((index + 1) / vacations.length) * 100;
    return `${event.color} ${from}%, ${event.color} ${to}%`;
  }).join(", ");
  const owners = vacations.map((event) => event.calendar).join(", ");

  return (
    <span
      className="vacation-band"
      style={{ background: `linear-gradient(90deg, ${stops})` }}
      title={`Vacaciones: ${owners}`}
      aria-label={`Vacaciones: ${owners}`}
    />
  );
}
