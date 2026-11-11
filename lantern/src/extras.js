// Player-side extras on a character: roll macros, temp hit points, spell slots,
// class resources, magic items and attunement, ammo, a portrait, and a feed color.
// Everything here is plain data so it saves with the night and shares with the DM.

import { STANDARD_SIDES } from "./dice.js";
import { findGear, formatCoin } from "./gear.js";
import { MARKS } from "./marks.js";

const SIDES = new Set(STANDARD_SIDES);
const RESETS = new Set(["short", "long"]);
export const MACRO_CAP = 12;
export const RESOURCE_CAP = 10;
export const TRINKET_CAP = 20;
export const ATTUNE_CAP = 3;
export const PORTRAIT_CHARS = 24_000;
export const COLORS = ["#e0a458", "#7fb069", "#6ca0dc", "#d1603d", "#b48ead", "#e5c07b", "#56b6c2", "#e06c9f"];

function int(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function text(value, max) {
  if (typeof value !== "string") return "";
  return value.split(/\s+/).filter(Boolean).join(" ").slice(0, max);
}

function idOf(value, fallback) {
  const id = typeof value === "string" ? value.trim().slice(0, 40) : "";
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : fallback;
}

/**
 * Reads "1d20+5", "d8 + 3", "2d6", "+5", or "-1". A bare modifier means a d20.
 * Returns { count, sides, modifier } or null.
 */
export function parseFormula(value) {
  const raw = String(value ?? "").replace(/\s+/g, "").toLowerCase();
  if (!raw) return null;
  const bare = raw.match(/^([+-]\d{1,3})$/);
  if (bare) {
    const modifier = Number(bare[1]);
    return modifier >= -100 && modifier <= 100 ? { count: 1, sides: 20, modifier } : null;
  }
  const match = raw.match(/^(\d{0,2})d(\d{1,3})([+-]\d{1,3})?$/);
  if (!match) return null;
  const count = match[1] ? Number(match[1]) : 1;
  const sides = Number(match[2]);
  const modifier = match[3] ? Number(match[3]) : 0;
  if (count < 1 || count > 40 || !SIDES.has(sides) || modifier < -100 || modifier > 100) return null;
  return { count, sides, modifier };
}

export function formulaText({ count, sides, modifier }) {
  const suffix = !modifier ? "" : modifier > 0 ? `+${modifier}` : `${modifier}`;
  return `${count}d${sides}${suffix}`;
}

/** A natural 20 doubles the damage dice, not the modifier. */
export function critDamage(damage) {
  if (!damage) return null;
  return { ...damage, count: Math.min(40, damage.count * 2) };
}

function cleanMacro(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const label = text(raw.label, 40);
  const hit = parseFormula(raw.hit);
  const damage = parseFormula(raw.damage);
  if (!label || (!hit && !damage)) return null;
  return {
    id: idOf(raw.id, `m${index}`),
    label,
    hit: hit ? formulaText(hit) : "",
    damage: damage ? formulaText(damage) : "",
    ammo: raw.ammo === true,
  };
}

function cleanResource(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const label = text(raw.label, 40);
  if (!label) return null;
  const max = int(raw.max, 1, 1, 100);
  return {
    id: idOf(raw.id, `r${index}`),
    label,
    max,
    used: int(raw.used, 0, 0, max),
    reset: RESETS.has(raw.reset) ? raw.reset : "long",
  };
}

function cleanTrinket(raw, index) {
  if (!raw || typeof raw !== "object") return null;
  const name = text(raw.name, 60);
  if (!name) return null;
  return {
    id: idOf(raw.id, `t${index}`),
    name,
    qty: int(raw.qty, 1, 1, 999),
    weight: int(raw.weight, 0, 0, 500),
    attune: raw.attune === true,
    attuned: raw.attune === true && raw.attuned === true,
    note: text(raw.note, 600),
    ...(typeof raw.key === "string" && /^[a-f0-9]{16}$/.test(raw.key) ? { key: raw.key } : {}),
    ...(raw.unknown === true ? { unknown: true } : {}),
  };
}

function cleanPortrait(value) {
  if (typeof value !== "string" || value.length > PORTRAIT_CHARS) return "";
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : "";
}

function cleanSlots(value) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: 9 }, (_, index) => {
    const raw = source[index] && typeof source[index] === "object" ? source[index] : {};
    const max = int(raw.max, 0, 0, 9);
    return { max, used: int(raw.used, 0, 0, max) };
  });
}

