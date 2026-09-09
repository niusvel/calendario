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

// Pronostico del dia con esa fecha local (YYYY-MM-DD), si lo hay.
export function dailyFor(weather, day) {
  if (!weather?.daily) return null;
  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  return weather.daily.find((d) => d.date === key) || null;
}
