import assert from "node:assert/strict";
import test from "node:test";
import {
  checkD100,
  cleanRollSettings,
  finishD100,
  flipCoin,
  rollLine,
  startCoin,
  startD100,
  startD20,
  stopCoin,
} from "../src/abilityroll.js";

const fixed = (...values) => {
  let index = 0;
  return () => values[index++ % values.length];
};

test("settings keep known modes only, and only means nothing without a mode", () => {
  assert.deepEqual(cleanRollSettings({ modes: ["coin", "nope", "d20"], only: true }), { modes: ["d20", "coin"], only: true });
  assert.deepEqual(cleanRollSettings({ modes: [], only: true }), { modes: [], only: false });
  assert.deepEqual(cleanRollSettings(null), { modes: [], only: false });
});

test("d20 in order puts six d20s on STR to CHA as rolled", () => {
  const record = startD20(fixed(0, 0.5, 0.95, 0.25, 0.75, 0.1));
  assert.deepEqual(record.dice, [1, 11, 20, 6, 16, 3]);
  assert.deepEqual(record.scores, { str: 1, dex: 11, con: 20, int: 6, wis: 16, cha: 3 });
  assert.equal(record.done, true);
  assert.match(rollLine(record), /STR 1, DEX 11, CON 20/);
});

test("d100 spends every point on top of 1s, none above 20", () => {
  const record = startD100(fixed(0.295));
  assert.equal(record.pool, 30);
  assert.equal(checkD100(30, { str: 20, dex: 12, con: 1, int: 1, wis: 1, cha: 1 }).ok, true);
  assert.match(checkD100(30, { str: 20, dex: 5, con: 1, int: 1, wis: 1, cha: 1 }).reason, /points left/);
  assert.match(checkD100(30, { str: 21, dex: 11, con: 1, int: 1, wis: 1, cha: 1 }).reason, /between 1 and 20/);
  assert.match(checkD100(30, { str: 20, dex: 20, con: 1, int: 1, wis: 1, cha: 1 }).reason, /You have 30/);
  const done = finishD100(record, { str: 1, dex: 1, con: 1, int: 1, wis: 20, cha: 12 });
  assert.equal(done.ok, true);
  assert.equal(done.record.done, true);
  assert.equal(finishD100(done.record, done.record.scores).ok, false);
});

test("coin flip: right is +2, wrong is -2, three wrong in a row ends it", () => {
  let record = startCoin();
  assert.equal(record.scores.str, 10);
  // rng below 0.5 is heads.
  let step = flipCoin(record, "str", "heads", fixed(0.1));
  assert.equal(step.record.scores.str, 12);
  assert.equal(step.record.misses, 0);
  record = step.record;
  for (let i = 0; i < 2; i += 1) {
    step = flipCoin(record, "dex", "heads", fixed(0.9));
    record = step.record;
    assert.equal(record.done, false);
  }
  step = flipCoin(record, "int", "tails", fixed(0.1));
  record = step.record;
  assert.equal(record.done, true);
  assert.equal(record.end, "misses");
  assert.deepEqual(record.scores, { str: 12, dex: 6, con: 10, int: 8, wis: 10, cha: 10 });
  assert.equal(flipCoin(record, "str", "heads", fixed(0.1)).ok, false);
});

test("a right call between misses resets the streak", () => {
  let record = startCoin();
  record = flipCoin(record, "str", "heads", fixed(0.9)).record;
  record = flipCoin(record, "str", "heads", fixed(0.9)).record;
  record = flipCoin(record, "dex", "heads", fixed(0.1)).record;
  assert.equal(record.misses, 0);
  record = flipCoin(record, "str", "heads", fixed(0.9)).record;
  assert.equal(record.done, false);
});

test("coin flip ends when a score reaches 2 or 20, or on tap out", () => {
  let record = startCoin();
  for (let i = 0; i < 5; i += 1) record = flipCoin(record, "cha", "tails", fixed(0.9)).record;
  assert.equal(record.scores.cha, 20);
  assert.equal(record.end, "edge");
  let low = startCoin();
  for (const call of ["heads", "tails", "heads", "tails"]) {
    low = flipCoin(low, "wis", call, fixed(call === "heads" ? 0.9 : 0.1)).record;
    if (low.done) break;
  }
  // Two misses, then a third ends it before WIS can reach 2.
  assert.equal(low.end, "misses");
  const stopped = stopCoin(startCoin());
  assert.equal(stopped.record.end, "stopped");
  assert.equal(flipCoin(startCoin(), "luck", "heads").ok, false);
  assert.equal(flipCoin(startCoin(), "str", "edge").ok, false);
});
