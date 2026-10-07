import { eventsOnDay, evStart, isVacationEvent, isHolidayEvent } from "./dates.js";
import { stickerFor } from "./stickers.js";

// Vista densa: cada evento del dia es un circulo del color de su calendario con
// su pegatina dentro (o la inicial del titulo si no tiene). Los de varios dias
// aparecen en cada dia que cubren. Vacaciones y festivos ya tinen el fondo.
export const MAX_ICONS = 5;

function initial(title) {
  const letter = (title || "").trim().charAt(0);
  return letter ? letter.toUpperCase() : "•";
}

export function dayIcons(events, day, max = MAX_ICONS) {
  const list = eventsOnDay(events, day)
    .filter((ev) => !isVacationEvent(ev) && !isHolidayEvent(ev))
    .sort((a, b) => {
      if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
      return evStart(a) - evStart(b);
    });
  // Si no caben todos, el ultimo hueco lo ocupa el contador.
  const shown = list.length > max ? list.slice(0, max - 1) : list;
  return {
    icons: shown.map((ev) => ({ id: ev.id, color: ev.color, glyph: stickerFor(ev.title) || initial(ev.title), title: ev.title })),
    more: list.length - shown.length,
  };
}
