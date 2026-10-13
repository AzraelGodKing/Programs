// Common 2014 options: names, ability bonuses, hit dice, saves, and skill lists.
// The sentences in the sheet are written here. Custom covers anything else.

import { cleanItems, cleanPurse, formatCoin } from "./gear.js";
import { blankDeath, cleanDeath } from "./order.js";

export const ABILITIES = [
  { id: "str", label: "Strength", short: "Str" },
  { id: "dex", label: "Dexterity", short: "Dex" },
  { id: "con", label: "Constitution", short: "Con" },
  { id: "int", label: "Intelligence", short: "Int" },
  { id: "wis", label: "Wisdom", short: "Wis" },
  { id: "cha", label: "Charisma", short: "Cha" },
];

export const ABILITY_IDS = ABILITIES.map((ability) => ability.id);

export const SKILLS = [
  { id: "acrobatics", ability: "dex", label: "Acrobatics" },
  { id: "animal", ability: "wis", label: "Animal Handling" },
  { id: "arcana", ability: "int", label: "Arcana" },
  { id: "athletics", ability: "str", label: "Athletics" },
  { id: "deception", ability: "cha", label: "Deception" },
  { id: "history", ability: "int", label: "History" },
  { id: "insight", ability: "wis", label: "Insight" },
  { id: "intimidation", ability: "cha", label: "Intimidation" },
  { id: "investigation", ability: "int", label: "Investigation" },
  { id: "medicine", ability: "wis", label: "Medicine" },
  { id: "nature", ability: "int", label: "Nature" },
  { id: "perception", ability: "wis", label: "Perception" },
  { id: "performance", ability: "cha", label: "Performance" },
  { id: "persuasion", ability: "cha", label: "Persuasion" },
  { id: "religion", ability: "int", label: "Religion" },
  { id: "sleight", ability: "dex", label: "Sleight of Hand" },
  { id: "stealth", ability: "dex", label: "Stealth" },
  { id: "survival", ability: "wis", label: "Survival" },
];

export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
export const POINT_BUY_BUDGET = 27;
export const POINT_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

export const ALIGNMENTS = [
  ["", "No alignment yet"],
  ["lg", "Lawful good"],
  ["ng", "Neutral good"],
  ["cg", "Chaotic good"],
  ["ln", "Lawful neutral"],
  ["n", "Neutral"],
  ["cn", "Chaotic neutral"],
  ["le", "Lawful evil"],
  ["ne", "Neutral evil"],
  ["ce", "Chaotic evil"],
  ["unaligned", "Unaligned"],
  ["custom", "Custom"],
];

const HIT_DICE = new Set([4, 6, 8, 10, 12]);
const SIZES = new Set(["Small", "Medium"]);
const METHODS = new Set(["standard", "pointbuy", "rolled", "manual"]);