export const SPELLBOOK_CAP = 40;
const SCHOOLS = ["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"];

/** The spells a character knows, in the same shape as a library spell, with shorter text. */
function cleanBook(value) {
  const seen = new Set();
  const book = [];
  for (const raw of Array.isArray(value) ? value : []) {
    if (!raw || typeof raw !== "object") continue;
    const name = text(raw.name, 80);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    book.push({
      id: idOf(raw.id, `s${book.length}`),
      name,
      level: int(raw.level, 0, 0, 9),
      school: SCHOOLS.includes(raw.school) ? raw.school : "",
      ritual: raw.ritual === true,
      castingTime: text(raw.castingTime, 60),
      range: text(raw.range, 60),
      components: text(raw.components, 120),
      duration: text(raw.duration, 60),
      concentration: raw.concentration === true,
      text: typeof raw.text === "string" ? raw.text.trim().slice(0, 800) : "",
    });
    if (book.length === SPELLBOOK_CAP) break;
  }
  return book;
}

export function blankExtras() {
  return {
    macros: [],
    color: "",
    tempHp: 0,
    slots: cleanSlots([]),
    resources: [],
    trinkets: [],
    ammoId: "",
    portrait: "",
    levelSeen: 0,
    conditions: [],
    ammoLeft: 0,
    spellbook: [],
  };
}

export function cleanExtras(input) {
  const src = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const trinkets = (Array.isArray(src.trinkets) ? src.trinkets : []).map(cleanTrinket).filter(Boolean).slice(0, TRINKET_CAP);
  let attuned = 0;
  for (const item of trinkets) {
    if (!item.attuned) continue;
    attuned += 1;
    if (attuned > ATTUNE_CAP) item.attuned = false;
  }
  const seen = new Set();
  const unique = (list) => list.filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));
  return {
    macros: unique((Array.isArray(src.macros) ? src.macros : []).map(cleanMacro).filter(Boolean)).slice(0, MACRO_CAP),
    color: COLORS.includes(src.color) ? src.color : "",
    tempHp: int(src.tempHp, 0, 0, 999),
    slots: cleanSlots(src.slots),
    resources: unique((Array.isArray(src.resources) ? src.resources : []).map(cleanResource).filter(Boolean)).slice(0, RESOURCE_CAP),
    trinkets: unique(trinkets),
    ammoId: typeof src.ammoId === "string" && findGear(src.ammoId) ? src.ammoId : "",
    portrait: cleanPortrait(src.portrait),
    levelSeen: int(src.levelSeen, 0, 0, 20),
    conditions: [...new Set((Array.isArray(src.conditions) ? src.conditions : []).filter((mark) => MARKS.includes(mark)))],
    ammoLeft: int(src.ammoLeft, 0, 0, 9999),
    spellbook: cleanBook(src.spellbook),
    xp: int(src.xp, 0, 0, 400000),
    milestone: src.milestone === true,
  };
}

/** 2014 experience thresholds: the XP each level starts at. */
export const XP_LEVELS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];

/** The level that much experience reaches. */
export function levelForXp(xp) {
  let level = 1;
  for (let index = 0; index < XP_LEVELS.length; index += 1) if (xp >= XP_LEVELS[index]) level = index + 1;
  return level;
}

/**
 * Applies a reward from the DM to a character. Returns the new character
 * and a line that says what happened, or null when the gift is not understood.
 */
export function applyGift(character, gift) {
  const next = structuredClone(character);
  const ex = cleanExtras(next.extras);
  let line = "";
  if (gift.kind === "coin") {
    next.purse = Math.min(100_000_000, (next.purse || 0) + gift.cp);
    line = formatCoin(gift.cp);
  } else if (gift.kind === "inspiration") {
    next.inspiration = true;
    line = "inspiration";
  } else if (gift.kind === "xp") {
    if (gift.xp) ex.xp = Math.min(400000, ex.xp + gift.xp);
    if (gift.milestone) ex.milestone = true;
    line = gift.milestone ? "a milestone" : `${gift.xp} XP`;
  } else if (gift.kind === "item") {
    if (ex.trinkets.length >= TRINKET_CAP) return null;
    const unknown = Boolean(gift.shown);
    ex.trinkets.push({
      id: `g${gift.key}`,
      key: gift.key,
      name: unknown ? gift.shown : gift.name,
      qty: gift.qty || 1,
      attune: gift.attune === true,
      note: unknown ? "Not yet identified." : gift.text || "",
      ...(unknown ? { unknown: true } : {}),
    });
    line = unknown ? gift.shown : gift.name;
  } else if (gift.kind === "identify") {
    const found = ex.trinkets.find((item) => item.key === gift.key);
    if (!found) return null;
    found.name = gift.name;
    found.note = gift.text || "";
    delete found.unknown;
    line = `what ${gift.name} really is`;
  } else return null;
  next.extras = cleanExtras(ex);
  return { character: next, line };
}

