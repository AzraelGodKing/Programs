import assert from "node:assert/strict";
import test from "node:test";
import { SaveError, exportNight, importNight, nightFilename, normalize } from "../src/store.js";

test("a fresh night starts on the dice", () => {
  const state = normalize(null);
  assert.equal(state.tab, "dice");
  assert.equal(state.dice.sides, 20);
  assert.equal(state.dice.mode, "normal");
  assert.equal(state.combat.round, 1);
  assert.equal(state.combat.started, false);
  assert.deepEqual(state.party, []);
  assert.equal(state.notes, "");
  assert.deepEqual(state.drafts, []);
  assert.equal(state.character.touched, false);
  assert.equal(state.character.level, 1);
});

test("bad saves are dropped instead of trusted", () => {
  const state = normalize({
    tab: "secrets",
    dice: { count: 0, sides: 3, mode: "lucky", history: [{ formula: "1d20", total: 12, tag: "crit", purpose: "  Perception  " }, null] },
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
    drafts: [{ title: "The well", body: "Warm." }, { title: "  ", body: "  " }, null],
  });

  assert.equal(state.tab, "dice");
  assert.equal(state.dice.count, 1);
  assert.equal(state.dice.sides, 20);
  assert.equal(state.dice.mode, "normal");
  assert.equal(state.dice.history.length, 1);
  assert.equal(state.dice.history[0].tag, null);
  assert.equal(state.dice.history[0].purpose, "Perception");
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
  assert.equal(state.drafts.length, 1);
  assert.equal(state.drafts[0].title, "The well");
  assert.equal(state.drafts[0].body, "Warm.");
});

test("a save file round-trips the night and refuses anything else", () => {
  const when = new Date("2026-10-05T18:00:00.000Z");
  const file = exportNight({
    notes: "The ferry",
    character: { name: "Mara Vale" },
    combat: { combatants: [{ name: "Mara Vale", init: 18, hp: 12 }] },
    tab: "secrets",
  }, when);
  assert.equal(file.lantern, 1);
  assert.equal(file.savedAt, "2026-10-05T18:00:00.000Z");
  assert.equal(file.night.tab, "dice");
  assert.equal(file.night.notes, "The ferry");
  assert.equal(file.night.character.name, "Mara Vale");
  assert.equal(file.night.combat.combatants[0].name, "Mara Vale");

  const restored = importNight(file);
  assert.equal(restored.notes, "The ferry");
  assert.equal(restored.character.name, "Mara Vale");
  assert.equal(nightFilename({ character: { name: "Mara Vale" } }, when), "lantern-mara-vale-2026-10-05.json");
  assert.equal(nightFilename({}, when), "lantern-night-2026-10-05.json");

  assert.throws(() => importNight(null), SaveError);
  assert.throws(() => importNight([]), SaveError);
  assert.throws(() => importNight({ lantern: 1 }), SaveError);
  assert.throws(() => importNight({ lantern: 1, night: [] }), SaveError);
  assert.throws(() => importNight({ lantern: 2, night: {} }), /newer Lantern/);
});
