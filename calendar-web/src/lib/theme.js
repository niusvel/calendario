// La pantalla vive en la pared del salon: de dia gana la legibilidad y de noche
// no debe alumbrar la habitacion. El tema se resuelve por la hora local.

export const DAY_STARTS = 7;    // 07:00 -> claro
export const NIGHT_STARTS = 21; // 21:00 -> oscuro

export function themeFor(date) {
  const hour = date.getHours();
  return hour >= DAY_STARTS && hour < NIGHT_STARTS ? "light" : "dark";
}