export const RACES = [
  {
    id: "dwarf",
    name: "Dwarf",
    size: "Medium",
    speed: 25,
    darkvision: 60,
    languages: "Common, Dwarvish",
    bonuses: { con: 2 },
    lineageLabel: "Subrace",
    lineages: [
      { id: "hill", name: "Hill", bonuses: { wis: 1 } },
      { id: "mountain", name: "Mountain", bonuses: { str: 2 } },
    ],
  },
  {
    id: "elf",
    name: "Elf",
    size: "Medium",
    speed: 30,
    darkvision: 60,
    languages: "Common, Elvish",
    bonuses: { dex: 2 },
    lineageLabel: "Subrace",
    lineages: [
      { id: "high", name: "High", bonuses: { int: 1 } },
      { id: "wood", name: "Wood", bonuses: { wis: 1 } },
      { id: "dark", name: "Dark", bonuses: { cha: 1 } },
    ],
  },
  {
    id: "halfling",
    name: "Halfling",
    size: "Small",
    speed: 25,
    languages: "Common, Halfling",
    bonuses: { dex: 2 },
    lineageLabel: "Subrace",
    lineages: [
      { id: "lightfoot", name: "Lightfoot", bonuses: { cha: 1 } },
      { id: "stout", name: "Stout", bonuses: { con: 1 } },
    ],
  },
  {
    id: "human",
    name: "Human",
    size: "Medium",
    speed: 30,
    languages: "Common, plus one of your choice",
    bonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    lineages: [],
  },
  {
    id: "dragonborn",
    name: "Dragonborn",
    size: "Medium",
    speed: 30,
    languages: "Common, Draconic",
    bonuses: { str: 2, cha: 1 },
    lineageLabel: "Draconic ancestry",
    lineages: [
      { id: "black", name: "Black", damage: "acid" },
      { id: "blue", name: "Blue", damage: "lightning" },
      { id: "brass", name: "Brass", damage: "fire" },
      { id: "bronze", name: "Bronze", damage: "lightning" },
      { id: "copper", name: "Copper", damage: "acid" },
      { id: "gold", name: "Gold", damage: "fire" },
      { id: "green", name: "Green", damage: "poison" },
      { id: "red", name: "Red", damage: "fire" },
      { id: "silver", name: "Silver", damage: "cold" },
      { id: "white", name: "White", damage: "cold" },
    ],
  },
  {
    id: "gnome",
    name: "Gnome",
    size: "Small",
    speed: 25,
    darkvision: 60,
    languages: "Common, Gnomish",
    bonuses: { int: 2 },
    lineageLabel: "Subrace",
    lineages: [
      { id: "forest", name: "Forest", bonuses: { dex: 1 } },
      { id: "rock", name: "Rock", bonuses: { con: 1 } },
    ],
  },
  {
    id: "half-elf",
    name: "Half-elf",
    size: "Medium",
    speed: 30,
    darkvision: 60,
    languages: "Common, Elvish, plus one of your choice",
    bonuses: { cha: 2 },
    picks: 2,
    lineages: [],
  },
  {
    id: "half-orc",
    name: "Half-orc",
    size: "Medium",
    speed: 30,
    darkvision: 60,
    languages: "Common, Orc",
    bonuses: { str: 2, con: 1 },
    lineages: [],
  },
  {
    id: "tiefling",
    name: "Tiefling",
    size: "Medium",
    speed: 30,
    darkvision: 60,
    languages: "Common, Infernal",
    bonuses: { int: 1, cha: 2 },
    lineages: [],
  },
];

