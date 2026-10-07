import assert from "node:assert/strict";
import test from "node:test";
import { dayIcons } from "./icons.js";

const day = new Date(2026, 9, 14);
const ev = (id, title, extra = {}) => ({ id, title, calendar: "LEYA", color: "#1E4C63", all_day: true, start: "2026-10-14", end: "2026-10-15", ...extra });

test("cada evento del dia es un circulo con su pegatina", () => {
  const { icons, more } = dayIcons([ev("a", "Cumple Baldio"), ev("b", "Oftalmólogo niños")], day);
  assert.deepEqual(icons.map((i) => i.glyph), ["🎂", "👓"]);
  assert.equal(icons[0].color, "#1E4C63");
  assert.equal(more, 0);
});

test("sin pegatina se usa la inicial del titulo", () => {
  assert.equal(dayIcons([ev("a", "llamar a Marta")], day).icons[0].glyph, "L");
});

test("vacaciones y festivos no llevan circulo: ya tinen el fondo", () => {
  const events = [ev("v", "Vacaciones"), ev("f", "San José", { calendar: "FESTIVOS" }), ev("c", "Cumple Ane")];
  assert.deepEqual(dayIcons(events, day).icons.map((i) => i.id), ["c"]);
});

test("un evento de varios dias aparece en cada dia que cubre", () => {
  const trip = ev("t", "Viaje a Madrid", { start: "2026-10-13", end: "2026-10-16" });
  assert.equal(dayIcons([trip], new Date(2026, 9, 13)).icons.length, 1);
  assert.equal(dayIcons([trip], new Date(2026, 9, 15)).icons.length, 1);
  assert.equal(dayIcons([trip], new Date(2026, 9, 16)).icons.length, 0);
});

test("cuando no caben, el ultimo hueco es el contador", () => {
  const many = Array.from({ length: 7 }, (_, i) => ev(`e${i}`, `Evento ${i}`));
  const { icons, more } = dayIcons(many, day, 5);
  assert.equal(icons.length, 4);
  assert.equal(more, 3);
  assert.equal(dayIcons(many.slice(0, 5), day, 5).more, 0);
});
