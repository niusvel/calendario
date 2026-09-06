import { dayShadesOn } from "../lib/dates.js";

function wash(hex) {
  return /^#[0-9a-fA-F]{6}$/.test(hex) ? `${hex}3d` : hex;
}

// Vacaciones y festivos tinen el fondo del dia completo: la cinta en el borde
// pasaba desapercibida y el dia debe verse especial de un vistazo. Si hay
// varios propietarios el fondo se reparte en sectores.
export default function DayShade({ day, events }) {
  const shades = dayShadesOn(events, day);
  if (!shades.length) return null;

  const stops = shades.map((event, index) => {
    const from = (index / shades.length) * 100;
    const to = ((index + 1) / shades.length) * 100;
    return `${wash(event.color)} ${from}% ${to}%`;
  }).join(", ");
  const owners = shades.map((event) => event.calendar).join(", ");

  return (
    <span
      className="day-shade"
      style={{ background: `conic-gradient(from 225deg, ${stops})` }}
      title={owners}
      aria-label={owners}
    />
  );
}
