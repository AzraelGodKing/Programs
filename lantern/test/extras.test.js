import assert from "node:assert/strict";
import test from "node:test";
import {
  applyDamage,
  applyHealing,
  applyTemp,
  carriedWeight,
  classResources,
  classSlots,
  cleanExtras,
  concentrationDc,
  critDamage,
  encumbrance,
  levelUpSteps,
  parseFormula,
  restExtras,
  splitCoin,
  syncAmmo,
  tickResource,
  tickSlot,
  toggleAttune,
} from "../src/extras.js";
import { cleanCharacter } from "../src/character.js";

test("formulas read the way players type them", () => {
  assert.deepEqual(parseFormula("1d20+5"), { count: 1, sides: 20, modifier: 5 });
  assert.deepEqual(parseFormula("d8 + 3"), { count: 1, sides: 8, modifier: 3 });
  assert.deepEqual(parseFormula("+4"), { count: 1, sides: 20, modifier: 4 });
  assert.deepEqual(parseFormula("2d6-1"), { count: 2, sides: 6, modifier: -1 });
  assert.equal(parseFormula("1d7"), null);
  assert.equal(parseFormula("sword"), null);
  assert.equal(parseFormula(""), null);
});

test("a critical doubles the dice and keeps the modifier", () => {
  assert.deepEqual(critDamage({ count: 1, sides: 8, modifier: 3 }), { count: 2, sides: 8, modifier: 3 });
});

test("macros without a roll are dropped and the list is capped", () => {
  const extras = cleanExtras({
    macros: [
      { id: "a", label: "Longsword", hit: "+5", damage: "1d8+3" },
      { id: "b", label: "Nothing" },
      ...Array.from({ length: 20 }, (_, index) => ({ id: `m${index}`, label: `Roll ${index}`, hit: "+1" })),
    ],
  });
  assert.equal(extras.macros[0].hit, "1d20+5");
  assert.equal(extras.macros.length, 12);
  assert.ok(!extras.macros.some((macro) => macro.label === "Nothing"));
});

test("damage goes through temporary hit points first", () => {
  assert.deepEqual(applyDamage({ hp: 10, tempHp: 4 }, 6), { hp: 8, tempHp: 0, taken: 6 });
  assert.deepEqual(applyDamage({ hp: 3, tempHp: 0 }, 9), { hp: 0, tempHp: 0, taken: 9 });
  assert.equal(applyHealing({ hp: 0, max: 12 }, 20), 12);
  assert.equal(applyTemp(5, 3), 5);
  assert.equal(applyTemp(2, 8), 8);
});

test("the concentration DC is ten or half the damage", () => {
  assert.equal(concentrationDc(7), 10);
  assert.equal(concentrationDc(31), 15);
});

