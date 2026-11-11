import assert from "node:assert/strict";
import test from "node:test";
import { applyAreaDamage, askAbility, askVerdict, delayTurn, groupVerdict, monsterBonus, turnTimerText } from "../src/combat.js";
import { advanceTurn, cleanOrder, playerOrder } from "../src/order.js";
import { attacksFromActions, fromLibrary, monsterRows, SRD_MONSTERS } from "../src/monsters.js";

const row = (id, init, extra = {}) => ({ id, name: id, init, hp: 10, maxHp: 10, order: 0, ...extra });

test("advancing ticks timed conditions on the creature whose turn ends", () => {
  const order = cleanOrder({
    started: true,
    activeId: "a",
    combatants: [row("a", 20, { marks: ["stunned"], durations: { stunned: 1 } }), row("b", 10)],
  });
  const { order: next, notes } = advanceTurn(order, 1, 1000);
  const a = next.combatants.find((person) => person.id === "a");
  assert.equal(next.activeId, "b");
  assert.deepEqual(a.marks, []);
  assert.equal(a.durations, undefined);
  assert.ok(notes.some((note) => note.includes("no longer stunned")));
  assert.equal(next.turnStartedAt, 1000);
});

test("lair and legendary reminders come at the right point", () => {
  const order = cleanOrder({
    started: true,
    activeId: "b",
    combatants: [row("a", 20), row("b", 10), row("dragon", 5, { lair: true, legendary: { max: 3, used: 1 } })],
  });
  const first = advanceTurn(order, 1);
  assert.ok(first.notes.some((note) => note.startsWith("dragon can take a legendary action (2 left)")));
  const second = advanceTurn(first.order, 1);
  assert.equal(second.order.round, 2);
  assert.equal(second.order.combatants.find((p) => p.id === "dragon").legendary.used, 0);
  assert.ok(second.notes.some((note) => note.startsWith("Lair action for dragon")));
});

test("players never see hidden rows or monster details", () => {
  const order = cleanOrder({
    started: true,
    activeId: "ghost",
    notes: ["Lair action"],
    combatants: [row("hero", 12, { seat: "Mara" }), row("ghost", 15, { hidden: true }), row("orc", 9, { mods: { dex: 1 }, attacks: [{ name: "Axe", hit: 5, damage: "1d12+3" }] })],
  });
  const seen = playerOrder(order);
  assert.deepEqual(seen.combatants.map((person) => person.id), ["hero", "orc"]);
  assert.equal(seen.activeId, null);
  assert.equal(seen.hiddenTurn, true);
  assert.equal(seen.notes, undefined);
  assert.equal(seen.combatants[1].attacks, undefined);
  assert.equal(seen.combatants[1].mods, undefined);
});

test("area damage rolls each save and halves on a success", () => {
  const order = cleanOrder({ combatants: [row("a", 10, { mods: { dex: 2 } }), row("b", 8, { marks: ["concentrating"] })] });
  const rolls = [15, 3];
  const { order: next, results } = applyAreaDamage(order, {
    ids: ["a", "b"], amount: 9, ability: "dex", dc: 15, onSave: "half",
    bonusFor: (person, ability) => person.mods?.[ability] ?? 0,
    rollD20: () => rolls.shift(),
  });
  assert.equal(results[0].save.saved, true);
  assert.equal(results[0].taken, 4);
  assert.equal(results[1].taken, 9);
  assert.equal(results[1].concentration, 10);
  assert.deepEqual(next.combatants.map((person) => person.hp), [6, 1]);
});

test("delay moves a row behind the next one and passes the turn", () => {
  const order = cleanOrder({ started: true, activeId: "a", combatants: [row("a", 18), row("b", 12), row("c", 5)] });
  const next = delayTurn(order, "a");
  const sorted = [...next.combatants].sort((x, y) => y.init - x.init || x.order - y.order).map((person) => person.id);
  assert.deepEqual(sorted, ["b", "a", "c"]);
  assert.equal(next.activeId, "b");
});

test("verdicts for DCs, contests, and the group", () => {
  assert.equal(askVerdict({ total: 14, dc: 13 }), "passes");
  assert.equal(askVerdict({ total: 12, dc: 13 }), "fails");
  assert.equal(askVerdict({ total: 12, against: 15 }), "loses");
  assert.equal(askVerdict({ total: 15, against: 15 }), "ties");
  assert.equal(groupVerdict([14, 8, 16], 13), "The group passes (2 of 3).");
  assert.equal(groupVerdict([4, 8, 16], 13), "The group fails (1 of 3).");
  assert.deepEqual(askAbility("Stealth"), { ability: "dex", save: false });
  assert.deepEqual(askAbility("Wisdom save"), { ability: "wis", save: true });
  assert.equal(monsterBonus({ mods: { str: 3 } }, "Athletics"), 3);
});

test("the turn timer reads round, time spent, and the limit", () => {
  const order = { started: true, round: 2, turnStartedAt: 1000, turnLimit: 60 };
  assert.equal(turnTimerText(order, 43000), "Round 2 · turn 0:42 of 1:00");
  assert.equal(turnTimerText(order, 62000), "Round 2 · turn 1:01 of 1:00 · time");
  assert.equal(turnTimerText({ started: false }), "");
});

test("quick add seats a group on one initiative with attacks", () => {
  const wolf = SRD_MONSTERS.find((monster) => monster.name === "Wolf");
  const rows = monsterRows(wolf, { count: 3, hidden: true, shared: true, existing: [], rollD20: () => 11 });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((person) => person.name), ["Wolf 1", "Wolf 2", "Wolf 3"]);
  assert.ok(rows.every((person) => person.init === 13 && person.hidden && person.attacks[0].damage === "2d4+2"));
  const clean = cleanOrder({ combatants: rows });
  assert.equal(clean.combatants[0].mods.dex, 2);
});

test("Library monsters bring their attacks and legendary actions", () => {
  const attacks = attacksFromActions([
    { name: "Scimitar.", text: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage." },
    { name: "Nimble Escape", text: "The goblin can take the Disengage or Hide action." },
  ]);
  assert.deepEqual(attacks, [{ name: "Scimitar", hit: 4, damage: "1d6+2" }]);
  const dragon = fromLibrary({ name: "Dragon", ac: 19, hp: 200, cr: "17", scores: { dex: 10, con: 25 }, actions: [], legendary: [{ name: "", text: "The dragon can take 3 legendary actions." }] });
  assert.equal(dragon.legendary, 3);
  assert.equal(dragon.mods.con, 7);
});
