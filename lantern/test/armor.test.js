import assert from "node:assert/strict";
import test from "node:test";
import { armorClass } from "../src/armor.js";
import { blankCharacter } from "../src/character.js";

test("scale mail and a shield beat leather, and a typed number wins", () => {
  const hero = {
    ...blankCharacter(),
    classId: "fighter",
    scores: { str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 8 },
    items: [
      { id: "scale-mail", qty: 1 },
      { id: "shield", qty: 1 },
      { id: "leather", qty: 1 },
    ],
  };
  assert.equal(armorClass(hero), 17);
  assert.equal(armorClass({ ...hero, acOverride: 18 }), 18);
  assert.equal(armorClass({ ...hero, items: [{ id: "leather", qty: 1 }] }), 12);
});

test("an unarmored monk adds Wisdom and an unarmored hero is ten plus Dexterity", () => {
  const monk = {
    ...blankCharacter(),
    classId: "monk",
    scores: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 8 },
    items: [],
  };
  assert.equal(armorClass(monk), 15);
  const hero = { ...monk, classId: "fighter" };
  assert.equal(armorClass(hero), 13);
});
