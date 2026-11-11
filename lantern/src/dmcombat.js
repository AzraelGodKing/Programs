// DM screen: monster quick-add, hidden rows, attacks, damage across rows,
// timed conditions, legendary and lair reminders, the turn timer, and Delay.

import { ABILITIES, askBonus } from "./character.js";
import { applyAreaDamage, delayTurn, turnTimerText } from "./combat.js";
import { roll } from "./dice.js";
import { critDamage, concentrationDc, formulaText, parseFormula } from "./extras.js";
import { MARKS } from "./marks.js";
import { advanceTurn, cleanOrder } from "./order.js";
import { fromLibrary, monsterRows, SRD_MONSTERS } from "./monsters.js";
import { normalize } from "./store.js";

const LOG_CAP = 30;
const LOG_KEY = "lantern.dm.rolls";
const picked = new Set();
let hooks = null;
let log = [];

function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of (Array.isArray(children) ? children : [children]).flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const d20 = () => roll({ count: 1, sides: 20 }).kept[0];
const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

function libraryMonsters() {
  try {
    const raw = JSON.parse(localStorage.getItem("lantern.library") || "{}");
    return Array.isArray(raw.monsters) ? raw.monsters.filter((monster) => monster?.name) : [];
  } catch {
    return [];
  }
}

/** Every monster the quick-add knows: the Library first, then the short SRD list. */
export function knownMonsters() {
  const fromLib = libraryMonsters().map(fromLibrary);
  const names = new Set(fromLib.map((monster) => monster.name.toLowerCase()));
  return [...fromLib, ...SRD_MONSTERS.filter((monster) => !names.has(monster.name.toLowerCase()))];
}

// --- The DM's own roll log ----------------------------------------------------

function logKey() {
  return `${LOG_KEY}.${hooks?.code() || "none"}`;
}

function loadLog() {
  try {
    const list = JSON.parse(localStorage.getItem(logKey()) || "[]");
    log = Array.isArray(list) ? list.filter((line) => typeof line?.text === "string").slice(-LOG_CAP) : [];
  } catch {
    log = [];
  }
}

export function noteRoll(text, kind = "roll") {
  log.push({ at: Date.now(), text: String(text).slice(0, 300), kind });
  log = log.slice(-LOG_CAP);
  try { localStorage.setItem(logKey(), JSON.stringify(log)); } catch { /* the log still shows on this page */ }
  paintLog();
}

function paintLog() {
  const mount = document.getElementById("dm-roll-log");
  if (!mount) return;
  mount.replaceChildren(...(log.length
    ? [...log].reverse().map((line) => h("p", { class: `dm-log-line is-${line.kind}` }, [
      h("time", {}, new Date(line.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })),
      " ",
      line.text,
    ]))
    : [h("p", { class: "empty" }, "Monster attacks, saves, and round reminders land here. Only you see them.")]));
}

// --- Rows ---------------------------------------------------------------------

function find(id) {
  return hooks.getOrder().combatants.find((person) => person.id === id);
}

function seatCharacter(person) {
  if (!person?.seat) return null;
  const player = (hooks.room()?.players || []).find((item) => item.name.toLowerCase() === person.seat.toLowerCase());
  return player ? normalize(player.snapshot).character : null;
}

/** A save or check bonus for any row: the seat's own sheet, or the monster's modifiers. */
export function rowBonus(person, ability, save = true) {
  const character = seatCharacter(person);
  const label = ABILITIES.find((item) => item.id === ability)?.label;
  if (character && label) return askBonus(character, `${label} ${save ? "save" : "check"}`)?.bonus ?? 0;
  return person?.mods?.[ability] ?? 0;
}

