import assert from "node:assert/strict";
import test from "node:test";
import { themeFor, DAY_STARTS, NIGHT_STARTS } from "./theme.js";

const at = (hour) => new Date(2026, 8, 6, hour, 30);

test("de dia el calendario se lee en claro", () => {
  assert.equal(themeFor(at(DAY_STARTS)), "light");
  assert.equal(themeFor(at(12)), "light");
  assert.equal(themeFor(at(NIGHT_STARTS - 1)), "light");
});

test("de noche no debe alumbrar el salon", () => {
  assert.equal(themeFor(at(NIGHT_STARTS)), "dark");
  assert.equal(themeFor(at(3)), "dark");
  assert.equal(themeFor(at(DAY_STARTS - 1)), "dark");
});
