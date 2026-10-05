import assert from "node:assert/strict";
import test from "node:test";
import {
  abilityMod,
  abilityTotals,
  addBackgroundSkills,
  assignStandard,
  blankCharacter,
  cleanCharacter,
  effectiveHp,
  formatMod,
  pointBuySpent,
  presentCharacter,
  proficiencyBonus,
  rollScores,
  stepPointBuy,
  suggestedHp,
} from "../src/character.js";

test("modifiers and proficiency follow the 2014 steps", () => {
  assert.equal(abilityMod(1), -5);
  assert.equal(abilityMod(8), -1);
  assert.equal(abilityMod(10), 0);
  assert.equal(abilityMod(15), 2);
  assert.equal(formatMod(-1), "−1");
  assert.equal(proficiencyBonus(1), 2);
  assert.equal(proficiencyBonus(4), 2);
  assert.equal(proficiencyBonus(5), 3);
  assert.equal(proficiencyBonus(9), 4);
  assert.equal(proficiencyBonus(13), 5);
  assert.equal(proficiencyBonus(17), 6);
});

test("a mountain dwarf keeps the racial bonuses off the base scores", () => {
  const character = cleanCharacter({
    touched: true,
    raceId: "dwarf",
    lineageId: "mountain",
    scores: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 },
  });
  const totals = abilityTotals(character);
  assert.equal(totals.str, 17);
  assert.equal(totals.con, 15);
  assert.equal(totals.dex, 14);
});

test("a half-elf adds two chosen bonuses and never stacks Charisma", () => {
  const character = cleanCharacter({
    touched: true,
    raceId: "half-elf",
    picks: ["cha", "str", "str", "wis", "dex"],
    scores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
  });
  const totals = abilityTotals(character);
  assert.equal(totals.cha, 10);
  assert.equal(totals.str, 9);
  assert.equal(totals.wis, 9);
  assert.equal(character.picks.length, 2);
});

test("point buy spends 27 on the standard array and refuses a sixteenth", () => {
  const scores = { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
  assert.equal(pointBuySpent(scores), 27);
  assert.deepEqual(stepPointBuy(scores, "str", 1), scores);
  const bought = stepPointBuy({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }, "str", 1);
  assert.equal(bought.str, 9);
  assert.equal(pointBuySpent(bought), 1);
});

test("the standard array swaps a score instead of duplicating it", () => {
  const next = assignStandard({ str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, "str", 8);
  assert.equal(next.str, 8);
  assert.equal(next.cha, 15);
});

test("hit points use the die at first level and the average after", () => {
  const fighter = cleanCharacter({
    touched: true,
    classId: "fighter",
    level: 5,
    raceId: "human",
    scores: { str: 15, dex: 14, con: 15, int: 12, wis: 10, cha: 8 },
  });
  assert.equal(abilityTotals(fighter).con, 16);
  assert.equal(suggestedHp(fighter), 13 + 9 * 4);
  assert.equal(effectiveHp(fighter), 49);
  fighter.hp = 20;
  assert.equal(effectiveHp(fighter), 20);
  const wizard = cleanCharacter({
    classId: "wizard",
    level: 2,
    scores: { str: 8, dex: 14, con: 10, int: 15, wis: 12, cha: 8 },
  });
  assert.equal(suggestedHp(wizard), 10);
});

test("rolled scores keep the best three of four d6s", () => {
  const rolls = [0.99, 0, 0.5, 0.2];
  let index = 0;
  const scores = rollScores(() => {
    const roll = rolls[index % rolls.length];
    index += 1;
    return roll;
  });
  assert.equal(scores.str, 6 + 4 + 2);
});

test("a blank sheet stays off the DM view until someone edits it", () => {
  assert.equal(presentCharacter(blankCharacter()), null);
  assert.equal(presentCharacter({}), null);
  const shown = presentCharacter(cleanCharacter({
    touched: true,
    name: "Mara",
    raceId: "elf",
    lineageId: "high",
    classId: "fighter",
    subclassId: "champion",
    backgroundId: "soldier",
    level: 3,
    skills: ["athletics", "perception"],
  }));
  assert.match(shown.title, /Mara/);
  assert.match(shown.title, /High Elf/);
  assert.match(shown.title, /Champion Fighter/);
  assert.match(shown.meta, /Soldier/);
  assert.match(shown.meta, /proficiency \+2/);
  assert.match(shown.abilities, /Dex 16 \(\+3\)/);
  assert.equal(shown.skills, "Athletics, Perception");
});

test("custom people and classes survive a reload, and unknown ids do not", () => {
  const saved = cleanCharacter({
    touched: true,
    raceId: "beholder",
    classId: "custom",
    customClass: "Warden",
    hitDie: 10,
    saves: ["wis", "wis", "con"],
    backgroundId: "custom",
    customBackground: "Ferry pilot",
    skills: ["perception", "made-up"],
  });
  assert.equal(saved.raceId, "");
  assert.equal(saved.customClass, "Warden");
  assert.equal(saved.hitDie, 10);
  assert.deepEqual(saved.saves, ["wis", "con"]);
  assert.equal(saved.customBackground, "Ferry pilot");
  assert.deepEqual(saved.skills, ["perception"]);
});

test("background skills are added without dropping the ones already taken", () => {
  const skills = addBackgroundSkills(cleanCharacter({
    backgroundId: "soldier",
    skills: ["perception", "athletics"],
  }));
  assert.deepEqual(skills, ["perception", "athletics", "intimidation"]);
});
