import { evStart, fmtTime } from "../lib/dates.js";
import { chip } from "../lib/colors.js";
import { stickerFor } from "../lib/stickers.js";

// Etiqueta de un evento de un dia. Dos columnas: a la izquierda la hora y, bajo
// ella, la pegatina, que aprovecha el hueco que dejaba el titulo al alinearse a
// la derecha de la hora; sin hora, la pegatina sola. La usan la semana, el mes y
// las semanas consecutivas.
export default function EventPill({ event, showTime = true }) {
  const sticker = stickerFor(event.title);
  const time = showTime && !event.all_day ? fmtTime(evStart(event)) : null;
  return (
    <div className="day-pill" style={chip(event.color)}>
      {(time || sticker) && (
        <span className="day-pill-side">
          {time && <span className="day-pill-time tabular">{time}</span>}
          {sticker && <span className="sticker" aria-hidden="true">{sticker}</span>}
        </span>
      )}
      <span className="day-pill-title">{event.title}</span>
    </div>
  );
}
