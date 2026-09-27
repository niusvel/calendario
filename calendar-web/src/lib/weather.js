// Codigos de tiempo WMO (los que devuelve Open-Meteo) a icono y texto. De noche
// el cielo despejado y las nubes sueltas cambian de dibujo; el resto no.
const CODES = [
  [[0], "☀️", "🌙", "Despejado"],
  [[1], "🌤️", "🌙", "Casi despejado"],
  [[2], "⛅", "☁️", "Nubes y claros"],
  [[3], "☁️", "☁️", "Nublado"],
  [[45, 48], "🌫️", "🌫️", "Niebla"],
  [[51, 53, 55, 56, 57], "🌦️", "🌧️", "Llovizna"],
  [[61, 63, 65, 66, 67], "🌧️", "🌧️", "Lluvia"],
  [[71, 73, 75, 77], "🌨️", "🌨️", "Nieve"],
  [[80, 81, 82], "🌦️", "🌧️", "Chubascos"],
  [[85, 86], "🌨️", "🌨️", "Nieve"],
  [[95, 96, 99], "⛈️", "⛈️", "Tormenta"],
];

export function weatherIcon(code, isDay = true) {
  const row = CODES.find(([codes]) => codes.includes(code));
  if (!row) return { icon: "🌡️", label: "" };
  return { icon: isDay ? row[1] : row[2], label: row[3] };
}

export const fmtTemp = (value) => `${Math.round(value)}°`;

// Que dia enseñar: hasta las 18:00 el de hoy (por la mañana hace fresco pero lo
// que importa es la maxima); desde las 18:00, mañana, que es cuando se prepara
// la ropa. De madrugada vuelve a ser hoy. Se busca por fecha, no por posicion,
// porque el pronostico puede llevar media hora sin refrescarse tras medianoche.
export const EVENING_STARTS = 18;

export function focusDay(weather, now) {
  const today = dailyFor(weather, now);
  if (!today) return null;
  if (now.getHours() >= EVENING_STARTS) {
    const tomorrow = dailyFor(weather, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    if (tomorrow) return { ...tomorrow, label: "Mañana" };
  }
  return { ...today, label: "Hoy" };
}

// Pronostico del dia con esa fecha local (YYYY-MM-DD), si lo hay.
export function dailyFor(weather, day) {
  if (!weather?.daily) return null;
  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  return weather.daily.find((d) => d.date === key) || null;
}
