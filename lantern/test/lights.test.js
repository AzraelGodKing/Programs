import assert from "node:assert/strict";
import test from "node:test";
import { findLight, formatRemaining, LIGHTS, lightCaption } from "../src/lights.js";

test("gear durations and the hooded lantern", () => {
  const ids = LIGHTS.map((light) => light.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(findLight("candle").bright, 5);
  assert.equal(findLight("torch").minutes, 60);
  assert.equal(findLight("hooded").hoodDim, 5);
  assert.equal(findLight("bullseye").cone, true);
  assert.equal(lightCaption(findLight("hooded"), false), "30 ft bright, +30 ft dim");
  assert.equal(lightCaption(findLight("hooded"), true), "Hood down · 5 ft dim");
  assert.equal(lightCaption(findLight("bullseye"), false), "60 ft bright, +60 ft dim cone");
});

test("remaining time counts up to the next second and then goes out", () => {
  assert.equal(formatRemaining(0), "Out");
  assert.equal(formatRemaining(-5), "Out");
  assert.equal(formatRemaining(1), "0:01");
  assert.equal(formatRemaining(1500), "0:02");
  assert.equal(formatRemaining(60000), "1:00");
  assert.equal(formatRemaining(3600000), "1:00:00");
  assert.equal(formatRemaining(3661000), "1:01:01");
});
