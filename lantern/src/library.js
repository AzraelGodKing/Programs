// Lantern's own formats for monsters, spells, magic items, and characters read
// from a PDF or a Lantern file, and the readers that turn PDF text into them.
// Nothing here touches the page, so the readers can be tested in Node.

import { ABILITY_IDS, CLASSES, RACES, BACKGROUNDS, ALIGNMENTS, cleanCharacter, racialBonuses } from "./character.js";
import { BASE_LIST } from "./catalog.js";
import { CR_XP } from "./encounter.js";

export const LIBRARY_VERSION = 1;
export const MONSTER_CAP = 200;
export const SPELL_CAP = 400;
export const ITEM_CAP = 200;

const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const SCHOOLS = ["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"];
const RARITIES = ["common", "uncommon", "rare", "very rare", "legendary", "artifact", "rarity varies"];

function text(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function body(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

function int(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function makeId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function idOf(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : makeId();
}

function cleanEntries(list, cap = 30) {
  return (Array.isArray(list) ? list : [])
    .map((entry) => (entry && typeof entry === "object" ? { name: text(entry.name, 80), text: body(entry.text, 1500) } : null))
    .filter((entry) => entry && (entry.name || entry.text))
    .slice(0, cap);
}

// --- Formats -----------------------------------------------------------------

export function crXp(cr) {
  const key = String(cr || "").trim();
  const row = CR_XP.find(([value]) => value === key);
  return row ? row[1] : null;
}

export function cleanMonster(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = text(raw.name, 80);
  if (!name) return null;
  const scores = {};
  const source = raw.scores && typeof raw.scores === "object" ? raw.scores : {};
  for (const id of ABILITY_IDS) scores[id] = int(source[id], 10, 1, 30);
  const cr = text(raw.cr, 6);
  return {
    id: idOf(raw.id),
    name,
    size: SIZES.includes(raw.size) ? raw.size : "Medium",
    type: text(raw.type, 60),
    alignment: text(raw.alignment, 40),
    ac: int(raw.ac, 10, 0, 40),
    acNote: text(raw.acNote, 80),
    hp: int(raw.hp, 1, 1, 9999),
    hpDice: text(raw.hpDice, 30),
    speed: text(raw.speed, 120),
    scores,
    saves: text(raw.saves, 200),
    skills: text(raw.skills, 200),
    resist: text(raw.resist, 300),
    senses: text(raw.senses, 200),
    languages: text(raw.languages, 200),
    cr,
    xp: int(raw.xp, crXp(cr) ?? 0, 0, 1_000_000),
    traits: cleanEntries(raw.traits),
    actions: cleanEntries(raw.actions),
    reactions: cleanEntries(raw.reactions, 10),
    legendary: cleanEntries(raw.legendary, 10),
  };
}

export function cleanSpell(raw, max = 4000) {
  if (!raw || typeof raw !== "object") return null;
  const name = text(raw.name, 80);
  if (!name) return null;
  return {
    id: idOf(raw.id),
    name,
    level: int(raw.level, 0, 0, 9),
    school: SCHOOLS.includes(String(raw.school || "").toLowerCase()) ? String(raw.school).toLowerCase() : "",
    ritual: raw.ritual === true,
    castingTime: text(raw.castingTime, 60),
    range: text(raw.range, 60),
    components: text(raw.components, 200),
    duration: text(raw.duration, 60),
    concentration: raw.concentration === true || /concentration/i.test(String(raw.duration || "")),
    text: body(raw.text, max),
  };
}

export function cleanItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = text(raw.name, 60);
  if (!name) return null;
  return {
    id: idOf(raw.id),
    name,
    kind: text(raw.kind, 40),
    rarity: RARITIES.includes(String(raw.rarity || "").toLowerCase()) ? String(raw.rarity).toLowerCase() : "",
    attune: raw.attune === true,
    weight: int(raw.weight, 0, 0, 500),
    text: body(raw.text, 2000),
  };
}

export function blankLibrary() {
  return { monsters: [], spells: [], items: [] };
}

export function cleanLibrary(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const list = (value, clean, cap) => (Array.isArray(value) ? value : []).map((item) => clean(item)).filter(Boolean).slice(0, cap);
  return {
    monsters: list(src.monsters, cleanMonster, MONSTER_CAP),
    spells: list(src.spells, cleanSpell, SPELL_CAP),
    items: list(src.items, cleanItem, ITEM_CAP),
  };
}

/** Adds new entries, replacing any with the same name. */
export function mergeLibrary(library, incoming) {
  const base = cleanLibrary(library);
  const add = cleanLibrary(incoming);
  const merge = (left, right, cap) => {
    const byName = new Map(left.map((item) => [item.name.toLowerCase(), item]));
    for (const item of right) byName.set(item.name.toLowerCase(), { ...item, id: byName.get(item.name.toLowerCase())?.id || item.id });
    return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name)).slice(0, cap);
  };
  return {
    monsters: merge(base.monsters, add.monsters, MONSTER_CAP),
    spells: merge(base.spells, add.spells, SPELL_CAP),
    items: merge(base.items, add.items, ITEM_CAP),
  };
}

