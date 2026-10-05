import assert from "node:assert/strict";
import test from "node:test";
import {
  CR_XP,
  encounterMultiplier,
  formatXp,
  rateEncounter,
  THRESHOLDS,
} from "../src/encounter.js";

test("thresholds rise inside a level and across the table", () => {
  for (let level = 1; level <= 20; level += 1) {
    const [easy, medium, hard, deadly] = THRESHOLDS[level];
    assert.ok(easy < medium && medium < hard && hard < deadly);
    if (level > 1) assert.ok(easy > THRESHOLDS[level - 1][0]);
  }
});

test("four level 1 characters against three creatures is a hard fight", () => {
  const result = rateEncounter({
    levels: [1, 1, 1, 1],
    groups: [{ count: 3, xp: 50 }],
  });
  assert.equal(result.raw, 150);
  assert.equal(result.multiplier, 2);
  assert.equal(result.adjusted, 300);
  assert.equal(result.rating, "hard");
  assert.equal(result.thresholds.deadly, 400);
});

test("a pair of creatures uses the one and a half multiplier", () => {
  const result = rateEncounter({
    levels: [5, 5, 5, 5],
    groups: [{ count: 2, xp: 100 }],
  });
  assert.equal(result.multiplier, 1.5);
  assert.equal(result.adjusted, 300);
});

test("party size steps the multiplier, and the ends of the table stay put", () => {
  assert.deepEqual(encounterMultiplier(1, 4), { multiplier: 1, shift: null });
  assert.deepEqual(encounterMultiplier(2, 4), { multiplier: 1.5, shift: null });
  assert.deepEqual(encounterMultiplier(3, 4), { multiplier: 2, shift: null });
  assert.deepEqual(encounterMultiplier(6, 4), { multiplier: 2, shift: null });
  assert.deepEqual(encounterMultiplier(7, 4), { multiplier: 2.5, shift: null });
  assert.deepEqual(encounterMultiplier(11, 4), { multiplier: 3, shift: null });
  assert.deepEqual(encounterMultiplier(15, 4), { multiplier: 4, shift: null });
  assert.deepEqual(encounterMultiplier(1, 2), { multiplier: 1.5, shift: "stricter" });
  assert.deepEqual(encounterMultiplier(2, 6), { multiplier: 1, shift: "gentler" });
  assert.deepEqual(encounterMultiplier(15, 1), { multiplier: 4, shift: null });
  assert.deepEqual(encounterMultiplier(1, 8), { multiplier: 1, shift: null });
});

test("two level 5 characters and one tough creature is deadly", () => {
  const result = rateEncounter({
    levels: [5, 5],
    groups: [{ count: 1, xp: 1800 }],
  });
  assert.equal(result.shift, "stricter");
  assert.equal(result.adjusted, 2700);
  assert.equal(result.rating, "deadly");
});

test("an empty room is trivial and a missing party has no rating", () => {
  const quiet = rateEncounter({ levels: [3, 3, 3, 3], groups: [] });
  assert.equal(quiet.rating, "trivial");
  assert.equal(quiet.monsterCount, 0);
  assert.equal(rateEncounter({ levels: [], groups: [{ count: 1, xp: 200 }] }).rating, null);
});

test("challenge ratings keep their anchors and climb", () => {
  const map = Object.fromEntries(CR_XP);
  assert.equal(map["0"], 10);
  assert.equal(map["1/8"], 25);
  assert.equal(map["1"], 200);
  assert.equal(map["5"], 1800);
  assert.equal(map["30"], 155000);
  const values = CR_XP.map(([, xp]) => xp);
  for (let i = 1; i < values.length; i += 1) assert.ok(values[i] > values[i - 1]);
});

test("formats experience with a thousands separator", () => {
  assert.equal(formatXp(1800), "1,800");
  assert.equal(formatXp(37.5), "37.5");
});