export function attunedCount(extras) {
  return (extras?.trinkets || []).filter((item) => item.attuned).length;
}

/** Toggles attunement on one magic item. Returns null when three are already attuned. */
export function toggleAttune(extras, id) {
  const clean = cleanExtras(extras);
  const item = clean.trinkets.find((entry) => entry.id === id);
  if (!item || !item.attune) return null;
  if (!item.attuned && attunedCount(clean) >= ATTUNE_CAP) return null;
  item.attuned = !item.attuned;
  return clean;
}

/** Damage goes through temporary hit points first. */
export function applyDamage({ hp, tempHp }, amount) {
  const hit = Math.max(0, Math.floor(amount));
  const soaked = Math.min(tempHp, hit);
  return { hp: Math.max(0, hp - (hit - soaked)), tempHp: tempHp - soaked, taken: hit };
}

export function applyHealing({ hp, max }, amount) {
  return Math.min(max, Math.max(0, hp) + Math.max(0, Math.floor(amount)));
}

/** Temporary hit points do not stack. The bigger number stays. */
export function applyTemp(tempHp, amount) {
  return Math.max(tempHp, Math.max(0, Math.min(999, Math.floor(amount))));
}

/** The Constitution save DC to keep concentration after taking damage. */
export function concentrationDc(damage) {
  return Math.max(10, Math.floor(Math.max(0, damage) / 2));
}

// Spell slots by class level for full, half, and pact casters (2014 tables).
const FULL = [
  [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2],
  [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1], [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1],
  [4, 3, 3, 3, 3, 2, 2, 1, 1],
];
const HALF = [
  [], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1],
  [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
];
const PACT_COUNT = [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4];
const PACT_LEVEL = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];

export function classSlots(classId, level) {
  const lvl = int(level, 1, 1, 20);
  let row = [];
  if (["bard", "cleric", "druid", "sorcerer", "wizard"].includes(classId)) row = FULL[lvl - 1];
  else if (["paladin", "ranger"].includes(classId)) row = HALF[lvl - 1];
  else if (classId === "warlock") {
    row = Array.from({ length: PACT_LEVEL[lvl - 1] }, (_, index) => (index === PACT_LEVEL[lvl - 1] - 1 ? PACT_COUNT[lvl - 1] : 0));
  }
  return Array.from({ length: 9 }, (_, index) => ({ max: row[index] || 0, used: 0 }));
}

function byLevel(level, steps) {
  let value = 0;
  for (const [from, amount] of steps) if (level >= from) value = amount;
  return value;
}

/** The class features players most often tick off at the table. */
export function classResources(classId, level, chaMod = 0) {
  const lvl = int(level, 1, 1, 20);
  const list = [];
  const add = (id, label, max, reset) => { if (max > 0) list.push({ id, label, max, used: 0, reset }); };
  switch (classId) {
    case "barbarian":
      add("rage", "Rage", lvl >= 20 ? 100 : byLevel(lvl, [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]]), "long");
      break;
    case "bard":
      add("bardic", "Bardic Inspiration", Math.max(1, chaMod), lvl >= 5 ? "short" : "long");
      break;
    case "cleric":
      add("channel", "Channel Divinity", byLevel(lvl, [[2, 1], [6, 2], [18, 3]]), "short");
      break;
    case "druid":
      add("wild-shape", "Wild Shape", lvl >= 2 ? 2 : 0, "short");
      break;
    case "fighter":
      add("second-wind", "Second Wind", 1, "short");
      add("action-surge", "Action Surge", byLevel(lvl, [[2, 1], [17, 2]]), "short");
      add("indomitable", "Indomitable", byLevel(lvl, [[9, 1], [13, 2], [17, 3]]), "long");
      break;
    case "monk":
      add("ki", "Ki", lvl >= 2 ? lvl : 0, "short");
      break;
    case "paladin":
      add("lay-on-hands", "Lay on Hands", lvl * 5, "long");
      add("divine-sense", "Divine Sense", 1 + Math.max(0, chaMod), "long");
      add("channel", "Channel Divinity", lvl >= 3 ? 1 : 0, "short");
      break;
    case "sorcerer":
      add("sorcery", "Sorcery Points", lvl >= 2 ? lvl : 0, "long");
      break;
    case "wizard":
      add("arcane-recovery", "Arcane Recovery", 1, "long");
      break;
    default:
      break;
  }
  return list;
}

