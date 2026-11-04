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
    ...cleanMonsterBits(item),
  };
}

const MOD_IDS = ["str", "dex", "con", "int", "wis", "cha"];

/** DM-only details on a creature row: hidden, ability modifiers, attacks, timed conditions, legendary actions, lair. */
function cleanMonsterBits(item) {
  const bits = {};
  if (item.hidden === true) bits.hidden = true;
  if (item.lair === true) bits.lair = true;
  if (item.mods && typeof item.mods === "object") {
    bits.mods = Object.fromEntries(MOD_IDS.map((id) => [id, int(item.mods[id], 0, -5, 10)]));
  }
  if (Array.isArray(item.attacks) && item.attacks.length) {
    bits.attacks = item.attacks.slice(0, 4).map((attack) => ({
      name: text(attack?.name, 40),
      hit: int(attack?.hit, 0, -10, 30),
      damage: text(attack?.damage, 30),
    })).filter((attack) => attack.name);
  }
  if (item.durations && typeof item.durations === "object") {
    const durations = {};
    for (const [mark, rounds] of Object.entries(item.durations)) {
      if (MARKS.includes(mark) && Number.isInteger(rounds) && rounds > 0) durations[mark] = Math.min(100, rounds);
    }
    if (Object.keys(durations).length) bits.durations = durations;
  }
  if (item.legendary && typeof item.legendary === "object") {
    const max = int(item.legendary.max, 0, 0, 5);
    if (max) bits.legendary = { max, used: int(item.legendary.used, 0, 0, max) };
  }
  return bits;
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
  const turnStartedAt = Number(source.turnStartedAt);
  return {
    round,
    started: source.started === true || round > 1,
    activeId: activeId && known.has(activeId) ? activeId : null,
    combatants,
    turnStartedAt: Number.isFinite(turnStartedAt) && turnStartedAt > 0 ? turnStartedAt : 0,
    turnLimit: int(source.turnLimit, 0, 0, 3600),
    notes: (Array.isArray(source.notes) ? source.notes : []).map((note) => text(note, 160)).filter(Boolean).slice(0, 8),
    ...(source.hiddenTurn === true ? { hiddenTurn: true } : {}),
  };
}

/**
 * Moves the round one turn. The creature whose turn ends loses a round from
 * each timed condition, and the one whose turn starts gets its legendary
 * actions back. Returns notes worth saying, like a lair action.
 */
export function advanceTurn(input, direction = 1, now = Date.now()) {
  const order = cleanOrder(input);
  const list = sortOrder(order.combatants);
  const notes = [];
  let endingId = "";
  if (!list.length) return { order, notes };
  if (!order.started) {
    if (direction < 0) return { order, notes };
    order.started = true;
    order.activeId = list[0].id;
  } else {
    const index = Math.max(0, list.findIndex((person) => person.id === order.activeId));
    const ending = list[index];
    endingId = ending?.id || "";
    if (direction > 0 && ending?.durations) {
      for (const [mark, rounds] of Object.entries(ending.durations)) {
        if (rounds <= 1) {
          delete ending.durations[mark];
          ending.marks = ending.marks.filter((item) => item !== mark);
          notes.push(`${ending.name} is no longer ${mark}.`);
        } else ending.durations[mark] = rounds - 1;
      }
      if (!Object.keys(ending.durations).length) delete ending.durations;
    }
    const nextIndex = (index + direction + list.length) % list.length;
    if (direction > 0 && nextIndex === 0) order.round = Math.min(999, order.round + 1);
    if (direction < 0 && nextIndex === list.length - 1) order.round = Math.max(1, order.round - 1);
    order.activeId = list[nextIndex].id;
  }
  if (direction > 0 && endingId) {
    for (const person of order.combatants) {
      if (person.legendary && person.id !== endingId && person.legendary.used < person.legendary.max) {
        notes.push(`${person.name} can take a legendary action (${person.legendary.max - person.legendary.used} left).`);
      }
    }
  }
  const starting = order.combatants.find((person) => person.id === order.activeId);
  if (starting?.legendary) starting.legendary.used = 0;
  if (direction > 0 && list[0].id === order.activeId) {
    for (const person of order.combatants) if (person.lair) notes.push(`Lair action for ${person.name}, on initiative 20.`);
  }
  order.turnStartedAt = now;
  order.notes = [...new Set(notes)];
  return { order: cleanOrder(order), notes: order.notes };
}

/** What players may see: hidden creatures are left out. */
export function playerOrder(input) {
  const order = cleanOrder(input);
  const shown = order.combatants.filter((person) => !person.hidden).map((person) => {
    const { mods, attacks, legendary, lair, ...rest } = person;
    return rest;
  });
  const activeHidden = order.activeId && !shown.some((person) => person.id === order.activeId);
  const { notes, ...open } = order;
  return { ...open, combatants: shown, activeId: activeHidden ? null : order.activeId, hiddenTurn: Boolean(activeHidden) };
}

export function sortOrder(combatants) {
  return [...combatants].sort((a, b) => b.init - a.init || a.order - b.order);
}
