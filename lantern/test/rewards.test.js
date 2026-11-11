import assert from "node:assert/strict";
import test from "node:test";
import { blankCharacter } from "../src/character.js";
import { applyGift, levelForXp } from "../src/extras.js";
import { crNumber, rollHoard } from "../src/treasure.js";
import { cleanStory, passTime, rollEncounter } from "../src/dmstory.js";
import { searchPacks } from "../src/dmparty.js";
import { hourText } from "../src/combat.js";

test("gifts land in the character", () => {
  let character = { ...blankCharacter(), purse: 100 };
  character = applyGift(character, { kind: "coin", cp: 2500 }).character;
  assert.equal(character.purse, 2600);
  character = applyGift(character, { kind: "inspiration" }).character;
  assert.equal(character.inspiration, true);
  character = applyGift(character, { kind: "xp", xp: 350 }).character;
  assert.equal(character.extras.xp, 350);
  assert.equal(levelForXp(character.extras.xp), 2);
  character = applyGift(character, { kind: "item", key: "a1b2c3d4e5f60718", name: "Ring of Warmth", shown: "a warm copper ring", text: "Resist cold.", qty: 1, attune: true }).character;
  const ring = character.extras.trinkets[0];
  assert.equal(ring.name, "a warm copper ring");
  assert.equal(ring.unknown, true);
  character = applyGift(character, { kind: "identify", key: "a1b2c3d4e5f60718", name: "Ring of Warmth", text: "Resist cold." }).character;
  assert.equal(character.extras.trinkets[0].name, "Ring of Warmth");
  assert.equal(character.extras.trinkets[0].note, "Resist cold.");
  assert.equal(character.extras.trinkets[0].unknown, undefined);
  assert.equal(applyGift(character, { kind: "nope" }), null);
});

test("hoards follow the challenge rating", () => {
  assert.equal(crNumber("1/4"), 0.25);
  const rng = () => 0.5;
  const low = rollHoard("1/2", rng);
  const high = rollHoard("17", rng);
  assert.ok(high.cp > low.cp);
  assert.ok(Array.isArray(low.items));
});

test("story notebook, encounters, and time", () => {
  const story = cleanStory({ scenes: [{ title: "Ford", warning: "drowning" }, { title: "" }], encounters: [{ text: "Wolves", weight: 3 }, { text: "Rain", weight: 1 }] });
  assert.equal(story.scenes.length, 1);
  assert.equal(rollEncounter(story.encounters, () => 0.9).text, "Rain");
  assert.equal(rollEncounter(story.encounters, () => 0.1).text, "Wolves");
  assert.deepEqual(passTime({ day: 2, hour: 20, weather: "Fog" }, 8), { day: 3, hour: 4, weather: "Fog" });
  assert.equal(hourText(4), "night");
});

test("pack search finds who carries what", () => {
  const hits = searchPacks([{ name: "Mara", items: [{ name: "Hempen rope (50 feet)", qty: 1 }] }, { name: "Bram", items: [{ name: "Torch", qty: 5 }] }], "ropes");
  assert.deepEqual(hits.map((hit) => hit.who), ["Mara"]);
});
