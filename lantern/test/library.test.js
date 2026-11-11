import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanLibrary,
  exportLibrary,
  itemsToLines,
  matchGear,
  mergeLibrary,
  parseCharacterFields,
  parseCharacterText,
  parseItems,
  parseMonsters,
  parseSpells,
  readLibraryFile,
} from "../src/library.js";
import { abilityTotals } from "../src/character.js";

// SRD 5.1 text, CC-BY-4.0.
const GOBLIN = `Goblin
Small humanoid (goblinoid), neutral evil
Armor Class 15 (leather armor, shield)
Hit Points 7 (2d6)
Speed 30 ft.
STR DEX CON INT WIS CHA
8 (−1) 14 (+2) 10 (+0) 10 (+0) 8 (−1) 8 (−1)
Skills Stealth +6
Senses darkvision 60 ft., passive Perception 9
Languages Common, Goblin
Challenge 1/4 (50 XP)
Nimble Escape. The goblin can take the Disengage or Hide action as a bonus
action on each of its turns.
Actions
Scimitar. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5
(1d6 + 2) slashing damage.
Shortbow. Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target.
Hit: 5 (1d6 + 2) piercing damage.
Wolf
Medium beast, unaligned
Armor Class 13 (natural armor)
Hit Points 11 (2d8 + 2)
Speed 40 ft.
STR 12 (+1) DEX 15 (+2) CON 12 (+1) INT 3 (−4) WIS 12 (+1) CHA 6 (−2)
Challenge 1/4 (50 XP)
Pack Tactics. The wolf has advantage on an attack roll against a creature if
at least one of the wolf's allies is within 5 feet of the creature.
Actions
Bite. Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 7 (2d4 + 2)
piercing damage.`.split("\n");

test("stat blocks become Lantern monsters", () => {
  const [goblin, wolf] = parseMonsters(GOBLIN);
  assert.equal(goblin.name, "Goblin");
  assert.equal(goblin.size, "Small");
  assert.equal(goblin.type, "humanoid (goblinoid)");
  assert.equal(goblin.alignment, "neutral evil");
  assert.equal(goblin.ac, 15);
  assert.equal(goblin.hp, 7);
  assert.equal(goblin.hpDice, "2d6");
  assert.deepEqual(goblin.scores, { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 });
  assert.equal(goblin.cr, "1/4");
  assert.equal(goblin.xp, 50);
  assert.equal(goblin.skills, "Stealth +6");
  assert.deepEqual(goblin.traits.map((entry) => entry.name), ["Nimble Escape"]);
  assert.deepEqual(goblin.actions.map((entry) => entry.name), ["Scimitar", "Shortbow"]);
  assert.match(goblin.actions[0].text, /slashing damage/);
  assert.equal(wolf.name, "Wolf");
  assert.equal(wolf.scores.int, 3);
  assert.equal(wolf.actions[0].name, "Bite");
});

test("spells read their level, school, and fields", () => {
  const spells = parseSpells(`Fire Bolt
Evocation cantrip
Casting Time: 1 action
Range: 120 feet
Components: V, S
Duration: Instantaneous
You hurl a mote of fire at a creature or object within range.
Detect Magic
1st-level divination (ritual)
Casting Time: 1 action
Range: Self
Components: V, S
Duration: Concentration, up to 10 minutes
For the duration, you sense the presence of magic within 30 feet of you.`.split("\n"));
  assert.equal(spells.length, 2);
  assert.equal(spells[0].name, "Fire Bolt");
  assert.equal(spells[0].level, 0);
  assert.equal(spells[0].school, "evocation");
  assert.equal(spells[0].range, "120 feet");
  assert.equal(spells[1].ritual, true);
  assert.equal(spells[1].concentration, true);
  assert.match(spells[1].text, /sense the presence/);
});

test("magic items read rarity and attunement", () => {
  const [cloak] = parseItems(`Cloak of Protection
Wondrous item, uncommon (requires attunement)
You gain a +1 bonus to AC and saving throws while you wear this cloak.`.split("\n"));
  assert.equal(cloak.name, "Cloak of Protection");
  assert.equal(cloak.rarity, "uncommon");
  assert.equal(cloak.attune, true);
  assert.match(cloak.text, /\+1 bonus/);
});

test("a fillable sheet becomes a Lantern character without doubling the people bonus", () => {
  const sheet = parseCharacterFields({
    CharacterName: "Mara",
    ClassLevel: "Fighter 3",
    "Race ": "Hill Dwarf",
    Background: "Soldier",
    Alignment: "Lawful good",
    STR: "16", DEX: "12", CON: "16", INT: "10", WIS: "13", CHA: "8",
    HPMax: "31",
    AC: "18",
    Equipment: "Chain mail, longsword, 2 handaxes, explorer's pack, lucky coin",
    GP: "15",
    "Spells 1014": "Bless",
  });
  assert.equal(sheet.name, "Mara");
  assert.equal(sheet.classId, "fighter");
  assert.equal(sheet.level, 3);
  assert.equal(sheet.raceId, "dwarf");
  assert.equal(sheet.lineageId, "hill");
  assert.equal(sheet.backgroundId, "soldier");
  assert.equal(sheet.alignment, "lg");
  assert.equal(abilityTotals(sheet).con, 16);
  assert.equal(abilityTotals(sheet).wis, 13);
  assert.equal(sheet.maxHp, 31);
  assert.equal(sheet.acOverride, 18);
  assert.equal(sheet.purse, 1500);
  assert.deepEqual(sheet.items.map((item) => [item.id, item.qty]), [["chain-mail", 1], ["longsword", 1], ["handaxe", 2], ["explorers-pack", 1]]);
  assert.match(sheet.traits, /lucky coin/);
  assert.equal(sheet.extras.spellbook[0].name, "Bless");
});

test("a printed sheet still gives name and scores", () => {
  const sheet = parseCharacterText(["Character Name", "Bram", "Class & Level", "Cleric 2", "Race", "Human", "Strength 12", "Dexterity 10", "Constitution 14", "Intelligence 10", "Wisdom 16", "Charisma 11"]);
  assert.equal(sheet.name, "Bram");
  assert.equal(sheet.classId, "cleric");
  assert.equal(abilityTotals(sheet).wis, 16);
});

test("gear names match the catalog and the rest is kept", () => {
  const { items, rest } = matchGear("10 torches, rope, a mirror, grandmother's locket");
  assert.deepEqual(items.map((item) => item.id), ["torch"]);
  assert.ok(rest.includes("grandmother's locket"));
});

test("two columns read left then right", () => {
  const lines = itemsToLines([
    { str: "Left one", x: 40, y: 700, width: 100 },
    { str: "Right one", x: 340, y: 700, width: 100 },
    { str: "Left two", x: 40, y: 680, width: 100 },
    { str: "Right two", x: 340, y: 680, width: 100 },
  ], 600);
  assert.deepEqual(lines, ["Left one", "Left two", "Right one", "Right two"]);
});

test("library files round-trip and merge by name", () => {
  const [goblin] = parseMonsters(GOBLIN);
  const file = exportLibrary({ monsters: [goblin] });
  const read = readLibraryFile(JSON.parse(JSON.stringify(file)));
  assert.equal(read.monsters[0].name, "Goblin");
  const merged = mergeLibrary(read, { monsters: [{ ...goblin, hp: 12 }] });
  assert.equal(merged.monsters.length, 1);
  assert.equal(merged.monsters[0].hp, 12);
  assert.throws(() => readLibraryFile({ kind: "character" }), /player seat/);
  assert.deepEqual(cleanLibrary({ monsters: [{ name: "" }] }).monsters, []);
});