/** Spends or gives back one use. Returns the new extras. */
export function tickResource(extras, id, delta) {
  const clean = cleanExtras(extras);
  const item = clean.resources.find((entry) => entry.id === id);
  if (!item) return clean;
  item.used = Math.min(item.max, Math.max(0, item.used + delta));
  return clean;
}

export function tickSlot(extras, level, delta) {
  const clean = cleanExtras(extras);
  const slot = clean.slots[level - 1];
  if (!slot) return clean;
  slot.used = Math.min(slot.max, Math.max(0, slot.used + delta));
  return clean;
}

/** A short rest restores short-rest features. Warlock pact slots also come back on a short rest. */
export function restExtras(extras, kind, classId = "") {
  const clean = cleanExtras(extras);
  for (const item of clean.resources) {
    if (kind === "long" || item.reset === "short") item.used = 0;
  }
  if (kind === "long" || classId === "warlock") {
    for (const slot of clean.slots) slot.used = 0;
  }
  if (kind === "long") clean.tempHp = 0;
  return clean;
}

// Weights in pounds from the 2014 equipment tables. Mounts, vehicles, services, and trade goods are left out.
export const WEIGHTS = {
  club: 2, dagger: 1, greatclub: 10, handaxe: 2, javelin: 2, "light-hammer": 2, mace: 4, quarterstaff: 4, sickle: 2,
  spear: 3, "light-crossbow": 5, dart: 0.25, shortbow: 2, sling: 0, battleaxe: 4, flail: 2, glaive: 6, greataxe: 7,
  greatsword: 6, halberd: 6, lance: 6, longsword: 3, maul: 10, morningstar: 4, pike: 18, rapier: 2, scimitar: 3,
  shortsword: 2, trident: 4, "war-pick": 2, warhammer: 2, whip: 3, blowgun: 1, "hand-crossbow": 3, "heavy-crossbow": 18,
  longbow: 2, net: 3, padded: 8, leather: 10, "studded-leather": 13, hide: 12, "chain-shirt": 20, "scale-mail": 45,
  breastplate: 20, "half-plate": 40, "ring-mail": 40, "chain-mail": 55, splint: 60, "plate-armor": 65, shield: 6,
  arrows: 1, bolts: 1.5, "blowgun-needles": 1, "sling-bullets": 1.5, abacus: 2, acid: 1, "alchemists-fire": 1,
  antitoxin: 0, backpack: 5, "ball-bearings": 2, barrel: 70, basket: 2, bedroll: 7, bell: 0, blanket: 3,
  "block-and-tackle": 5, book: 5, bottle: 2, bucket: 2, caltrops: 2, candle: 0, "bolt-case": 1, "scroll-case": 1,
  chain: 10, chalk: 0, chest: 25, "climbers-kit": 12, clothes: 3, "clothes-costume": 4, "clothes-fine": 6,
  "clothes-travelers": 4, "component-pouch": 2, crowbar: 5, "fishing-tackle": 4, flask: 1, "grappling-hook": 4,
  hammer: 3, sledge: 10, "holy-water": 1, hourglass: 1, "hunting-trap": 25, ink: 0, "ink-pen": 0, jug: 4, ladder: 25,
  lamp: 1, "lantern-bullseye": 2, "lantern-hooded": 2, lock: 1, "magnifying-glass": 0, manacles: 6, "mess-kit": 1,
  mirror: 0.5, oil: 1, paper: 0, parchment: 0, perfume: 0, "miners-pick": 10, piton: 0.25, "poison-basic": 0,
  pole: 7, "iron-pot": 10, "potion-healing": 0.5, pouch: 1, quiver: 1, "portable-ram": 35, rations: 2, robes: 4,
  rope: 10, "rope-silk": 5, sack: 0.5, "merchants-scale": 3, "sealing-wax": 0, shovel: 5, "signal-whistle": 0,
  "signet-ring": 0, soap: 0, spellbook: 3, "iron-spikes": 5, spyglass: 1, tent: 20, tinderbox: 1, torch: 1, vial: 0,
  waterskin: 5, whetstone: 1, "holy-symbol": 1, amulet: 1, emblem: 0, reliquary: 2, "arcane-focus": 1, crystal: 1,
  orb: 3, rod: 2, "arcane-staff": 4, wand: 1, "druidic-focus": 1, mistletoe: 0, totem: 0, "wooden-staff": 4,
  "yew-wand": 1, "burglars-pack": 44.5, "diplomats-pack": 36, "dungeoneers-pack": 61.5, "entertainers-pack": 38,
  "explorers-pack": 59, "priests-pack": 24, "scholars-pack": 10, "alchemists-supplies": 8, "brewers-supplies": 9,
  "calligraphers-supplies": 5, "carpenters-tools": 6, "cartographers-tools": 6, "cobblers-tools": 5,
  "cooks-utensils": 8, "glassblowers-tools": 5, "jewelers-tools": 2, "leatherworkers-tools": 5, "masons-tools": 8,
  "painters-supplies": 5, "potters-tools": 3, "smiths-tools": 8, "tinkers-tools": 10, "weavers-tools": 5,
  "woodcarvers-tools": 5, "disguise-kit": 3, "forgery-kit": 5, "herbalism-kit": 3, "healers-kit": 3,
  "navigators-tools": 2, "poisoners-kit": 2, "thieves-tools": 1, "dice-set": 0, "playing-cards": 0, bagpipes: 6,
  drum: 3, dulcimer: 10, flute: 1, lute: 2, lyre: 2, horn: 2, "pan-flute": 2, shawm: 1, viol: 1,
};

