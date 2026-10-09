import assert from "node:assert/strict";
import test from "node:test";
import { blankCharacter } from "../src/character.js";
import {
  coinCounts,
  counterFor,
  formatCoin,
  parseCoin,
  buyBackItem,
  payCounter,
  restockStaples,
  stapleQuote,
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
  assert.equal(parseCoin("1 ep"), 50);
  assert.equal(parseCoin("2 ep"), parseCoin("1 gp"));
  assert.equal(parseCoin("1 pp"), 1000);
  assert.equal(parseCoin("1 pp"), parseCoin("10"));
  assert.equal(parseCoin("1 pp, 2 gp, 1 ep, 3 sp, 4 cp"), 1284);
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

test("a platinum or electrum piece spends at the usual rate", () => {
  const rope = counterFor("market").goods.find((good) => good.id === "rope");
  const room = counterFor("tavern").goods.find((good) => good.id === "room-modest");
  const holder = { ...blankCharacter(), touched: true, purse: parseCoin("1 pp"), items: [] };
  const bought = payCounter(holder, rope);
  assert.equal(bought.ok, true);
  assert.equal(bought.character.purse, parseCoin("9 gp"));
  assert.equal(formatCoin(bought.character.purse), "9 gp");
  const short = payCounter({ ...holder, purse: parseCoin("1 ep") }, rope);
  assert.equal(short.ok, false);
  const night = payCounter({ ...holder, purse: parseCoin("1 ep") }, room);
  assert.equal(night.ok, true);
  assert.equal(night.character.purse, 0);
  assert.equal(formatCoin(parseCoin("1 pp, 5 gp")), "1 pp, 5 gp");
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

test("opening a shop restocks missing arrows and a component pouch", () => {
  assert.deepEqual(coinCounts(parseCoin("1 pp, 2 gp, 1 ep, 3 sp, 4 cp")), [
    { name: "pp", count: 1 },
    { name: "gp", count: 2 },
    { name: "ep", count: 1 },
    { name: "sp", count: 3 },
    { name: "cp", count: 4 },
  ]);
  const market = counterFor("market").goods;
  const archer = {
    ...blankCharacter(),
    classId: "ranger",
    touched: true,
    purse: parseCoin("30 gp"),
    items: [{ id: "shortbow", name: "Shortbow", qty: 1 }],
  };
  const stocked = restockStaples(archer, market);
  assert.deepEqual(stocked.bought.map((item) => item.id), ["arrows", "component-pouch"]);
  assert.equal(stocked.character.purse, parseCoin("30 gp") - 100 - 2500);
  assert.equal(stocked.skipped.length, 0);
  const again = restockStaples(stocked.character, market);
  assert.deepEqual(again.bought, []);

  const broke = restockStaples({ ...archer, purse: parseCoin("5 sp") }, market);
  assert.deepEqual(broke.bought, []);
  assert.equal(broke.skipped[0].id, "arrows");
  assert.equal(broke.character.purse, parseCoin("5 sp"));

  const cleric = {
    ...blankCharacter(),
    classId: "cleric",
    touched: true,
    purse: parseCoin("40 gp"),
    items: [{ id: "holy-symbol", name: "Holy symbol", qty: 1 }],
  };
  assert.deepEqual(restockStaples(cleric, market).bought, []);
  const vials = restockStaples(archer, counterFor("apothecary").goods);
  assert.deepEqual(vials.bought, []);

  const quote = stapleQuote(archer, market);
  assert.deepEqual(quote.lines.map((item) => item.id), ["arrows", "component-pouch"]);
  assert.equal(quote.total, 100 + 2500);
  assert.equal(archer.purse, parseCoin("30 gp"));
  assert.deepEqual(quote.short, []);
  const poor = stapleQuote({ ...archer, purse: parseCoin("5 sp") }, market);
  assert.deepEqual(poor.lines, []);
  assert.equal(poor.short[0].id, "arrows");
  assert.equal(archer.purse, parseCoin("30 gp"));
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
