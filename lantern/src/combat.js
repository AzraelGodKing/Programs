// DM-side combat and roll-calling rules, kept apart from the screen so they can be tested.

import { ABILITIES, SKILLS } from "./character.js";
import { concentrationDc } from "./extras.js";
import { cleanOrder, sortOrder } from "./order.js";

/** The ability a named roll uses: "Stealth" is Dexterity, "Wisdom save" is Wisdom. */
export function askAbility(ask) {
  const name = String(ask || "").trim().toLowerCase();
  const skill = SKILLS.find((item) => item.label.toLowerCase() === name || item.id === name);
  if (skill) return { ability: skill.ability, save: false };
  if (name === "initiative") return { ability: "dex", save: false };
  const match = name.match(/^(\w+)\s+(check|save|saving throw)$/);
  if (!match) return null;
  const ability = ABILITIES.find((item) => item.label.toLowerCase() === match[1] || item.id === match[1] || item.short.toLowerCase() === match[1]);
  return ability ? { ability: ability.id, save: match[2] !== "check" } : null;
}

/** A monster's bonus for a named roll, from its ability modifiers. */
export function monsterBonus(person, ask) {
  const found = askAbility(ask);
  if (!found) return 0;
  return person?.mods?.[found.ability] ?? 0;
}

/**
 * How one answer reads against the DM's call: pass or fail against a DC,
 * and win, lose, or tie against a contested roll.
 */
export function askVerdict({ total, dc = null, against = null }) {
  if (!Number.isInteger(total)) return "";
  if (Number.isInteger(against)) {
    if (total > against) return "wins";
    if (total < against) return "loses";
    return "ties";
  }
  if (Number.isInteger(dc)) return total >= dc ? "passes" : "fails";
  return "";
}

/** Group check: half or more of the answers pass. */
export function groupVerdict(totals, dc) {
  const answered = totals.filter(Number.isInteger);
  if (!answered.length || !Number.isInteger(dc)) return "";
  const passed = answered.filter((total) => total >= dc).length;
  return passed * 2 >= answered.length ? `The group passes (${passed} of ${answered.length}).` : `The group fails (${passed} of ${answered.length}).`;
}

/**
 * Damage across several rows. With a save, each row rolls d20 plus its bonus
 * against the DC; a success takes half (rounded down) or none.
 */
export function applyAreaDamage(input, { ids, amount, ability = "", dc = null, onSave = "half", bonusFor, rollD20 }) {
  const order = cleanOrder(input);
  const results = [];
  for (const id of ids) {
    const person = order.combatants.find((item) => item.id === id);
    if (!person) continue;
    let taken = Math.max(0, Math.floor(amount));
    let save = null;
    if (ability && Number.isInteger(dc)) {
      const bonus = bonusFor(person, ability);
      const die = rollD20();
      const total = die + bonus;
      const saved = total >= dc;
      save = { die, bonus, total, saved };
      if (saved) taken = onSave === "none" ? 0 : Math.floor(taken / 2);
    }
    const before = person.hp;
    person.hp = Math.max(0, person.hp - taken);
    let concentration = null;
    if (taken > 0 && person.marks.includes("concentrating")) concentration = concentrationDc(taken);
    results.push({ id, name: person.name, taken, before, hp: person.hp, save, concentration });
  }
  return { order: cleanOrder(order), results };
}

/**
 * Delay: the row moves one place later in the order, taking the initiative
 * of the row it moves behind. If it was that row's turn, the turn passes to
 * the row that was next, with no round ticked.
 */
export function delayTurn(input, id) {
  const order = cleanOrder(input);
  const list = sortOrder(order.combatants);
  const index = list.findIndex((person) => person.id === id);
  if (index < 0 || list.length < 2) return order;
  const mover = list[index];
  const wasActive = order.activeId === id;
  if (index === list.length - 1) {
    // Already last: wrap to the top of the next round.
    return order;
  }
  const behind = list[index + 1];
  list.splice(index, 1);
  list.splice(index + 1, 0, mover);
  mover.init = behind.init;
  list.forEach((person, place) => { person.order = place; });
  if (wasActive) order.activeId = behind.id;
  order.combatants = list;
  return cleanOrder(order);
}

/** "0:42 of 1:00". */
export function clockText(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The turn timer line the table sees, or "" when the round has not started. */
export function turnTimerText(order, now = Date.now()) {
  if (!order?.started || !order.turnStartedAt) return "";
  const spent = now - order.turnStartedAt;
  const line = `Round ${order.round} · turn ${clockText(spent)}`;
  if (!order.turnLimit) return line;
  const over = spent > order.turnLimit * 1000;
  return `${line} of ${clockText(order.turnLimit * 1000)}${over ? " · time" : ""}`;
}
