// The shared turn order: one list, hit points, conditions, exhaustion, and death saves.

import { MARKS } from "./marks.js";

function int(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isInteger(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function text(value, max) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export function blankDeath() {
  return { success: 0, failure: 0, stable: false };
}

export function cleanDeath(value) {
  const source = value && typeof value === "object" ? value : {};
  const success = int(source.success, 0, 0, 3);
  const failure = int(source.failure, 0, 0, 3);
  return {
    success,
    failure,
    stable: success >= 3 && failure < 3,
  };
}

export function blankOrder() {
  return { round: 1, started: false, activeId: null, combatants: [] };
}

export function cleanCombatantRecord(item, index) {
  if (!item || typeof item !== "object") return null;
  const name = text(item.name, 80);
  if (!name) return null;
  const hp = int(item.hp, 1, 0, 9999);
  const id = text(item.id, 80) || `c${index}`;
  return {
    id,
    name,
    seat: text(item.seat, 40),
    init: int(item.init, 0, -100, 200),
    bonus: int(item.bonus, 0, -30, 30),
    die: item.die == null || item.die === "" ? null : int(item.die, null, 1, 20),
    hp,
    maxHp: int(item.maxHp, Math.max(hp, 1), 1, 9999),
    ac: item.ac == null || item.ac === "" ? null : int(item.ac, null, 0, 40),
    marks: (Array.isArray(item.marks) ? item.marks : []).filter((mark) => MARKS.includes(mark)),
    exhaustion: int(item.exhaustion, 0, 0, 6),
    death: cleanDeath(item.death),
    order: int(item.order, index, 0, 100000),
  };
}

export function cleanOrder(input) {
  const source = input && typeof input === "object" ? input : {};
  const activeId = text(source.activeId, 80);
  const round = int(source.round, 1, 1, 999);
  const combatants = (Array.isArray(source.combatants) ? source.combatants : [])
    .map(cleanCombatantRecord)
    .filter(Boolean)
    .slice(0, 24);
  const known = new Set(combatants.map((person) => person.id));
  return {
    round,
    started: source.started === true || round > 1,
    activeId: activeId && known.has(activeId) ? activeId : null,
    combatants,
  };
}

export function sortOrder(combatants) {
  return [...combatants].sort((a, b) => b.init - a.init || a.order - b.order);
}
