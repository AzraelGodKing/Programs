import assert from "node:assert/strict";
import test from "node:test";
import { blankCharacter } from "../src/character.js";
import {
  counterFor,
  parseCoin,
  buyBackItem,
  payCounter,
  sellOffers,
  sellToCounter,
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

test("a stall buys its own goods at half price and leaves the rest", () => {
  const sheet = {
    ...blankCharacter(),
    touched: true,
    purse: 1000,
    items: [
      { id: "longsword", name: "Longsword", qty: 1 },
      { id: "potion-healing", name: "Potion of healing", qty: 2 },
    ],
  };
  const smith = counterFor("smith");
  const sword = smith.goods.find((good) => good.id === "longsword");
  const sold = sellToCounter(sheet, { ...sword, cp: 1500 });
  assert.equal(sold.ok, true);
  assert.equal(sold.gained, 750);
  assert.equal(sold.character.purse, 1750);
  assert.equal(sold.character.items.some((item) => item.id === "longsword"), false);
  assert.equal(sold.character.items.find((item) => item.id === "potion-healing").qty, 2);

  const apothecary = counterFor("apothecary");
  const canSell = sellOffers(apothecary.goods, sold.character.items).map((offer) => offer.id);
  assert.deepEqual(canSell, ["potion-healing"]);
  const potion = apothecary.goods.find((good) => good.id === "potion-healing");
  const vials = sellToCounter(sold.character, { ...potion, cp: 4000 });
  assert.equal(vials.gained, 2000);
  assert.equal(vials.character.purse, 3750);
  assert.equal(vials.character.items.find((item) => item.id === "potion-healing").qty, 1);

  const upgrade = smith.goods.find((good) => good.id === "upgrade-plus-1");
  assert.equal(sellToCounter(vials.character, upgrade).ok, false);
  assert.equal(sellOffers(counterFor("tavern").goods, vials.character.items).length, 0);
  assert.equal(sellToCounter(vials.character, { id: "rope", name: "Rope", cp: 100, service: false }).ok, false);
});

test("buying back costs the coin the sale paid", () => {
  const sheet = {
    ...blankCharacter(),
    touched: true,
    purse: 1000,
    items: [{ id: "longsword", name: "Longsword", qty: 1 }],
  };
  const sold = sellToCounter(sheet, { id: "longsword", cp: 1500, service: false });
  assert.equal(sold.gained, 750);
  assert.equal(sold.character.purse, 1750);
  const back = buyBackItem(sold.character, { id: "longsword", cp: sold.gained });
  assert.equal(back.ok, true);
  assert.equal(back.character.purse, 1000);
  assert.equal(back.character.items[0].qty, 1);
  assert.equal(buyBackItem(sold.character, { id: "upgrade-plus-1", cp: 750 }).ok, false);
  assert.equal(buyBackItem({ ...sold.character, purse: 100 }, { id: "longsword", cp: 750 }).ok, false);
});
