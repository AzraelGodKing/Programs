import assert from "node:assert/strict";
import test from "node:test";
import { draw, drawScene, KINDS, mulberry32, PARTS, sparkText, TABLES } from "../src/oracle.js";

test("prompt lists are long enough and do not repeat a line", () => {
  for (const [name, list] of Object.entries(TABLES)) {
    assert.ok(list.length >= 16, name);
    assert.equal(new Set(list).size, list.length, name);
    for (const line of list) assert.ok(line.trim().length > 12, line);
  }
  for (const [name, list] of Object.entries(PARTS)) {
    assert.ok(list.length >= 16, name);
    assert.equal(new Set(list).size, list.length, name);
  }
});

test("the same seed draws the same person", () => {
  const first = draw("person", mulberry32(42));
  const second = draw("person", mulberry32(42));
  assert.equal(first.body, second.body);
  assert.equal(first.lines.length, 5);
  assert.equal(first.lines[0][0], "Role");
  assert.doesNotMatch(first.lines[0][1], /^(A|An)\s/);
  assert.match(first.body, /Wants .+\. Secret: /);
});

test("a scene is one of each kind", () => {
  const scene = drawScene(mulberry32(7));
  assert.deepEqual(scene.cards.map((card) => card.kind), KINDS);
  for (const card of scene.cards) assert.ok(card.body.length > 10);
  assert.match(sparkText(scene), /Person|Place|Twist|Rumor|Trinket|Wants/);
});

test("an unknown prompt is refused", () => {
  assert.throws(() => draw("spell"), /Unknown prompt/);
});