export function exportLibrary(library, now = new Date()) {
  return { lantern: LIBRARY_VERSION, kind: "library", savedAt: now.toISOString(), ...cleanLibrary(library) };
}

/** Reads a Lantern library file, or a single monster, spell, or item file. */
export function readLibraryFile(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("That file is not a Lantern library.");
  if (data.kind === "library") return cleanLibrary(data);
  if (data.kind === "monster") return cleanLibrary({ monsters: [data.monster] });
  if (data.kind === "spells") return cleanLibrary({ spells: data.spells });
  if (data.kind === "items") return cleanLibrary({ items: data.items });
  if (data.kind === "character") throw new Error("That is a character. Import it on the player seat.");
  throw new Error("That file is not a Lantern library.");
}

// --- Turning PDF text into lines ---------------------------------------------

/**
 * Groups pdf.js text items into reading lines. Two-column pages are read left
 * column first. Items are { str, x, y, width } with y growing up the page.
 */
export function itemsToLines(items, pageWidth) {
  const usable = items.filter((item) => item.str && item.str.trim());
  if (!usable.length) return [];
  const mid = pageWidth / 2;
  const left = usable.filter((item) => item.x + item.width <= mid + 4);
  const right = usable.filter((item) => item.x >= mid - 4);
  const crossing = usable.length - left.length - right.length;
  const columns = left.length > usable.length * 0.25 && right.length > usable.length * 0.25 && crossing < usable.length * 0.08
    ? [left, right, usable.filter((item) => !left.includes(item) && !right.includes(item))]
    : [usable];
  const lines = [];
  for (const column of columns) {
    const rows = [];
    for (const item of [...column].sort((a, b) => b.y - a.y || a.x - b.x)) {
      const row = rows.find((entry) => Math.abs(entry.y - item.y) < 3);
      if (row) row.items.push(item);
      else rows.push({ y: item.y, items: [item] });
    }
    for (const row of rows) {
      const parts = row.items.sort((a, b) => a.x - b.x);
      let line = "";
      let end = null;
      for (const part of parts) {
        if (end !== null && part.x - end > 1.5 && !line.endsWith(" ") && !part.str.startsWith(" ")) line += " ";
        line += part.str;
        end = part.x + part.width;
      }
      const clean = line.replace(/\s+/g, " ").trim();
      if (clean) lines.push(clean);
    }
  }
  return lines;
}