/** Extra controls on one order row for the DM. */
export function combatRowBits(person) {
  const monster = !person.seat;
  const bits = [];
  bits.push(h("div", { class: "combat-tags" }, [
    h("label", { class: "pick" }, [
      h("input", { type: "checkbox", "data-combat-pick": person.id, checked: picked.has(person.id) ? "checked" : null }),
      "Pick",
    ]),
    person.hidden ? h("span", { class: "tag hidden-tag" }, "Hidden") : null,
    monster ? h("button", { type: "button", class: "text-btn", "data-combat-hide": person.id }, person.hidden ? "Reveal" : "Hide") : null,
    h("button", { type: "button", class: "text-btn", "data-combat-delay": person.id }, "Delay"),
    ...Object.entries(person.durations || {}).map(([mark, rounds]) => h("span", { class: "tag" }, `${mark} · ${rounds} rd`)),
  ]));
  if (person.attacks?.length) {
    bits.push(h("div", { class: "combat-attacks" }, person.attacks.map((attack, index) => h("button", {
      type: "button",
      class: "btn",
      "data-combat-attack": person.id,
      "data-index": String(index),
    }, `${attack.name} ${signed(attack.hit)} · ${attack.damage}`))));
  }
  bits.push(h("div", { class: "combat-hit" }, [
    h("input", { type: "number", min: "0", max: "999", inputmode: "numeric", "aria-label": `Damage to ${person.name}`, placeholder: "Dmg", "data-combat-amount": person.id }),
    h("button", { type: "button", class: "btn", "data-combat-damage": person.id }, "Hit"),
    h("select", { "aria-label": `Timed condition on ${person.name}`, "data-combat-mark": person.id },
      MARKS.filter((mark) => mark !== "concentrating").map((mark) => h("option", { value: mark }, mark))),
    h("input", { type: "number", min: "1", max: "100", value: "1", "aria-label": "Rounds", "data-combat-rounds": person.id }),
    h("button", { type: "button", class: "text-btn", "data-combat-timed": person.id }, "Add for rounds"),
  ]));
  if (monster) {
    const legend = person.legendary;
    bits.push(h("div", { class: "combat-legend" }, [
      h("label", {}, [
        "Legendary",
        h("input", { type: "number", min: "0", max: "5", value: String(legend?.max || 0), "data-combat-legend": person.id }),
      ]),
      ...(legend ? Array.from({ length: legend.max }, (_, index) => h("button", {
        type: "button",
        class: `pip${index < legend.used ? " is-on" : ""}`,
        "aria-label": `Legendary action ${index + 1}`,
        "aria-pressed": index < legend.used ? "true" : "false",
        "data-combat-legend-pip": person.id,
        "data-index": String(index),
      })) : []),
      h("label", { class: "check" }, [
        h("input", { type: "checkbox", "data-combat-lair": person.id, checked: person.lair ? "checked" : null }),
        "Lair",
      ]),
    ]));
  }
  return bits;
}

// --- Actions ------------------------------------------------------------------

function rollAttack(person, attack) {
  const die = d20();
  const hitTotal = die + attack.hit;
  const formula = parseFormula(attack.damage);
  let damageLine = attack.damage;
  if (formula) {
    const dice = die === 20 ? critDamage(formula) : formula;
    const result = roll(dice);
    damageLine = `${result.total} damage (${formulaText(dice)}${die === 20 ? ", crit" : ""})`;
  }
  const tag = die === 20 ? " Natural 20." : die === 1 ? " Natural 1." : "";
  noteRoll(`${person.name}: ${attack.name} ${hitTotal} to hit (${die}${signed(attack.hit)}), ${damageLine}.${tag}`);
}

function concentrationRoll(person, taken) {
  if (!person.marks.includes("concentrating") || taken <= 0) return;
  const dc = concentrationDc(taken);
  if (person.seat) {
    noteRoll(`${person.name} is concentrating: Constitution save DC ${dc}.`, "note");
    return;
  }
  const bonus = rowBonus(person, "con");
  const die = d20();
  const total = die + bonus;
  const holds = total >= dc;
  if (!holds) person.marks = person.marks.filter((mark) => mark !== "concentrating");
  noteRoll(`${person.name} concentration, DC ${dc}: ${total} (${die}${signed(bonus)}), ${holds ? "holds" : "drops it"}.`, holds ? "roll" : "note");
}

async function hitRow(id, amount) {
  const person = find(id);
  if (!person || !(amount > 0)) return;
  person.hp = Math.max(0, person.hp - amount);
  noteRoll(`${person.name} takes ${amount}, now ${person.hp}/${person.maxHp}.`, "note");
  concentrationRoll(person, amount);
  await hooks.save();
}

