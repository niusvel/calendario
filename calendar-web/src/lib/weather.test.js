import assert from "node:assert/strict";
import test from "node:test";
import { weatherIcon, fmtTemp, dailyFor, focusDay } from "./weather.js";

test("cada codigo WMO tiene icono y texto, con variante nocturna donde cambia", () => {
  assert.deepEqual(weatherIcon(0, true), { icon: "☀️", label: "Despejado" });
  assert.deepEqual(weatherIcon(0, false), { icon: "🌙", label: "Despejado" });
  assert.equal(weatherIcon(61).icon, "🌧️");
  assert.equal(weatherIcon(95).label, "Tormenta");
});

test("un codigo desconocido no rompe nada", () => {
  assert.equal(weatherIcon(123).icon, "🌡️");
});

test("la temperatura se redondea con grado", () => {
  assert.equal(fmtTemp(20.7), "21°");
  assert.equal(fmtTemp(-0.4), "0°");
});

test("dailyFor busca por fecha local", () => {
  const weather = { daily: [{ date: "2026-09-10", tmax: 21 }] };
  assert.equal(dailyFor(weather, new Date(2026, 8, 10, 23, 30)).tmax, 21);
  assert.equal(dailyFor(weather, new Date(2026, 8, 11)), null);
  assert.equal(dailyFor(null, new Date()), null);
});

const WEEK = { daily: [{ date: "2026-09-09", tmax: 21, tmin: 14 }, { date: "2026-09-10", tmax: 24, tmin: 12 }] };

test("por la mañana y la tarde el dia que importa es hoy", () => {
  assert.equal(focusDay(WEEK, new Date(2026, 8, 9, 7, 30)).label, "Hoy");
  assert.equal(focusDay(WEEK, new Date(2026, 8, 9, 17, 59)).tmax, 21);
});

test("desde las 18:00 se prepara la ropa de mañana", () => {
  const evening = focusDay(WEEK, new Date(2026, 8, 9, 18, 0));
  assert.equal(evening.label, "Mañana");
  assert.equal(evening.tmax, 24);
});

test("de madrugada vuelve a ser hoy, aunque el pronostico este viejo", () => {
  // A la 01:00 del dia 10 el pronostico aun empieza en el dia 9: se busca por fecha.
  const night = focusDay(WEEK, new Date(2026, 8, 10, 1, 0));
  assert.equal(night.label, "Hoy");
  assert.equal(night.tmax, 24);
});

test("sin pronostico para hoy no se inventa nada", () => {
  assert.equal(focusDay(WEEK, new Date(2026, 8, 20, 12)), null);
});
