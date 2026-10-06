import assert from "node:assert/strict";
import test from "node:test";
import {
  feedKind,
  heroInOrder,
  lightTone,
  naturalTag,
  partyLevels,
  passiveSummary,
  skilledSummary,
} from "../src/screen.js";

test("only a numbered roll is a roll, and a natural result is marked", () => {
  assert.equal(feedKind("Rolled 18 for Perception. 1d20 + 5."), "roll");
  assert.equal(feedKind("Rolled ability scores: 16, 14, 13, 12, 10, 9."), "table");
  assert.equal(feedKind("Lit a torch."), "table");
  assert.equal(naturalTag("Rolled 20 for Attack. 1d20. Natural 20."), "natural-20");
  assert.equal(naturalTag("Rolled 1 for Save. 1d20. Natural 1."), "natural-1");
  assert.equal(naturalTag("Lit a torch."), "");
});

test("a light is low in the last five minutes and out at zero", () => {
  assert.equal(lightTone(5 * 60 * 1000 + 1), "steady");
  assert.equal(lightTone(5 * 60 * 1000), "low");
  assert.equal(lightTone(1), "low");
  assert.equal(lightTone(0), "out");
  assert.equal(lightTone(-20), "out");
});

test("the hero in the order matches the character or the seat, not a monster", () => {
  const order = [
    { name: "Wolf", hp: 7 },
    { name: "Mara", hp: 12, ac: 16 },
  ];
  assert.equal(heroInOrder(order, ["Seat", "Mara"]).ac, 16);
  assert.equal(heroInOrder(order, ["mara"]).hp, 12);
  assert.equal(heroInOrder(order, ["Seat"]), null);
  assert.equal(heroInOrder(order, ["", "  "]), null);
});

test("party levels skip a seat that has not made a character", () => {
  assert.deepEqual(partyLevels([
    { touched: false, level: 9 },
    { touched: true, level: 5 },
    { touched: true, level: 3 },
  ]), [5, 3]);
});

test("passives and skill bonuses are ready for the DM to read", () => {
  const character = {
    touched: true,
    level: 5,
    skills: ["perception", "athletics"],
    scores: { str: 15, dex: 14, con: 13, int: 10, wis: 12, cha: 8 },
  };
  assert.equal(passiveSummary(character), "Passive Perception 14 · Passive Insight 11");
  assert.equal(skilledSummary(character), "Perception +4, Athletics +5");
  assert.equal(passiveSummary({ touched: false }), "");
  assert.equal(skilledSummary({ touched: false }), "");
});
