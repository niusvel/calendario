import assert from "node:assert/strict";
import test from "node:test";
import { mondayOf, weeksFrom, sameDay, eventDayRange } from "./dates.js";

const d = (y, m, day) => new Date(y, m - 1, day);

test("mondayOf devuelve el lunes de esa semana", () => {
  assert.ok(sameDay(mondayOf(d(2026, 9, 6)), d(2026, 8, 31)));  // domingo -> lunes anterior
  assert.ok(sameDay(mondayOf(d(2026, 8, 31)), d(2026, 8, 31))); // un lunes se devuelve igual
  assert.ok(sameDay(mondayOf(d(2026, 9, 1)), d(2026, 8, 31)));  // cruza el cambio de mes
});

test("weeksFrom encadena semanas de siete dias sin cortar por meses", () => {
  const weeks = weeksFrom(d(2026, 8, 31), 3);
  assert.equal(weeks.length, 3);
  assert.ok(weeks.every((week) => week.length === 7));
  assert.ok(sameDay(weeks[0][0], d(2026, 8, 31)));
  assert.ok(sameDay(weeks[0][6], d(2026, 9, 6)));
  assert.ok(sameDay(weeks[2][6], d(2026, 9, 20)));
});

test("un evento de todo el dia termina el dia anterior a su fin exclusivo", () => {
  // iCloud publica el cumple del 31 con fin el 1: no debe invadir el dia siguiente.
  const [start, end] = eventDayRange({ all_day: true, start: "2026-08-31", end: "2026-09-01" });
  assert.ok(sameDay(start, d(2026, 8, 31)));
  assert.ok(sameDay(end, d(2026, 8, 31)));
  assert.ok(sameDay(start, end), "un dia suelto no debe pintarse como barra");
});
