import assert from "node:assert/strict";
import test from "node:test";
import { blankCharacter } from "../src/character.js";
import {
  counterFor,
  parseCoin,
  payCounter,
  stallById,
} from "../src/gear.js";

test("an apothecary has vials and no blades", () => {
  const counter = counterFor("apothecary");
  const ids = counter.goods.map((good) => good.id);
  assert.equal(counter.name, "Apothecary");
  assert.ok(ids.includes("potion-healing"));
  assert.equal(ids.includes("longsword"), false);
  assert.equal(stallById("smith").goods.includes("upgrade-plus-1"), true);
  assert.equal(stallById("scribe").goods.includes("spellbook"), true);
  assert.equal(stallById("tavern").goods.includes("room-modest"), true);
  assert.equal(stallById("tavern").goods.includes("greataxe"), false);
});

test("a bare number is gold, and a service is paid not packed", () => {
  assert.equal(parseCoin("50"), 5000);
  assert.equal(parseCoin("4 cp"), 4);
  assert.equal(parseCoin("5 sp"), 50);
  assert.equal(parseCoin("500 gp"), 50000);
  const sheet = { ...blankCharacter(), touched: true, purse: 60000, items: [] };
  const smith = counterFor("smith");
  const upgrade = smith.goods.find((good) => good.id === "upgrade-plus-1");
  const paid = payCounter(sheet, { ...upgrade, cp: 100 });
  assert.equal(paid.ok, true);
  assert.equal(paid.service, true);
  assert.equal(paid.character.purse, 59900);
  assert.equal(paid.character.items.length, 0);
  const potion = counterFor("apothecary").goods.find((good) => good.id === "potion-healing");
  const bought = payCounter(paid.character, { ...potion, cp: 200 });
  assert.equal(bought.service, false);
  assert.equal(bought.character.purse, 59700);
  assert.equal(bought.character.items[0].id, "potion-healing");
});
