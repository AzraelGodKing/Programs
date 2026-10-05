import { MARKS } from "./marks.js";
import { LIGHTS } from "./lights.js";
import { KINDS } from "./oracle.js";

export const KEY = "lantern.v1";

const TABS = ["dice", "order", "threat", "spark"];
const MODES = ["normal", "advantage", "disadvantage"];
const SIDES = new Set([4, 6, 8, 10, 12, 20, 100]);
const LIGHT_IDS = new Set(LIGHTS.map((light) => light.id));
const CARD_KINDS = new Set(KINDS);
const MIN_TS = Date.parse("2020-01-01T00:00:00Z");
const MAX_TS = Date.parse("2100-01-01T00:00:00Z");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function int(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function text(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function cleanHistory(item) {
  if (!item || typeof item !== "object") return null;
  if (typeof item.formula !== "string" || !Number.isFinite(Number(item.total))) return null;
  const tag = item.tag === "natural-20" || item.tag === "natural-1" ? item.tag : null;
  return {
    id: text(item.id, 80) || crypto.randomUUID(),
    formula: item.formula.slice(0, 80),
    total: Number(item.total),
    detail: text(item.detail, 240),
    tag,
  };
}

function cleanCombatant(item, index) {
  if (!item || typeof item !== "object") return null;
  const name = text(item.name, 80);
  if (!name) return null;
  const hp = int(item.hp, 1, 0, 9999);
  return {
    id: text(item.id, 80) || `c${index}`,
    name,
    init: int(item.init, 0, -100, 200),
    bonus: int(item.bonus, 0, -30, 30),
    die: item.die == null || item.die === "" ? null : int(item.die, null, 1, 20),
    hp,
    maxHp: int(item.maxHp, Math.max(hp, 1), 0, 9999),
    ac: item.ac == null || item.ac === "" ? null : int(item.ac, null, 0, 40),
    marks: asArray(item.marks).filter((mark) => MARKS.includes(mark)),
    order: int(item.order, index, 0, 100000),
  };
}

function cleanHero(item, index) {
  if (!item || typeof item !== "object") return null;
  return {
    id: text(item.id, 80) || `h${index}`,
    name: text(item.name, 80),
    level: int(item.level, 1, 1, 20),
  };
}

function cleanMonster(item, index) {
  if (!item || typeof item !== "object") return null;
  const name = text(item.name, 80);
  if (!name) return null;
  return {
    id: text(item.id, 80) || `m${index}`,
    name,
    count: int(item.count, 1, 1, 40),
    xp: int(item.xp, 0, 0, 2000000),
  };
}

function cleanLines(lines) {
  return asArray(lines)
    .filter((pair) => Array.isArray(pair) && pair.length >= 2)
    .slice(0, 8)
    .map((pair) => [text(pair[0], 40), text(pair[1], 400)])
    .filter((pair) => pair[0] && pair[1]);
}

function cleanCard(item) {
  if (!item || typeof item !== "object") return null;
  if (!CARD_KINDS.has(item.kind)) return null;
  const body = text(item.body, 1200);
  if (!body) return null;
  const card = {
    kind: item.kind,
    title: text(item.title, 80) || item.kind,
    body,
  };
  const lines = cleanLines(item.lines);
  if (lines.length) card.lines = lines;
  return card;
}

function cleanSpark(item, index) {
  if (!item || typeof item !== "object") return null;
  const id = text(item.id, 80) || `s${index}`;
  if (item.kind === "scene") {
    const cards = asArray(item.cards).map(cleanCard).filter(Boolean).slice(0, 5);
    if (!cards.length) return null;
    return { id, kind: "scene", title: "Scene", cards };
  }
  const card = cleanCard(item);
  if (!card) return null;
  return { id, ...card };
}

function cleanLight(item, index) {
  if (!item || typeof item !== "object") return null;
  if (!LIGHT_IDS.has(item.kind)) return null;
  const endsAt = Number(item.endsAt);
  if (!Number.isFinite(endsAt) || endsAt < MIN_TS || endsAt > MAX_TS) return null;
  return {
    id: text(item.id, 80) || `l${index}`,
    kind: item.kind,
    endsAt,
    covered: item.kind === "hooded" && item.covered === true,
  };
}

export function normalize(input) {
  const src = input && typeof input === "object" ? input : {};
  const dice = src.dice && typeof src.dice === "object" ? src.dice : {};
  const combat = src.combat && typeof src.combat === "object" ? src.combat : {};
  const sides = SIDES.has(dice.sides) ? dice.sides : 20;
  const activeId = text(combat.activeId, 80);
  const round = int(combat.round, 1, 1, 999);

  return {
    tab: TABS.includes(src.tab) ? src.tab : "dice",
    dice: {
      count: int(dice.count, 1, 1, 40),
      sides,
      modifier: int(dice.modifier, 0, -100, 100),
      mode: MODES.includes(dice.mode) ? dice.mode : "normal",
      history: asArray(dice.history).map(cleanHistory).filter(Boolean).slice(0, 12),
    },
    combat: {
      round,
      started: combat.started === true || round > 1,
      activeId: activeId || null,
      combatants: asArray(combat.combatants).map(cleanCombatant).filter(Boolean).slice(0, 24),
    },
    party: asArray(src.party).map(cleanHero).filter(Boolean).slice(0, 8),
    monsters: asArray(src.monsters).map(cleanMonster).filter(Boolean).slice(0, 12),
    sparks: asArray(src.sparks).map(cleanSpark).filter(Boolean).slice(0, 8),
    lights: asArray(src.lights).map(cleanLight).filter(Boolean).slice(0, 8),
    notes: typeof src.notes === "string" ? src.notes.slice(0, 4000) : "",
  };
}

export function loadState() {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return normalize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveState(state) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // The table still works if the browser refuses to store the night.
  }
}

export function clearState() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore a storage failure and let the screen reset anyway.
  }
}