export function carriedWeight(items, trinkets = []) {
  let total = 0;
  for (const item of items || []) total += (WEIGHTS[item.id] ?? 0) * (item.qty || 1);
  for (const item of trinkets || []) total += (item.weight || 0) * (item.qty || 1);
  return Math.round(total * 10) / 10;
}

/** Carrying capacity is Strength × 15 pounds. Past Strength × 5 the variant rule calls it encumbered. */
export function encumbrance(weight, strength) {
  const capacity = strength * 15;
  const level = weight > capacity ? "over" : weight > strength * 10 ? "heavy" : weight > strength * 5 ? "encumbered" : "light";
  return { weight, capacity, level };
}

export const AMMO_IDS = ["arrows", "bolts", "blowgun-needles", "sling-bullets"];

/** One piece of ammunition from a bundle. Bundles hold 20, needles 50. */
export function ammoPerBundle(id) {
  return id === "blowgun-needles" ? 50 : 20;
}

/** Healing rolled by a potion the pack knows. */
export function potionHealing(id) {
  return id === "potion-healing" ? { count: 2, sides: 4, modifier: 2 } : null;
}

/** Who gets what when coin is split evenly. The remainder stays with the one splitting. */
export function splitCoin(cp, people) {
  const n = Math.max(1, Math.floor(people));
  const each = Math.floor(Math.max(0, cp) / n);
  return { each, left: Math.max(0, cp) - each * n };
}

/** The steps a level brings. Spells only show for a class that casts. */
export function levelUpSteps(classId, level, hitDie) {
  const steps = [
    `Hit points: roll a d${hitDie} or take ${Math.floor(hitDie / 2) + 1}, then add your Constitution modifier.`,
    "Read the new class features for this level.",
  ];
  if ([4, 8, 12, 16, 19].includes(level)) steps.push("Ability Score Improvement: +2 to one score, +1 to two, or a feat.");
  if ([5, 9, 13, 17].includes(level)) steps.push("Your proficiency bonus goes up by one.");
  if (classSlots(classId, level).some((slot) => slot.max > 0)) steps.push("Check your spell slots and pick any new spells.");
  steps.push("Reset class resources that grew with the level.");
  return steps;
}

/** Keeps the loose ammunition count in step with the bundles in the pack. */
export function syncAmmo(left, bundles, per) {
  const most = Math.max(0, bundles) * per;
  let next = Math.min(left, most);
  const held = Math.ceil(next / per);
  if (held < bundles) next += (bundles - held) * per;
  return Math.min(next, most);
}
