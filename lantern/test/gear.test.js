import assert from "node:assert/strict";
import test from "node:test";
import { blankCharacter, cleanCharacter } from "../src/character.js";
import {
  buyItem,
  equipNewCharacter,
  formatCoin,
  startingPurse,
  useItem,
} from "../src/gear.js";

test("coin reads in gold, silver, and copper", () => {
  assert.equal(formatCoin(12500), "125 gp");
  assert.equal(formatCoin(1250), "12 gp, 5 sp");
  assert.equal(formatCoin(101), "1 gp, 1 cp");
  assert.equal(formatCoin(0), "0 cp");
});

test("a new fighter receives the kit and the class purse", () => {
  const sheet = equipNewCharacter({ ...blankCharacter(), classId: "fighter", touched: true });
  assert.equal(sheet.purse, startingPurse("fighter"));
  assert.equal(sheet.purse, 12500);
  assert.ok(sheet.items.some((item) => item.id === "longsword"));
  assert.equal(equipNewCharacter(sheet), sheet);
});

test("buying subtracts the price and refuses a short purse", () => {
  const sheet = equipNewCharacter({ ...blankCharacter(), classId: "monk", touched: true });
  const bought = buyItem(sheet, "potion-healing");
  assert.equal(bought.ok, false);
  assert.equal(bought.reason, "Not enough coin.");
  assert.equal(sheet.purse, 1250);
  const rope = buyItem(sheet, "rope");
  assert.equal(rope.ok, true);
  assert.equal(rope.character.purse, 1150);
  assert.equal(rope.character.items.find((item) => item.id === "rope").qty, 1);
  const again = buyItem(rope.character, "rope");
  assert.equal(again.character.items.find((item) => item.id === "rope").qty, 2);
  assert.equal(again.character.purse, 1050);
});

test("a short purse cannot buy, and a use spends a consumable", () => {
  const wizard = equipNewCharacter({ ...blankCharacter(), classId: "wizard", touched: true });
  assert.ok(wizard.items.some((item) => item.id === "spellbook"));
  const broke = { ...wizard, purse: 0 };
  assert.equal(buyItem(broke, "torch").ok, false);
  const withCoin = { ...broke, purse: 5 };
  const torches = buyItem(withCoin, "torch");
  assert.equal(torches.character.purse, 4);
  const used = useItem(torches.character, "torch");
  assert.equal(used.spent, true);
  assert.equal(used.left, 0);
  assert.equal(used.character.items.some((item) => item.id === "torch"), false);
  const staff = useItem(wizard, "quarterstaff");
  assert.equal(staff.ok, true);
  assert.equal(staff.spent, false);
  assert.equal(useItem(wizard, "missing").ok, false);
});

test("a saved sheet keeps known gear and drops the rest", () => {
  const sheet = cleanCharacter({
    touched: true,
    name: "Mara",
    classId: "rogue",
    purse: 40,
    items: [
      { id: "dagger", qty: 2 },
      { id: "not-real", qty: 1 },
      { id: "torch", qty: 3 },
    ],
  });
  assert.equal(sheet.purse, 40);
  assert.deepEqual(sheet.items.map((item) => item.id), ["dagger", "torch"]);
  assert.equal(sheet.items[0].name, "Dagger");
});