test("class slots follow the 2014 tables", () => {
  assert.deepEqual(classSlots("wizard", 5).slice(0, 4).map((slot) => slot.max), [4, 3, 2, 0]);
  assert.deepEqual(classSlots("paladin", 1).map((slot) => slot.max), [0, 0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(classSlots("paladin", 5).slice(0, 2).map((slot) => slot.max), [4, 2]);
  assert.deepEqual(classSlots("warlock", 5).slice(0, 3).map((slot) => slot.max), [0, 0, 2]);
  assert.equal(classSlots("fighter", 10).every((slot) => slot.max === 0), true);
});

test("class resources fill for the class and level", () => {
  assert.deepEqual(classResources("monk", 5).map((item) => [item.label, item.max, item.reset]), [["Ki", 5, "short"]]);
  assert.deepEqual(classResources("barbarian", 3).map((item) => item.max), [3]);
  assert.equal(classResources("bard", 1, 3)[0].max, 3);
  assert.equal(classResources("bard", 5, 3)[0].reset, "short");
  assert.deepEqual(classResources("rogue", 5), []);
});

test("rests bring back what they should", () => {
  let extras = cleanExtras({
    resources: [
      { id: "ki", label: "Ki", max: 4, used: 3, reset: "short" },
      { id: "rage", label: "Rage", max: 3, used: 2, reset: "long" },
    ],
    slots: [{ max: 3, used: 2 }],
    tempHp: 5,
  });
  const short = restExtras(extras, "short", "wizard");
  assert.equal(short.resources[0].used, 0);
  assert.equal(short.resources[1].used, 2);
  assert.equal(short.slots[0].used, 2);
  assert.equal(restExtras(extras, "short", "warlock").slots[0].used, 0);
  const long = restExtras(extras, "long");
  assert.equal(long.resources[1].used, 0);
  assert.equal(long.slots[0].used, 0);
  assert.equal(long.tempHp, 0);
  extras = tickResource(extras, "ki", 5);
  assert.equal(extras.resources[0].used, 4);
  extras = tickSlot(extras, 1, -5);
  assert.equal(extras.slots[0].used, 0);
});

test("three items can be attuned at once", () => {
  let extras = cleanExtras({
    trinkets: ["a", "b", "c", "d"].map((id) => ({ id, name: `Ring ${id}`, attune: true })),
  });
  for (const id of ["a", "b", "c"]) extras = toggleAttune(extras, id);
  assert.equal(toggleAttune(extras, "d"), null);
  extras = toggleAttune(extras, "a");
  assert.ok(toggleAttune(extras, "d"));
  const forced = cleanExtras({ trinkets: ["a", "b", "c", "d"].map((id) => ({ id, name: id, attune: true, attuned: true })) });
  assert.equal(forced.trinkets.filter((item) => item.attuned).length, 3);
});

test("weight and encumbrance use the equipment table", () => {
  const weight = carriedWeight([{ id: "chain-mail", qty: 1 }, { id: "torch", qty: 3 }], [{ weight: 2, qty: 1 }]);
  assert.equal(weight, 60);
  assert.equal(encumbrance(60, 10).level, "encumbered");
  assert.equal(encumbrance(120, 10).level, "heavy");
  assert.equal(encumbrance(40, 10).level, "light");
  assert.equal(encumbrance(200, 10).level, "over");
});

test("ammo counts stay in step with the bundles", () => {
  assert.equal(syncAmmo(37, 2, 20), 37);
  assert.equal(syncAmmo(17, 2, 20), 37);
  assert.equal(syncAmmo(37, 1, 20), 20);
  assert.equal(syncAmmo(0, 0, 20), 0);
});

test("coin splits evenly and the rest stays", () => {
  assert.deepEqual(splitCoin(1000, 3), { each: 333, left: 1 });
});

test("level steps name the score improvement and the proficiency bump", () => {
  assert.ok(levelUpSteps("fighter", 4, 10).some((step) => step.includes("Ability Score Improvement")));
  assert.ok(levelUpSteps("wizard", 5, 6).some((step) => step.includes("proficiency")));
  assert.ok(!levelUpSteps("fighter", 5, 10).some((step) => step.includes("spell")));
});

test("the character keeps its extras", () => {
  const character = cleanCharacter({ name: "Mara", extras: { tempHp: 4, color: "#7fb069", conditions: ["prone", "nope"], portrait: "javascript:alert(1)" } });
  assert.equal(character.extras.tempHp, 4);
  assert.equal(character.extras.color, "#7fb069");
  assert.deepEqual(character.extras.conditions, ["prone"]);
  assert.equal(character.extras.portrait, "");
});

test("chat helpers find mentions and glossary links", async () => {
  const { glossaryParts, mentions, typingLine, presence } = await import("../src/talk.js");
  assert.equal(mentions("hey @Mara, look", ["Mara"]), true);
  assert.equal(mentions("hey @Marabelle", ["Mara"]), false);
  assert.equal(mentions("hey Mara", ["Mara"]), false);
  assert.deepEqual(glossaryParts("meet [[Old Wend]] now"), [{ text: "meet " }, { link: "Old Wend" }, { text: " now" }]);
  assert.equal(typingLine([{ name: "Bram", typing: 1000 }, { name: "Mara", typing: 1000 }], "Mara", 3000), "Bram is typing…");
  assert.equal(presence(0, 10_000), "here");
  assert.equal(presence(0, 60_000), "away");
  assert.equal(presence(0, 600_000), "gone");
});