export const CLASSES = [
  {
    id: "barbarian",
    name: "Barbarian",
    hitDie: 12,
    saves: ["str", "con"],
    skillCount: 2,
    skills: ["animal", "athletics", "intimidation", "nature", "perception", "survival"],
    subclassLevel: 3,
    subclasses: [{ id: "berserker", name: "Path of the Berserker" }],
  },
  {
    id: "bard",
    name: "Bard",
    hitDie: 8,
    saves: ["dex", "cha"],
    skillCount: 3,
    skills: null,
    subclassLevel: 3,
    subclasses: [{ id: "lore", name: "College of Lore" }],
  },
  {
    id: "cleric",
    name: "Cleric",
    hitDie: 8,
    saves: ["wis", "cha"],
    skillCount: 2,
    skills: ["history", "insight", "medicine", "persuasion", "religion"],
    subclassLevel: 1,
    subclasses: [{ id: "life", name: "Life Domain" }],
  },
  {
    id: "druid",
    name: "Druid",
    hitDie: 8,
    saves: ["int", "wis"],
    skillCount: 2,
    skills: ["arcana", "animal", "insight", "medicine", "nature", "perception", "religion", "survival"],
    subclassLevel: 2,
    subclasses: [{ id: "land", name: "Circle of the Land" }],
  },
  {
    id: "fighter",
    name: "Fighter",
    hitDie: 10,
    saves: ["str", "con"],
    skillCount: 2,
    skills: ["acrobatics", "animal", "athletics", "history", "insight", "intimidation", "perception", "survival"],
    subclassLevel: 3,
    subclasses: [{ id: "champion", name: "Champion" }],
  },
  {
    id: "monk",
    name: "Monk",
    hitDie: 8,
    saves: ["str", "dex"],
    skillCount: 2,
    skills: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"],
    subclassLevel: 3,
    subclasses: [{ id: "open-hand", name: "Way of the Open Hand" }],
  },
  {
    id: "paladin",
    name: "Paladin",
    hitDie: 10,
    saves: ["wis", "cha"],
    skillCount: 2,
    skills: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"],
    subclassLevel: 3,
    subclasses: [{ id: "devotion", name: "Oath of Devotion" }],
  },
  {
    id: "ranger",
    name: "Ranger",
    hitDie: 10,
    saves: ["str", "dex"],
    skillCount: 3,
    skills: ["animal", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"],
    subclassLevel: 3,
    subclasses: [{ id: "hunter", name: "Hunter" }],
  },
  {
    id: "rogue",
    name: "Rogue",
    hitDie: 8,
    saves: ["dex", "int"],
    skillCount: 4,
    skills: ["acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception", "performance", "persuasion", "sleight", "stealth"],
    subclassLevel: 3,
    subclasses: [{ id: "thief", name: "Thief" }],
  },
  {
    id: "sorcerer",
    name: "Sorcerer",
    hitDie: 6,
    saves: ["con", "cha"],
    skillCount: 2,
    skills: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"],
    subclassLevel: 1,
    subclasses: [{ id: "draconic", name: "Draconic Bloodline" }],
  },
  {
    id: "warlock",
    name: "Warlock",
    hitDie: 8,
    saves: ["wis", "cha"],
    skillCount: 2,
    skills: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"],
    subclassLevel: 1,
    subclasses: [{ id: "fiend", name: "The Fiend" }],
  },
  {
    id: "wizard",
    name: "Wizard",
    hitDie: 6,
    saves: ["int", "wis"],
    skillCount: 2,
    skills: ["arcana", "history", "insight", "investigation", "medicine", "religion"],
    subclassLevel: 2,
    subclasses: [{ id: "evocation", name: "School of Evocation" }],
  },
];

export const BACKGROUNDS = [
  { id: "acolyte", name: "Acolyte", skills: ["insight", "religion"] },
  { id: "charlatan", name: "Charlatan", skills: ["deception", "sleight"] },
  { id: "criminal", name: "Criminal", skills: ["deception", "stealth"] },
  { id: "entertainer", name: "Entertainer", skills: ["acrobatics", "performance"] },
  { id: "folk-hero", name: "Folk Hero", skills: ["animal", "survival"] },
  { id: "guild", name: "Guild Artisan", skills: ["insight", "persuasion"] },
  { id: "hermit", name: "Hermit", skills: ["medicine", "religion"] },
  { id: "noble", name: "Noble", skills: ["history", "persuasion"] },
  { id: "outlander", name: "Outlander", skills: ["athletics", "survival"] },
  { id: "sage", name: "Sage", skills: ["arcana", "history"] },
  { id: "sailor", name: "Sailor", skills: ["athletics", "perception"] },
  { id: "soldier", name: "Soldier", skills: ["athletics", "intimidation"] },
  { id: "urchin", name: "Urchin", skills: ["sleight", "stealth"] },
];

const RACE_IDS = new Set(RACES.map((race) => race.id));
const CLASS_IDS = new Set(CLASSES.map((klass) => klass.id));
const BACKGROUND_IDS = new Set(BACKGROUNDS.map((background) => background.id));
const SKILL_IDS = new Set(SKILLS.map((skill) => skill.id));
const ALIGNMENT_IDS = new Set(ALIGNMENTS.map(([id]) => id));

function emptyBonuses() {
  return { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
}

function text(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function int(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function findAbility(id) {
  return ABILITIES.find((ability) => ability.id === id) || null;
}

export function findSkill(id) {
  return SKILLS.find((skill) => skill.id === id) || null;
}

export function findRace(id) {
  return RACES.find((race) => race.id === id) || null;
}

export function findClass(id) {
  return CLASSES.find((klass) => klass.id === id) || null;
}

export function findBackground(id) {
  return BACKGROUNDS.find((background) => background.id === id) || null;
}

export function findLineage(race, id) {
  if (!race) return null;
  return race.lineages.find((lineage) => lineage.id === id) || null;
}

export function abilityMod(score) {
  return Math.floor((Number(score) - 10) / 2);
}

export function formatMod(mod) {
  const n = Number(mod) || 0;
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "+0";
}

export function proficiencyBonus(level) {
  return 2 + Math.floor((int(level, 1, 1, 20) - 1) / 4);
}

export function defaultScores() {
  return { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
}

export function blankCharacter() {
  return {
    touched: false,
    name: "",
    raceId: "",
    customRace: "",
    lineageId: "",
    customLineage: "",
    picks: [],
    customBonuses: emptyBonuses(),
    customSpeed: 30,
    customSize: "Medium",
    customLanguages: "",
    classId: "",
    customClass: "",
    hitDie: 8,
    saves: [],
    skillCount: 2,
    subclassId: "",
    customSubclass: "",
    backgroundId: "",
    customBackground: "",
    alignment: "",
    customAlignment: "",
    level: 1,
    method: "standard",
    scores: defaultScores(),
    skills: [],
    hp: null,
    traits: "",
    items: [],
    purse: null,
    kitId: "",
    customDarkvision: 0,
    acOverride: null,
    maxHp: null,
    inspiration: false,
    hitDiceUsed: 0,
    spells: [],
    death: blankDeath(),
  };
}

function cleanSpells(value) {
  if (!Array.isArray(value)) return [];
  const spells = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const name = text(raw.name, 60);
    if (!name) continue;
    spells.push({
      id: text(raw.id, 80) || `spell-${spells.length}`,
      name,
      slot: int(raw.slot, 0, 0, 9),
      used: raw.used === true,
    });
    if (spells.length === 12) break;
  }
  return spells;
}

export function cleanCharacter(input) {
  const blank = blankCharacter();
  if (!input || typeof input !== "object") return blank;
  const raceId = input.raceId === "custom" || RACE_IDS.has(input.raceId) ? input.raceId : "";
  const race = findRace(raceId);
  const lineageId = input.lineageId === "custom" || findLineage(race, input.lineageId)
    ? input.lineageId
    : "";
  const classId = input.classId === "custom" || CLASS_IDS.has(input.classId) ? input.classId : "";
  const klass = findClass(classId);
  const subclassId = input.subclassId === "custom" || klass?.subclasses.some((sub) => sub.id === input.subclassId)
    ? input.subclassId
    : "";
  const backgroundId = input.backgroundId === "custom" || BACKGROUND_IDS.has(input.backgroundId)
    ? input.backgroundId
    : "";
  const scores = { ...blank.scores };
  const rawScores = input.scores && typeof input.scores === "object" ? input.scores : {};
  for (const id of ABILITY_IDS) scores[id] = int(rawScores[id], blank.scores[id], 1, 30);
  const bonuses = emptyBonuses();
  const rawBonuses = input.customBonuses && typeof input.customBonuses === "object" ? input.customBonuses : {};
  for (const id of ABILITY_IDS) bonuses[id] = int(rawBonuses[id], 0, -5, 6);
  const pickSource = Array.isArray(input.picks) ? input.picks : [];
  const picks = [];
  for (const id of pickSource) {
    if (id === "cha" || !ABILITY_IDS.includes(id) || picks.includes(id)) continue;
    picks.push(id);
    if (picks.length === 2) break;
  }
  const saveSource = Array.isArray(input.saves) ? input.saves : [];
  const saves = [];
  for (const id of saveSource) {
    if (!ABILITY_IDS.includes(id) || saves.includes(id)) continue;
    saves.push(id);
    if (saves.length === 2) break;
  }
  const skillSource = Array.isArray(input.skills) ? input.skills : [];
  const skills = [];
  for (const id of skillSource) {
    if (!SKILL_IDS.has(id) || skills.includes(id)) continue;
    skills.push(id);
  }
  return {
    touched: input.touched === true,
    name: text(input.name, 80),
    raceId,
    customRace: text(input.customRace, 40),
    lineageId: race ? lineageId : "",
    customLineage: text(input.customLineage, 40),
    picks: race?.picks ? picks : [],
    customBonuses: bonuses,
    customSpeed: int(input.customSpeed, 30, 0, 120),
    customSize: SIZES.has(input.customSize) ? input.customSize : "Medium",
    customLanguages: text(input.customLanguages, 80),
    classId,
    customClass: text(input.customClass, 40),
    hitDie: HIT_DICE.has(input.hitDie) ? input.hitDie : 8,
    saves,
    skillCount: int(input.skillCount, 2, 0, 6),
    subclassId,
    customSubclass: text(input.customSubclass, 40),
    backgroundId,
    customBackground: text(input.customBackground, 40),
    alignment: ALIGNMENT_IDS.has(input.alignment) ? input.alignment : "",
    customAlignment: text(input.customAlignment, 40),
    level: int(input.level, 1, 1, 20),
    method: METHODS.has(input.method) ? input.method : "standard",
    scores,
    skills,
    hp: input.hp == null || input.hp === "" ? null : int(input.hp, null, 0, 999),
    traits: typeof input.traits === "string" ? input.traits.slice(0, 1000) : "",
    items: cleanItems(input.items),
    purse: cleanPurse(input.purse),
    kitId: text(input.kitId, 40),
    customDarkvision: int(input.customDarkvision, 0, 0, 120),
    acOverride: input.acOverride == null || input.acOverride === "" ? null : int(input.acOverride, null, 0, 40),
    maxHp: input.maxHp == null || input.maxHp === "" ? null : int(input.maxHp, null, 1, 999),
    inspiration: input.inspiration === true,
    hitDiceUsed: int(input.hitDiceUsed, 0, 0, 20),
    spells: cleanSpells(input.spells),
    death: cleanDeath(input.death),
  };
}

export function darkvisionRange(character) {
  if (!character || character.raceId === "custom") return int(character?.customDarkvision, 0, 0, 120);
  return findRace(character.raceId)?.darkvision || 0;
}

export function maxHitPoints(character) {
  if (Number.isInteger(character.maxHp) && character.maxHp > 0) return character.maxHp;
  const suggested = suggestedHp(character);
  if (Number.isInteger(character.hp) && suggested != null) return Math.max(character.hp, suggested);
  return suggested ?? character.hp ?? 1;
}

export function breathDice(character) {
  const race = findRace(character.raceId);
  const lineage = findLineage(race, character.lineageId);
  if (!lineage?.damage) return null;
  const level = int(character.level, 1, 1, 20);
  const count = level >= 16 ? 5 : level >= 11 ? 4 : level >= 6 ? 3 : 2;
  return { count, sides: 6, damage: lineage.damage };
}

export function classInfo(character) {
  if (character.classId === "custom") {
    const name = character.customClass || "Custom class";
    return {
      id: "custom",
      name,
      hitDie: character.hitDie,
      saves: character.saves,
      skillCount: character.skillCount,
      skills: null,
      subclassLevel: 1,
      subclasses: [],
      custom: true,
    };
  }
  return findClass(character.classId);
}

export function racialBonuses(character) {
  const bonuses = emptyBonuses();
  if (character.raceId === "custom") {
    for (const id of ABILITY_IDS) bonuses[id] = character.customBonuses[id] || 0;
    return bonuses;
  }
  const race = findRace(character.raceId);
  if (!race) return bonuses;
  for (const [id, amount] of Object.entries(race.bonuses || {})) bonuses[id] += amount;
  const lineage = findLineage(race, character.lineageId);
  for (const [id, amount] of Object.entries(lineage?.bonuses || {})) bonuses[id] += amount;
  if (race.picks) {
    for (const id of character.picks) {
      if (ABILITY_IDS.includes(id) && id !== "cha") bonuses[id] += 1;
    }
  }
  return bonuses;
}

export function abilityTotals(character) {
  const racial = racialBonuses(character);
  const totals = {};
  for (const id of ABILITY_IDS) totals[id] = character.scores[id] + racial[id];
  return totals;
}

export function pointBuySpent(scores) {
  let spent = 0;
  for (const id of ABILITY_IDS) {
    const cost = POINT_COSTS[scores[id]];
    if (cost == null) return null;
    spent += cost;
  }
  return spent;
}

export function assignStandard(scores, ability, value) {
  if (!ABILITY_IDS.includes(ability) || !STANDARD_ARRAY.includes(value)) return { ...scores };
  const next = { ...scores };
  const previous = next[ability];
  const other = ABILITY_IDS.find((id) => id !== ability && next[id] === value);
  next[ability] = value;
  if (other && STANDARD_ARRAY.includes(previous)) next[other] = previous;
  return next;
}

export function stepPointBuy(scores, ability, delta) {
  if (!ABILITY_IDS.includes(ability) || !delta) return { ...scores };
  const goal = scores[ability] + delta;
  if (!Object.prototype.hasOwnProperty.call(POINT_COSTS, goal)) return { ...scores };
  const next = { ...scores, [ability]: goal };
  const spent = pointBuySpent(next);
  if (spent == null || spent > POINT_BUY_BUDGET) return { ...scores };
  return next;
}

export function rollScores(rng = Math.random) {
  const scores = {};
  for (const id of ABILITY_IDS) {
    const faces = [0, 1, 2, 3].map(() => 1 + Math.floor(rng() * 6)).sort((a, b) => a - b);
    scores[id] = faces[1] + faces[2] + faces[3];
  }
  return scores;
}

export function suggestedHp(character) {
  const info = classInfo(character);
  if (!info) return null;
  const con = abilityMod(abilityTotals(character).con);
  const first = Math.max(1, info.hitDie + con);
  const later = Math.max(1, Math.floor(info.hitDie / 2) + 1 + con);
  return first + later * (character.level - 1);
}

const RACE_NOTES = {
  dwarf: "Advantage on saves against poison, and resistance to poison damage. Stonework is familiar.",
  "dwarf:hill": "1 extra hit point at each level.",
  "dwarf:mountain": "Training with light and medium armor.",
  elf: "A trance of 4 hours stands in for a long sleep. Secret doors are easier to notice.",
  "elf:high": "One wizard cantrip, and one extra language.",
  "elf:wood": "You can hide when natural cover only lightly obscures you.",
  "elf:dark": "Sunlight bothers you.",
  halfling: "You can move through a larger creature's space. You may reroll a 1 on an attack, check, or save.",
  "halfling:lightfoot": "You can try to hide behind a creature one size larger than you.",
  "halfling:stout": "Advantage on saves against poison, and resistance to poison damage.",
  human: "One extra language is yours to name.",
  dragonborn: "Resistance matches the ancestry, and so does the breath.",
  gnome: "Advantage on Intelligence, Wisdom, and Charisma saves against magic.",
  "gnome:forest": "You know minor illusion.",
  "gnome:rock": "You can tinker a small clockwork device.",
  "half-elf": "You trance like an elf. Choose two extra skills on the Story step.",
  "half-orc": "Once between rests, you can stay at 1 hit point instead of falling to 0. A critical hit adds one damage die.",
  tiefling: "You know thaumaturgy. Hellish rebuke and darkness come at later levels.",
};

const CLASS_DETAIL = {
  barbarian: {
    armor: "Light and medium armor, and shields.",
    weapons: "Simple and martial weapons.",
    features: ["Rage.", "Unarmored defense is 10 + Dexterity + Constitution."],
  },
  bard: {
    armor: "Light armor.",
    weapons: "Simple weapons, plus hand crossbows, longswords, rapiers, and shortswords.",
    features: ["Spellcasting uses Charisma.", "Bardic inspiration."],
  },
  cleric: {
    armor: "Light and medium armor, and shields.",
    weapons: "Simple weapons.",
    features: ["Spellcasting uses Wisdom."],
  },
  druid: {
    armor: "Light and medium armor that is not metal, and shields.",
    weapons: "Clubs, daggers, darts, javelins, maces, quarterstaffs, scimitars, sickles, slings, and spears.",
    features: ["Spellcasting uses Wisdom."],
  },
  fighter: {
    armor: "All armor, and shields.",
    weapons: "Simple and martial weapons.",
    features: ["Second Wind."],
  },
  monk: {
    armor: "None.",
    weapons: "Simple weapons and shortswords.",
    features: ["Unarmored defense is 10 + Dexterity + Wisdom."],
  },
  paladin: {
    armor: "All armor, and shields.",
    weapons: "Simple and martial weapons.",
    features: ["Lay on hands.", "Spellcasting uses Charisma."],
  },
  ranger: {
    armor: "Light and medium armor, and shields.",
    weapons: "Simple and martial weapons.",
    features: ["Favored enemy and natural explorer."],
  },
  rogue: {
    armor: "Light armor.",
    weapons: "Simple weapons, plus hand crossbows, longswords, rapiers, and shortswords.",
    features: ["Expertise.", "Sneak attack."],
  },
  sorcerer: {
    armor: "None.",
    weapons: "Daggers, darts, slings, quarterstaffs, and light crossbows.",
    features: ["Spellcasting uses Charisma."],
  },
  warlock: {
    armor: "Light armor.",
    weapons: "Simple weapons.",
    features: ["Spellcasting uses Charisma.", "The pact comes with the patron."],
  },
  wizard: {
    armor: "None.",
    weapons: "Daggers, darts, slings, quarterstaffs, and light crossbows.",
    features: ["Spellcasting uses Intelligence.", "A spellbook."],
  },
};

function bonusLine(bonuses) {
  const parts = ABILITY_IDS
    .filter((id) => bonuses[id])
    .map((id) => `${findAbility(id).short} ${formatMod(bonuses[id])}`);
  return parts.length ? `Ability bonuses: ${parts.join(", ")}.` : "";
}

export function peopleGrant(character) {
  if (!character?.raceId) return null;
  if (character.raceId === "custom") {
    const lines = [
      `${character.customSize}, speed ${character.customSpeed} ft.`,
      character.customDarkvision ? `Darkvision ${character.customDarkvision} ft.` : "No darkvision.",
    ];
    if (character.customLanguages) lines.push(character.customLanguages);
    const bonuses = bonusLine(racialBonuses(character));
    if (bonuses) lines.push(bonuses);
    return { title: character.customRace || "Custom people", lines };
  }
  const race = findRace(character.raceId);
  if (!race) return null;
  const lineage = findLineage(race, character.lineageId);
  const lines = [
    `${race.size}, speed ${race.speed} ft.`,
    race.darkvision ? `Darkvision ${race.darkvision} ft.` : "No darkvision.",
    race.languages,
  ];
  const bonuses = bonusLine(racialBonuses(character));
  if (bonuses) lines.push(bonuses);
  if (RACE_NOTES[race.id]) lines.push(RACE_NOTES[race.id]);
  const lineageNote = lineage ? RACE_NOTES[`${race.id}:${lineage.id}`] : "";
  if (lineageNote) lines.push(lineageNote);
  if (lineage?.damage) lines.push(`Breath weapon: ${lineage.damage}.`);
  const title = lineage ? `${lineage.name} ${race.name}` : race.name;
  return { title, lines };
}

export function classGrant(character) {
  const info = classInfo(character);
  if (!info) return null;
  const hp = suggestedHp(character);
  const saves = (info.saves || []).map((id) => findAbility(id)?.label).filter(Boolean);
  const offer = info.skills
    ? info.skills.map((id) => findSkill(id).label).join(", ")
    : "any skill";
  const lines = [
    `Hit die d${info.hitDie}. At this level that suggests ${hp} hit points.`,
    `Proficiency bonus ${formatMod(proficiencyBonus(character.level))}.`,
  ];
  if (saves.length) lines.push(`Saving throw proficiencies: ${saves.join(" and ")}.`);
  else if (info.custom) lines.push("Saving throw proficiencies: choose up to two.");
  lines.push(`Skill proficiencies: choose ${info.skillCount} from ${offer}.`);
  const detail = CLASS_DETAIL[info.id];
  if (detail) {
    lines.push(`Armor: ${detail.armor}`);
    lines.push(`Weapons: ${detail.weapons}`);
    lines.push(...detail.features);
  }
  if (!info.custom && info.subclasses?.length) {
    const only = info.subclasses[0];
    let line = `One subclass in this subset: ${only.name}, from level ${info.subclassLevel}.`;
    if (character.subclassId === only.id) line += " It is on this sheet.";
    else if (character.subclassId === "custom") line += " A custom subclass is written on this sheet instead.";
    lines.push(line);
  }
  return { title: info.name, lines };
}

export function effectiveHp(character) {
  if (Number.isInteger(character.hp)) return character.hp;
  return suggestedHp(character);
}

function raceLabel(character) {
  if (character.raceId === "custom") return character.customRace || "Custom people";
  const race = findRace(character.raceId);
  if (!race) return "";
  if (character.lineageId === "custom") {
    const custom = character.customLineage;
    return custom ? `${custom} ${race.name}` : race.name;
  }
  const lineage = findLineage(race, character.lineageId);
  if (!lineage) return race.name;
  return `${lineage.name} ${race.name}`;
}

function classLabel(character) {
  if (character.classId === "custom") return character.customClass || "Custom class";
  return findClass(character.classId)?.name || "";
}

function subclassLabel(character) {
  if (!character.classId) return "";
  if (character.subclassId === "custom") return character.customSubclass || "Custom subclass";
  const klass = findClass(character.classId);
  return klass?.subclasses.find((sub) => sub.id === character.subclassId)?.name || "";
}

function backgroundLabel(character) {
  if (character.backgroundId === "custom") return character.customBackground || "Custom background";
  return findBackground(character.backgroundId)?.name || "";
}

function alignmentLabel(character) {
  if (!character.alignment) return "";
  if (character.alignment === "custom") return character.customAlignment || "Custom alignment";
  return ALIGNMENTS.find(([id]) => id === character.alignment)?.[1] || "";
}

export function sheetTitle(character) {
  const sub = subclassLabel(character);
  const klass = classLabel(character);
  const classBit = sub && klass ? `${sub} ${klass}` : (sub || klass);
  return [character.name, raceLabel(character), classBit].filter(Boolean).join(" · ");
}

export function skillHint(character) {
  const info = classInfo(character);
  if (!info) return "Choose a class and the usual skill list lights up. You can still tick any skill.";
  const chosen = character.skills.length;
  const offer = info.skills
    ? info.skills.map((id) => findSkill(id).label).join(", ")
    : "any skill";
  return `${info.name} usually chooses ${info.skillCount} from ${offer}. ${chosen} chosen.`;
}

export function offeredSkillIds(character) {
  const info = classInfo(character);
  if (!info) return [];
  if (!info.skills) return SKILLS.map((skill) => skill.id);
  return info.skills;
}

export function addBackgroundSkills(character) {
  const background = findBackground(character.backgroundId);
  if (!background) return character.skills;
  const skills = [...character.skills];
  for (const id of background.skills) {
    if (!skills.includes(id)) skills.push(id);
  }
  return skills;
}

export function skillBonus(character, skillId) {
  const skill = findSkill(skillId);
  if (!skill) return 0;
  const clean = cleanCharacter(character);
  const mod = abilityMod(abilityTotals(clean)[skill.ability]);
  const proficient = addBackgroundSkills(clean).includes(skillId);
  return mod + (proficient ? proficiencyBonus(clean.level) : 0);
}

/**
 * The bonus for a roll the DM asked for by name: a skill ("Perception"),
 * an ability check or save ("Dexterity save"), or "Initiative".
 * Returns null when the name is not one Lantern knows.
 */
export function askBonus(character, ask) {
  const name = String(ask || "").trim().toLowerCase();
  if (!name) return null;
  const clean = cleanCharacter(character);
  const skill = SKILLS.find((item) => item.label.toLowerCase() === name || item.id === name);
  if (skill) return { label: skill.label, bonus: skillBonus(clean, skill.id), skillId: skill.id };
  const totals = abilityTotals(clean);
  if (name === "initiative") return { label: "Initiative", bonus: abilityMod(totals.dex) };
  const match = name.match(/^(\w+)\s+(check|save|saving throw)$/);
  if (!match) return null;
  const ability = ABILITIES.find((item) => item.label.toLowerCase() === match[1] || item.id === match[1] || item.short.toLowerCase() === match[1]);
  if (!ability) return null;
  const mod = abilityMod(totals[ability.id]);
  if (match[2] === "check") return { label: `${ability.label} check`, bonus: mod };
  const saves = classInfo(clean)?.saves || [];
  const proficient = saves.includes(ability.id);
  return { label: `${ability.label} save`, bonus: mod + (proficient ? proficiencyBonus(clean.level) : 0) };
}

export function passiveScore(character, skillId) {
  return 10 + skillBonus(character, skillId);
}

export function presentCharacter(input) {
  const character = cleanCharacter(input);
  if (!character.touched) return null;
  const totals = abilityTotals(character);
  const info = classInfo(character);
  const race = findRace(character.raceId);
  const lineage = findLineage(race, character.lineageId);
  const hp = effectiveHp(character);
  const suggested = suggestedHp(character);
  const speed = character.raceId === "custom" ? character.customSpeed : race?.speed;
  const size = character.raceId === "custom" ? character.customSize : race?.size;
  const languages = character.raceId === "custom" ? character.customLanguages : race?.languages;
  const meta = [
    `Level ${character.level}`,
    backgroundLabel(character),
    alignmentLabel(character),
    `proficiency ${formatMod(proficiencyBonus(character.level))}`,
    speed != null && speed !== "" ? `${speed} ft` : "",
    size || "",
    darkvisionRange(character) ? `darkvision ${darkvisionRange(character)} ft` : "",
    lineage?.damage ? `${lineage.damage} breath` : "",
  ].filter(Boolean);
  const saves = (info?.saves || [])
    .map((id) => findAbility(id)?.label)
    .filter(Boolean);
  return {
    title: sheetTitle(character) || "Unnamed hero",
    meta: meta.join(" · "),
    abilities: ABILITIES.map((ability) => {
      const total = totals[ability.id];
      return `${ability.short} ${total} (${formatMod(abilityMod(total))})`;
    }).join(" · "),
    saves: saves.length ? saves.join(" and ") : "",
    hp: hp == null ? "" : character.hp == null ? `${hp} hit points, from the hit die` : `${hp} hit points`,
    suggested,
    skills: character.skills.map((id) => findSkill(id)?.label).filter(Boolean).join(", "),
    languages: languages || "",
    traits: character.traits.trim(),
    hitDie: info ? `d${info.hitDie}` : "",
    coin: character.purse == null ? "" : formatCoin(character.purse),
    carried: character.items.map((item) => (item.qty > 1 ? `${item.name} × ${item.qty}` : item.name)).join(", "),
    spells: character.spells.map((spell) => `${spell.name} (slot ${spell.slot}${spell.used ? ", used" : ""})`).join(", "),
    inspiration: character.inspiration === true,
  };
}

export function choiceSummary(character) {
  const title = sheetTitle(character);
  const background = backgroundLabel(character);
  const level = `level ${character.level}`;
  return ["Character", title || "an unnamed hero", background, level].filter(Boolean).join(", ") + ".";
}