function normalizeDashes(value) {
  return value.replace(/[‐-―−]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

/** A line that starts a named entry, like "Nimble Escape. The goblin..." */
const ENTRY = /^([A-Z][A-Za-z0-9'’ ,/+-]{1,60}(?:\s*\([^)]{1,40}\))?)\.\s+(.+)$/;

function collectEntries(lines) {
  const entries = [];
  for (const line of lines) {
    const match = line.match(ENTRY);
    if (match && !/^(Melee|Ranged|Hit|Each|The|If|On|A|An|It|This|When|While)\b/.test(match[1])) entries.push({ name: match[1].trim(), text: match[2].trim() });
    else if (entries.length) entries[entries.length - 1].text += ` ${line}`;
    else entries.push({ name: "", text: line });
  }
  return entries.map((entry) => ({ name: entry.name, text: entry.text.replace(/\s+/g, " ").replace(/(\w)- (\w)/g, "$1$2").trim() }));
}

// --- Monsters ----------------------------------------------------------------

const SIZE_LINE = new RegExp(`^(${SIZES.join("|")})\\s+([^,]+?)(?:,\\s*(.+))?$`, "i");
const FIELD_STARTS = /^(Armor Class|Hit Points|Speed|STR\b|Saving Throws|Skills|Damage|Condition Immunities|Senses|Languages|Challenge|Proficiency Bonus)/i;

function scoreList(block) {
  const found = [];
  const head = block.match(/STR\s*DEX\s*CON\s*INT\s*WIS\s*CHA\s+([\s\S]{0,200})/i);
  if (head) {
    for (const match of head[1].matchAll(/(\d{1,2})\s*\(\s*[+-]?\s*\d{1,2}\s*\)/g)) {
      found.push(Number(match[1]));
      if (found.length === 6) break;
    }
  }
  if (found.length === 6) return found;
  const each = ["STR", "DEX", "CON", "INT", "WIS", "CHA"].map((label) => {
    const match = block.match(new RegExp(`\\b${label}\\b\\s*(\\d{1,2})`, "i"));
    return match ? Number(match[1]) : null;
  });
  return each.every((value) => value !== null) ? each : null;
}

function grab(block, label) {
  const match = block.match(new RegExp(`(?:^|\\n)${label}\\s*:?\\s+([^\\n]+)`, "i"));
  return match ? match[1].trim() : "";
}

function parseMonsterBlock(lines) {
  const sizeIndex = lines.findIndex((line) => SIZE_LINE.test(line));
  if (sizeIndex < 0) return null;
  const name = lines.slice(0, sizeIndex).join(" ").trim();
  const size = lines[sizeIndex].match(SIZE_LINE);
  const blockText = lines.join("\n");
  const ac = blockText.match(/Armor Class\s*:?\s*(\d{1,2})(?:\s*\(([^)]*)\))?/i);
  const hp = blockText.match(/Hit Points\s*:?\s*(\d{1,4})(?:\s*\(([^)]*)\))?/i);
  if (!name || !ac || !hp) return null;
  const scores = scoreList(blockText);
  const challenge = blockText.match(/Challenge\s*:?\s*([\d/]+)(?:\s*\(([\d,]+)\s*XP\))?/i);
  const damage = ["Damage Vulnerabilities", "Damage Resistances", "Damage Immunities", "Condition Immunities"]
    .map((label) => {
      const value = grab(blockText, label);
      return value ? `${label}: ${value}` : "";
    })
    .filter(Boolean)
    .join("; ");
  // Everything after the last field line is traits, then actions, reactions, and legendary actions.
  let start = sizeIndex + 1;
  for (let index = sizeIndex + 1; index < lines.length; index += 1) {
    if (FIELD_STARTS.test(lines[index]) || /^\d{1,2}\s*\(/.test(lines[index])) start = index + 1;
    if (/^Actions$/i.test(lines[index])) break;
  }
  const sections = { traits: [], actions: [], reactions: [], legendary: [] };
  let current = "traits";
  for (const line of lines.slice(start)) {
    if (/^(Actions|Bonus Actions)$/i.test(line)) current = "actions";
    else if (/^Reactions$/i.test(line)) current = "reactions";
    else if (/^Legendary Actions$/i.test(line)) current = "legendary";
    else sections[current].push(line);
  }
  const cr = challenge ? challenge[1] : "";
  return cleanMonster({
    name,
    size: SIZES.find((item) => item.toLowerCase() === size[1].toLowerCase()),
    type: size[2],
    alignment: size[3] || "",
    ac: Number(ac[1]),
    acNote: ac[2] || "",
    hp: Number(hp[1]),
    hpDice: hp[2] || "",
    speed: grab(blockText, "Speed"),
    scores: scores ? Object.fromEntries(ABILITY_IDS.map((id, index) => [id, scores[index]])) : {},
    saves: grab(blockText, "Saving Throws"),
    skills: grab(blockText, "Skills"),
    resist: damage,
    senses: grab(blockText, "Senses"),
    languages: grab(blockText, "Languages"),
    cr,
    xp: challenge?.[2] ? Number(challenge[2].replace(/,/g, "")) : crXp(cr) ?? 0,
    traits: collectEntries(sections.traits),
    actions: collectEntries(sections.actions),
    reactions: collectEntries(sections.reactions),
    legendary: collectEntries(sections.legendary).filter((entry) => entry.name),
  });
}

/** Finds every stat block in the text. A block starts at its name, the line before "Medium humanoid, ...". */
export function parseMonsters(rawLines) {
  const lines = rawLines.map(normalizeDashes).map((line) => line.trim()).filter(Boolean);
  const starts = [];
  lines.forEach((line, index) => {
    if (!SIZE_LINE.test(line) || index === 0) return;
    const ahead = lines.slice(index, index + 6).join("\n");
    if (/Armor Class/i.test(ahead)) starts.push(index - 1);
  });
  return starts
    .map((start, index) => parseMonsterBlock(lines.slice(start, index + 1 < starts.length ? starts[index + 1] : lines.length)))
    .filter(Boolean);
}

// --- Spells ------------------------------------------------------------------

const SPELL_LEVEL = /^(\d)(?:st|nd|rd|th)[- ]level\s+(\w+)(\s*\(ritual\))?$/i;
const CANTRIP = /^(\w+)\s+cantrip$/i;

export function parseSpells(rawLines, max = 4000) {
  const lines = rawLines.map(normalizeDashes).map((line) => line.trim()).filter(Boolean);
  const heads = [];
  lines.forEach((line, index) => {
    if (index > 0 && (SPELL_LEVEL.test(line) || CANTRIP.test(line))) heads.push(index);
  });
  return heads.map((head, index) => {
    const end = index + 1 < heads.length ? heads[index + 1] - 1 : lines.length;
    const name = lines[head - 1];
    const level = lines[head].match(SPELL_LEVEL);
    const cantrip = lines[head].match(CANTRIP);
    const rest = lines.slice(head + 1, end);
    const fields = {};
    const prose = [];
    for (const line of rest) {
      const field = line.match(/^(Casting Time|Range|Components|Duration)\s*:?\s*(.+)$/i);
      if (field && !prose.length) fields[field[1].toLowerCase()] = field[2];
      else if (Object.keys(fields).length && !prose.length && fields.components && !fields.duration) fields.components += ` ${line}`;
      else prose.push(line);
    }
    return cleanSpell({
      name,
      level: level ? Number(level[1]) : 0,
      school: level ? level[2] : cantrip[1],
      ritual: Boolean(level?.[3]),
      castingTime: fields["casting time"] || "",
      range: fields.range || "",
      components: fields.components || "",
      duration: fields.duration || "",
      text: prose.join(" ").replace(/(\w)- (\w)/g, "$1$2").replace(/\s+(At Higher Levels\.)/, "\n\n$1"),
    }, max);
  }).filter(Boolean);
}

// --- Magic items -------------------------------------------------------------

const ITEM_LINE = new RegExp(`^(Armor|Potion|Ring|Rod|Scroll|Staff|Wand|Weapon|Wondrous item)\\b([^,]*),\\s*(${RARITIES.join("|")})(.*)$`, "i");

export function parseItems(rawLines) {
  const lines = rawLines.map(normalizeDashes).map((line) => line.trim()).filter(Boolean);
  const heads = [];
  lines.forEach((line, index) => {
    if (index > 0 && ITEM_LINE.test(line)) heads.push(index);
  });
  return heads.map((head, index) => {
    const end = index + 1 < heads.length ? heads[index + 1] - 1 : lines.length;
    const match = lines[head].match(ITEM_LINE);
    return cleanItem({
      name: lines[head - 1],
      kind: `${match[1]}${match[2]}`.trim(),
      rarity: match[3].toLowerCase(),
      attune: /requires attunement/i.test(match[4]),
      text: lines.slice(head + 1, end).join(" ").replace(/(\w)- (\w)/g, "$1$2"),
    });
  }).filter(Boolean);
}

// --- Characters --------------------------------------------------------------

function keyOf(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findByName(list, value, label = "name") {
  const wanted = String(value || "").toLowerCase();
  if (!wanted) return null;
  return [...list].sort((a, b) => String(b[label]).length - String(a[label]).length)
    .find((item) => wanted.includes(String(item[label]).toLowerCase())) || null;
}

const GEAR = BASE_LIST.flatMap((group) => group.items);

/** Matches "Longsword, 2 daggers, explorer's pack" to catalog items. The rest stays as text. */
export function matchGear(textValue) {
  const items = [];
  const rest = [];
  for (const raw of String(textValue || "").split(/[\n,;]+/)) {
    const piece = raw.trim();
    if (!piece) continue;
    const count = piece.match(/^(\d{1,2})\s*x?\s+(.+)$/i) || piece.match(/^(.+?)\s*[x×]\s*(\d{1,2})$/i);
    let qty = 1;
    let name = piece;
    if (count) {
      if (/^\d/.test(count[1])) {
        qty = Number(count[1]);
        name = count[2];
      } else {
        name = count[1];
        qty = Number(count[2]);
      }
    }
    const said = name.toLowerCase().replace(/^(a|an|the)\s+/, "").trim();
    const forms = new Set([said, said.replace(/es$/, ""), said.replace(/s$/, "")]);
    const gear = GEAR.find((item) => {
      const label = item.name.toLowerCase().replace(/\s*\(.*\)$/, "");
      return forms.has(label) || forms.has(label.replace(/s$/, ""));
    });
    if (gear) {
      const found = items.find((item) => item.id === gear.id);
      if (found) found.qty = Math.min(99, found.qty + qty);
      else items.push({ id: gear.id, qty: Math.min(99, qty) });
    } else rest.push(piece);
  }
  return { items, rest };
}

function scoresFrom(get) {
  const scores = {};
  for (const id of ABILITY_IDS) {
    const value = Number(String(get(id) || "").match(/\d{1,2}/)?.[0]);
    if (Number.isInteger(value) && value >= 1 && value <= 30) scores[id] = value;
  }
  return scores;
}

function buildCharacter(found) {
  const race = findByName(RACES, found.race);
  const klass = findByName(CLASSES, found.classLevel);
  const background = findByName(BACKGROUNDS, found.background);
  const alignmentText = String(found.alignment || "").toLowerCase();
  const alignment = ALIGNMENTS.find(([, label]) => label.toLowerCase() === alignmentText)?.[0] || "";
  const level = Number(String(found.classLevel || "").match(/\b(\d{1,2})\b/)?.[1]) || Number(found.level) || 1;
  const gear = matchGear(found.equipment);
  let sheet = cleanCharacter({
    touched: true,
    name: found.name || "",
    raceId: race ? race.id : found.race ? "custom" : "",
    lineageId: race?.lineages?.find((lineage) => String(found.race).toLowerCase().includes(lineage.name.toLowerCase()))?.id || "",
    customRace: race ? "" : text(found.race, 40),
    classId: klass ? klass.id : found.classLevel ? "custom" : "",
    customClass: klass ? "" : text(String(found.classLevel || "").replace(/\d+/g, ""), 40),
    subclassId: "",
    backgroundId: background ? background.id : found.background ? "custom" : "",
    customBackground: background ? "" : text(found.background, 40),
    alignment: alignment || (found.alignment ? "custom" : ""),
    customAlignment: alignment ? "" : text(found.alignment, 40),
    level,
    method: "manual",
    scores: { ...{ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, ...found.scores },
    maxHp: found.hp || null,
    hp: found.hp || null,
    acOverride: found.ac || null,
    items: gear.items,
    purse: found.purse ?? null,
    kitId: "imported",
    traits: [found.traits, gear.rest.length ? `Also carried: ${gear.rest.join(", ")}` : ""].filter(Boolean).join("\n").slice(0, 1000),
  });
  // The sheet's scores already include the people bonus. Take it back out so Lantern does not add it twice.
  const bonus = racialBonuses(sheet);
  const scores = { ...sheet.scores };
  for (const id of ABILITY_IDS) if (found.scores[id]) scores[id] = Math.max(1, found.scores[id] - (bonus[id] || 0));
  sheet = cleanCharacter({ ...sheet, scores });
  const spells = (found.spells || []).map((name) => cleanSpell({ name }, 800)).filter(Boolean).slice(0, 40);
  if (spells.length) sheet = cleanCharacter({ ...sheet, extras: { ...sheet.extras, spellbook: spells } });
  return sheet;
}

function coinTotal(get) {
  const rates = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
  let total = 0;
  let any = false;
  for (const [coin, rate] of Object.entries(rates)) {
    const value = Number(String(get(coin) || "").replace(/[^\d]/g, ""));
    if (Number.isInteger(value) && value > 0) {
      total += value * rate;
      any = true;
    }
  }
  return any ? total : null;
}

/** Reads the fields of a fillable 5e character sheet. Field names follow the common official sheet. */
export function parseCharacterFields(fields) {
  const map = new Map(Object.entries(fields || {}).map(([key, value]) => [keyOf(key), String(value ?? "").trim()]));
  const get = (...keys) => {
    for (const key of keys) {
      const value = map.get(keyOf(key));
      if (value) return value;
    }
    return "";
  };
  if (!get("CharacterName", "CharacterName 2", "Name")) return null;
  const spells = [...map.entries()]
    .filter(([key, value]) => /^spells\d+/.test(key) && value && !/^\d+$/.test(value))
    .map(([, value]) => value);
  return buildCharacter({
    name: get("CharacterName", "CharacterName 2", "Name"),
    classLevel: get("ClassLevel", "Class & Level", "Class"),
    race: get("Race", "Race ", "Species"),
    background: get("Background"),
    alignment: get("Alignment"),
    scores: scoresFrom((id) => get(id, `${id}score`)),
    hp: int(get("HPMax", "HP Max", "Hit Point Maximum"), 0, 0, 999) || null,
    ac: int(get("AC", "Armor Class"), 0, 0, 40) || null,
    equipment: get("Equipment"),
    purse: coinTotal((coin) => get(coin)),
    traits: [get("Features and Traits", "FeaturesTraits", "Features"), get("PersonalityTraits", "PersonalityTraits ")].filter(Boolean).join("\n"),
    spells,
  });
}

/** Reads a printed or flattened sheet from its text. Rougher than the form fields. */
export function parseCharacterText(rawLines) {
  const lines = rawLines.map(normalizeDashes).map((line) => line.trim()).filter(Boolean);
  const all = lines.join("\n");
  const after = (label) => {
    const index = lines.findIndex((line) => new RegExp(`^${label}\\b`, "i").test(line));
    if (index < 0) return "";
    const same = lines[index].replace(new RegExp(`^${label}\\s*:?\\s*`, "i"), "").trim();
    return same || lines[index + 1] || "";
  };
  const scores = {};
  const words = { str: "strength", dex: "dexterity", con: "constitution", int: "intelligence", wis: "wisdom", cha: "charisma" };
  for (const id of ABILITY_IDS) {
    const match = all.match(new RegExp(`\\b(?:${words[id]}|${id})\\b\\s*:?\\s*(\\d{1,2})\\b`, "i"));
    if (match) scores[id] = Number(match[1]);
  }
  const name = after("Character Name") || after("Name");
  if (!name && !Object.keys(scores).length) return null;
  return buildCharacter({
    name,
    classLevel: after("Class & Level") || after("Class and Level") || after("Class"),
    race: after("Race") || after("Species"),
    background: after("Background"),
    alignment: after("Alignment"),
    scores,
    hp: int(all.match(/Hit Point Maximum\s*:?\s*(\d{1,3})/i)?.[1], 0, 0, 999) || null,
    ac: int(all.match(/Armou?r Class\s*:?\s*(\d{1,2})/i)?.[1], 0, 0, 40) || null,
    equipment: after("Equipment"),
    purse: null,
    traits: "",
    spells: [],
  });
}

/** Picks what a PDF holds: monsters, spells, items, or a character. */
export function readPdfContent({ lines = [], fields = {} }, want = "") {
  const out = { monsters: [], spells: [], items: [], character: null };
  if (!want || want === "character") out.character = parseCharacterFields(fields) || (want === "character" ? parseCharacterText(lines) : null);
  if (!want || want === "monsters") out.monsters = parseMonsters(lines);
  if (!want || want === "spells") out.spells = parseSpells(lines);
  if (!want || want === "items") out.items = parseItems(lines);
  return out;
}
