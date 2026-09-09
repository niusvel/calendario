import { weatherIcon, fmtTemp } from "../lib/weather.js";

// Tira compacta para cuando la rejilla de horas ocupa el panel: ahora, maxima y
// minima y probabilidad de lluvia del dia, en una linea.
export function WeatherStrip({ weather }) {
  if (!weather) return null;
  const now = weatherIcon(weather.current.code, weather.current.is_day);
  const today = weather.daily[0];
  return (
    <div className="wx-strip">
      <span className="wx-icon">{now.icon}</span>
      <span className="wx-temp tabular">{fmtTemp(weather.current.temp)}</span>
      <span className="wx-label">{now.label}</span>
      <span className="wx-range tabular">{fmtTemp(today.tmax)} / {fmtTemp(today.tmin)}</span>
      {today.rain >= 20 && <span className="wx-rain">💧 {today.rain}%</span>}
    </div>
  );
}

// Panel grande para los dias sin citas con hora: el ahora en grande y las
// proximas horas debajo, para saber si hay que salir con paraguas.
export function WeatherToday({ weather }) {
  if (!weather) return null;
  const now = weatherIcon(weather.current.code, weather.current.is_day);
  const today = weather.daily[0];
  return (
    <div className="wx-today">
      <div className="wx-now">
        <span className="wx-now-icon">{now.icon}</span>
        <div>
          <div className="wx-now-temp tabular">{fmtTemp(weather.current.temp)}</div>
          <div className="wx-now-label">{now.label}{weather.place ? ` · ${weather.place}` : ""}</div>
        </div>
        <div className="wx-now-side">
          <div className="tabular">↑ {fmtTemp(today.tmax)}&nbsp;&nbsp;↓ {fmtTemp(today.tmin)}</div>
          <div className="tabular">💧 {today.rain}%</div>
          <div className="tabular">🌅 {today.sunrise}&nbsp;&nbsp;🌇 {today.sunset}</div>
        </div>
      </div>
      <div className="wx-hours">
        {weather.hourly.slice(0, 12).map((hour) => {
          const w = weatherIcon(hour.code, hour.is_day);
          return (
            <div key={hour.time} className="wx-hour">
              <div className="wx-hour-time tabular">{hour.time.slice(11, 16)}</div>
              <div className="wx-hour-icon">{w.icon}</div>
              <div className="wx-hour-temp tabular">{fmtTemp(hour.temp)}</div>
              <div className={"wx-hour-rain tabular" + (hour.rain >= 50 ? " wx-wet" : "")}>{hour.rain > 0 ? `${hour.rain}%` : ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Icono y maxima/minima para la tarjeta de un dia proximo.
export function WeatherDay({ day, compact = false }) {
  if (!day) return null;
  const w = weatherIcon(day.code, true);
  return (
    <span className="wx-day" title={w.label}>
      <span className="wx-day-icon">{w.icon}</span>
      {!compact && <span className="wx-day-range tabular">{fmtTemp(day.tmax)}<span className="wx-day-min">/{fmtTemp(day.tmin)}</span></span>}
    </span>
  );
}
