import assert from "node:assert/strict";
import test from "node:test";
import { normalize } from "../src/store.js";

test("a fresh night starts on the dice", () => {
  const state = normalize(null);
  assert.equal(state.tab, "dice");
  assert.equal(state.dice.sides, 20);
  assert.equal(state.dice.mode, "normal");
  assert.equal(state.combat.round, 1);
  assert.equal(state.combat.started, false);
  assert.deepEqual(state.party, []);
  assert.equal(state.notes, "");
});

test("bad saves are dropped instead of trusted", () => {
  const state = normalize({
    tab: "secrets",
    dice: { count: 0, sides: 3, mode: "lucky", history: [{ formula: "1d20", total: 12, tag: "crit" }, null] },
    combat: {
      round: 4,
      started: false,
      combatants: [
        { name: "Mara", init: 18, hp: 12, marks: ["prone", "cursed"] },
        { name: "   " },
      ],
    },
    party: [{ name: "Bram", level: 99 }, { level: "nope" }],
    monsters: [{ name: "Watchers", count: 3, xp: 50 }, { count: 2, xp: 10 }],
    lights: [{ kind: "sun", endsAt: Date.now() }, { kind: "torch", endsAt: Date.parse("2024-01-01T00:00:00Z") }],
    sparks: [{ kind: "place", title: "Place", body: "A ferry that only crosses when a passenger names the river." }],
    notes: "x".repeat(5000),
  });

  assert.equal(state.tab, "dice");
  assert.equal(state.dice.count, 1);
  assert.equal(state.dice.sides, 20);
  assert.equal(state.dice.mode, "normal");
  assert.equal(state.dice.history.length, 1);
  assert.equal(state.dice.history[0].tag, null);
  assert.equal(state.combat.round, 4);
  assert.equal(state.combat.started, true);
  assert.equal(state.combat.combatants.length, 1);
  assert.deepEqual(state.combat.combatants[0].marks, ["prone"]);
  assert.equal(state.party.length, 2);
  assert.equal(state.party[0].level, 20);
  assert.equal(state.party[1].level, 1);
  assert.equal(state.monsters.length, 1);
  assert.equal(state.lights.length, 1);
  assert.equal(state.lights[0].kind, "torch");
  assert.equal(state.sparks[0].kind, "place");
  assert.equal(state.notes.length, 4000);
});
