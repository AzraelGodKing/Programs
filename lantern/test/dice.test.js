import assert from "node:assert/strict";
import test from "node:test";
import { facesLabel, formula, roll } from "../src/dice.js";

function scripted(values) {
  let index = 0;
  return () => {
    if (index >= values.length) throw new Error("rng exhausted");
    const value = values[index];
    index += 1;
    return value;
  };
}

test("advantage keeps the higher d20 and adds the modifier once", () => {
  const result = roll({
    count: 1,
    sides: 20,
    modifier: 5,
    mode: "advantage",
    rng: scripted([0.1, 0.95]),
  });
  assert.deepEqual(result.kept, [20]);
  assert.equal(result.total, 25);
  assert.equal(result.tag, "natural-20");
  assert.equal(formula(result), "1d20 advantage + 5");
  assert.equal(facesLabel(result), "20 (dropped 3)");
});

test("disadvantage keeps the lower d20", () => {
  const result = roll({
    sides: 20,
    mode: "disadvantage",
    rng: scripted([0, 0.5]),
  });
  assert.deepEqual(result.kept, [1]);
  assert.equal(result.total, 1);
  assert.equal(result.tag, "natural-1");
  assert.equal(facesLabel(result), "1 (dropped 11)");
});

test("4d6 plus 2 sums four dice and ignores advantage", () => {
  const result = roll({
    count: 4,
    sides: 6,
    modifier: 2,
    mode: "advantage",
    rng: scripted([0, 0.99, 0.5, 0.2]),
  });
  assert.deepEqual(result.kept, [1, 6, 4, 2]);
  assert.equal(result.total, 15);
  assert.equal(result.tag, null);
  assert.equal(formula(result), "4d6 + 2");
});

test("equal advantage dice are both shown", () => {
  const result = roll({
    sides: 20,
    mode: "advantage",
    rng: scripted([0.5, 0.5]),
  });
  assert.equal(facesLabel(result), "11 / 11");
});

test("rejects a die the tray does not offer", () => {
  assert.throws(() => roll({ sides: 7 }), /Unsupported die/);
  assert.throws(() => roll({ count: 0, sides: 6 }), /Count/);
});
