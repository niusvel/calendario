import assert from "node:assert/strict";
import test from "node:test";
import { weatherIcon, fmtTemp, dailyFor } from "./weather.js";

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