async function areaDamage(form) {
  const ids = [...picked].filter((id) => find(id));
  if (!ids.length) {
    hooks.status("Tick Pick on the rows the effect hits.");
    return;
  }
  const raw = form.elements.amount.value.trim();
  const formula = parseFormula(raw);
  const amount = /^\d+$/.test(raw) ? Number(raw) : formula ? roll(formula).total : NaN;
  if (!Number.isFinite(amount)) {
    hooks.status("Damage is a number or dice, like 8d6.");
    return;
  }
  const ability = form.elements.save.value;
  const dc = Number(form.elements.dc.value);
  const { order, results } = applyAreaDamage(hooks.getOrder(), {
    ids,
    amount,
    ability,
    dc: ability && Number.isInteger(dc) && dc > 0 ? dc : null,
    onSave: form.elements.onsave.value,
    bonusFor: (person, id) => rowBonus(person, id),
    rollD20: d20,
  });
  hooks.setOrder(order);
  const saveName = ABILITIES.find((item) => item.id === ability)?.short;
  noteRoll(`${amount} damage to ${results.length} ${results.length === 1 ? "row" : "rows"}${saveName ? `, ${saveName} save DC ${dc}` : ""}.`, "note");
  for (const result of results) {
    const save = result.save ? ` ${result.save.total} (${result.save.die}${signed(result.save.bonus)}) ${result.save.saved ? "saves" : "fails"},` : "";
    noteRoll(`${result.name}:${save} takes ${result.taken}, now ${result.hp}.`);
    if (result.concentration) concentrationRoll(find(result.id), result.taken);
  }
  picked.clear();
  await hooks.save();
}

/** Next and Back on the DM screen. Notes, like a lair action, land in the log. */
export function stepTurn(direction) {
  const { order, notes } = advanceTurn(hooks.getOrder(), direction);
  hooks.setOrder(order);
  for (const note of notes) noteRoll(note, "note");
  void hooks.save();
}

async function quickAdd(form) {
  const name = form.elements.monster.value.trim().toLowerCase();
  const monster = knownMonsters().find((item) => item.name.toLowerCase() === name);
  if (!monster) {
    hooks.status("Pick a monster from the list, or add it by hand below.");
    return;
  }
  const order = hooks.getOrder();
  const count = Number(form.elements.count.value) || 1;
  if (order.combatants.length + count > 24) {
    hooks.status("The order holds 24.");
    return;
  }
  const rows = monsterRows(monster, {
    count,
    hidden: form.elements.hidden.checked,
    shared: form.elements.shared.checked,
    existing: order.combatants,
    rollD20: d20,
  });
  order.combatants.push(...rows);
  hooks.setOrder(cleanOrder(order));
  noteRoll(`Added ${rows.length} × ${monster.name}${form.elements.shared.checked && rows.length > 1 ? ` on one initiative, ${rows[0].init}` : ""}${form.elements.hidden.checked ? ", hidden" : ""}.`, "note");
  form.elements.monster.value = "";
  await hooks.save();
}

function paintMonsterList() {
  const list = document.getElementById("monster-options");
  if (!list) return;
  list.replaceChildren(...knownMonsters().map((monster) => h("option", { value: monster.name }, `CR ${monster.cr} · AC ${monster.ac} · HP ${monster.hp}`)));
}

function paintTimer() {
  const line = document.getElementById("dm-turn-timer");
  if (line) line.textContent = turnTimerText(hooks.getOrder());
  const select = document.getElementById("dm-turn-limit");
  if (select && document.activeElement !== select) select.value = String(hooks.getOrder().turnLimit || 0);
}

async function onClick(event) {
  const target = event.target;
  const hide = target.closest("[data-combat-hide]");
  if (hide) {
    const person = find(hide.dataset.combatHide);
    if (!person) return;
    if (person.hidden) delete person.hidden;
    else person.hidden = true;
    noteRoll(`${person.name} is ${person.hidden ? "hidden from" : "revealed to"} the players.`, "note");
    await hooks.save();
    return;
  }
  const delay = target.closest("[data-combat-delay]");
  if (delay) {
    const before = hooks.getOrder();
    const after = delayTurn(before, delay.dataset.combatDelay);
    if (after.combatants.every((person, index) => person.order === before.combatants[index]?.order && person.init === before.combatants[index]?.init)) {
      hooks.status("That row is already last in the round.");
      return;
    }
    hooks.setOrder(after);
    noteRoll(`${find(delay.dataset.combatDelay)?.name} delays.`, "note");
    await hooks.save();
    return;
  }
  const attack = target.closest("[data-combat-attack]");
  if (attack) {
    const person = find(attack.dataset.combatAttack);
    const chosen = person?.attacks?.[Number(attack.dataset.index)];
    if (chosen) rollAttack(person, chosen);
    return;
  }
  const damage = target.closest("[data-combat-damage]");
  if (damage) {
    const field = damage.parentElement.querySelector("[data-combat-amount]");
    await hitRow(damage.dataset.combatDamage, Number(field?.value));
    return;
  }
  const timed = target.closest("[data-combat-timed]");
  if (timed) {
    const person = find(timed.dataset.combatTimed);
    const box = timed.parentElement;
    const mark = box.querySelector("[data-combat-mark]")?.value;
    const rounds = Math.max(1, Math.min(100, Number(box.querySelector("[data-combat-rounds]")?.value) || 1));
    if (!person || !MARKS.includes(mark)) return;
    if (!person.marks.includes(mark)) person.marks.push(mark);
    person.durations = { ...(person.durations || {}), [mark]: rounds };
    noteRoll(`${person.name} is ${mark} for ${rounds} ${rounds === 1 ? "round" : "rounds"}. It clears at the end of their turn.`, "note");
    await hooks.save();
    return;
  }
  const pip = target.closest("[data-combat-legend-pip]");
  if (pip) {
    const person = find(pip.dataset.combatLegendPip);
    if (!person?.legendary) return;
    const index = Number(pip.dataset.index);
    person.legendary.used = person.legendary.used === index + 1 ? index : index + 1;
    await hooks.save();
  }
}

async function onChange(event) {
  const target = event.target;
  if (target.dataset.combatPick) {
    if (target.checked) picked.add(target.dataset.combatPick);
    else picked.delete(target.dataset.combatPick);
    const count = document.getElementById("dm-area-count");
    if (count) count.textContent = picked.size ? `${picked.size} picked` : "No rows picked";
    return;
  }
  if (target.dataset.combatLegend) {
    const person = find(target.dataset.combatLegend);
    if (!person) return;
    const max = Math.max(0, Math.min(5, Number(target.value) || 0));
    if (max) person.legendary = { max, used: Math.min(person.legendary?.used || 0, max) };
    else delete person.legendary;
    await hooks.save();
    return;
  }
  if (target.dataset.combatLair) {
    const person = find(target.dataset.combatLair);
    if (!person) return;
    if (target.checked) person.lair = true;
    else delete person.lair;
    await hooks.save();
    return;
  }
  if (target.id === "dm-turn-limit") {
    const order = hooks.getOrder();
    order.turnLimit = Number(target.value) || 0;
    if (!order.turnStartedAt && order.started) order.turnStartedAt = Date.now();
    await hooks.save();
  }
}

/** Wires the Order module. hooks: getOrder, setOrder, save, room, status, code. */
export function bootCombat(next) {
  hooks = next;
  loadLog();
  paintLog();
  paintMonsterList();
  const module = document.getElementById("module-order");
  module?.addEventListener("click", (event) => { void onClick(event); });
  module?.addEventListener("change", (event) => { void onChange(event); });
  module?.addEventListener("toggle", paintMonsterList);
  document.getElementById("dm-quick-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void quickAdd(event.target);
  });
  document.getElementById("dm-area-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void areaDamage(event.target);
  });
  setInterval(paintTimer, 1000);
}

/** Called when the table changes, so the roll log follows the table code. */
export function combatTableChanged() {
  picked.clear();
  loadLog();
  paintLog();
  paintMonsterList();
}
