import { facesLabel, formula, roll, STANDARD_SIDES } from "./dice.js";
import { CR_XP, formatXp, rateEncounter } from "./encounter.js";
import { findLight, formatRemaining, LIGHTS, lightCaption, lightOptionLabel } from "./lights.js";
import { MARKS } from "./marks.js";
import { draw, drawScene, KIND_LABEL, sparkText } from "./oracle.js";
import { clearState, loadState, normalize, saveState } from "./store.js";

const WORDS = {
  trivial: "Trivial",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  deadly: "Deadly",
};

const SHIFT = {
  stricter: "Fewer than three in the party, so the multiplier steps up.",
  gentler: "Six or more in the party, so the multiplier steps down.",
};

let state = loadState() ?? normalize(null);
let openMarksId = null;
let pendingScroll = false;
let flameSignature = "";
const announcedOut = new Set();

function uid() {
  return crypto.randomUUID();
}

function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "open") node.open = true;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function present(items) {
  return items.filter((item) => item != null && item !== false);
}

function showError(name, message) {
  setText(document.querySelector(`[data-error-for="${name}"]`), message);
}

function looseInt(raw) {
  const text = String(raw).trim();
  if (text === "" || text === "-") return null;
  const n = Number(text);
  if (!Number.isInteger(n)) return null;
  return n;
}

function readInt(input, fallback, min, max) {
  const n = looseInt(input.value);
  const next = n == null ? fallback : Math.min(max, Math.max(min, n));
  input.value = String(next);
  return next;
}

function persist() {
  saveState(state);
}

function findCombatant(id) {
  return state.combat.combatants.find((person) => person.id === id);
}

function turnOrder() {
  return [...state.combat.combatants].sort((a, b) => b.init - a.init || a.order - b.order);
}

function ensureActive() {
  const list = turnOrder();
  if (!list.length) {
    state.combat.activeId = null;
    return;
  }
  if (!list.some((person) => person.id === state.combat.activeId)) {
    state.combat.activeId = list[0].id;
  }
}

function showTab(tab, { save = true } = {}) {
  state.tab = tab;
  for (const name of ["dice", "order", "threat", "spark"]) {
    const on = name === tab;
    document.getElementById(`panel-${name}`).hidden = !on;
    const button = document.getElementById(`tab-${name}`);
    button.setAttribute("aria-selected", on ? "true" : "false");
    button.tabIndex = on ? 0 : -1;
  }
  if (save) persist();
}

function diceSetupLabel() {
  const { count, sides, modifier, mode } = state.dice;
  const suffix = modifier === 0 ? "" : modifier > 0 ? ` + ${modifier}` : ` − ${Math.abs(modifier)}`;
  if (sides === 20 && mode === "advantage") return `${count}d20 advantage${suffix}`;
  if (sides === 20 && mode === "disadvantage") return `${count}d20 disadvantage${suffix}`;
  return `${count}d${sides}${suffix}`;
}

function syncDiceNumbers() {
  state.dice.count = readInt(document.getElementById("dice-count"), state.dice.count, 1, 40);
  state.dice.modifier = readInt(document.getElementById("dice-mod"), state.dice.modifier, -100, 100);
}

function paintDice() {
  for (const button of document.querySelectorAll("[data-sides]")) {
    button.setAttribute("aria-pressed", Number(button.dataset.sides) === state.dice.sides ? "true" : "false");
  }
  for (const button of document.querySelectorAll("[data-mode]")) {
    button.setAttribute("aria-pressed", button.dataset.mode === state.dice.mode ? "true" : "false");
  }
  setText(document.getElementById("dice-formula"), diceSetupLabel());
  const hint = document.getElementById("dice-hint");
  const waiting = state.dice.mode !== "normal" && state.dice.sides !== 20;
  hint.hidden = !waiting;
  document.getElementById("clear-rolls").disabled = state.dice.history.length === 0;
}

function tagClass(tag) {
  return tag ? `result-total ${tag}` : "result-total";
}

function faceNodes(result) {
  const nodes = [];
  result.groups.forEach((group, groupIndex) => {
    if (group.length === 1) {
      nodes.push(h("span", { class: "face" }, String(group[0])));
      return;
    }
    const kept = result.kept[groupIndex];
    const [first, second] = group;
    if (first === second) {
      nodes.push(h("span", { class: "face" }, String(first)), h("span", { class: "face" }, String(second)));
      return;
    }
    const dropFirst = first !== kept;
    nodes.push(
      h("span", { class: dropFirst ? "face dropped" : "face" }, String(first)),
      h("span", { class: dropFirst ? "face" : "face dropped" }, String(second)),
    );
  });
  return nodes;
}

function renderIdleResult() {
  const root = document.getElementById("dice-result");
  root.dataset.tag = "";
  root.replaceChildren(h("p", { class: "result-idle" }, "The die is in your hand."));
}

function renderStoredResult(item) {
  const root = document.getElementById("dice-result");
  root.dataset.tag = item.tag || "";
  const tag = item.tag === "natural-20" ? "Natural 20" : item.tag === "natural-1" ? "Natural 1" : "";
  root.replaceChildren(...present([
    h("p", { class: tagClass(item.tag) }, String(item.total)),
    tag ? h("p", { class: "result-tag" }, tag) : null,
    h("p", { class: "result-formula" }, item.formula),
    h("p", { class: "result-detail" }, item.detail),
  ]));
}

function renderFreshResult(result) {
  const root = document.getElementById("dice-result");
  root.dataset.tag = result.tag || "";
  const tag = result.tag === "natural-20" ? "Natural 20" : result.tag === "natural-1" ? "Natural 1" : "";
  root.replaceChildren(...present([
    h("div", { class: "faces" }, faceNodes(result)),
    h("p", { class: tagClass(result.tag) }, String(result.total)),
    tag ? h("p", { class: "result-tag" }, tag) : null,
    h("p", { class: "result-formula" }, formula(result)),
    h("p", { class: "result-detail" }, facesLabel(result)),
  ]));
}

function renderHistory() {
  const mount = document.getElementById("dice-history");
  mount.replaceChildren(...state.dice.history.map((item) => h("article", { class: item.tag ? `ticket ${item.tag}` : "ticket" }, [
    h("p", { class: "ticket-total" }, String(item.total)),
    h("p", {}, item.formula),
    h("p", { class: "ticket-detail" }, item.detail),
  ])));
}

function doRoll() {
  syncDiceNumbers();
  const mode = state.dice.sides === 20 ? state.dice.mode : "normal";
  const result = roll({
    count: state.dice.count,
    sides: state.dice.sides,
    modifier: state.dice.modifier,
    mode,
  });
  state.dice.history.unshift({
    id: uid(),
    formula: formula(result),
    total: result.total,
    detail: facesLabel(result),
    tag: result.tag,
  });
  state.dice.history = state.dice.history.slice(0, 12);
  persist();
  paintDice();
  renderFreshResult(result);
  renderHistory();
}

function renderBanner() {
  const list = turnOrder();
  const active = list.find((person) => person.id === state.combat.activeId);
  let banner = "The round has not started";
  let meta = "Add the people in the fight.";
  if (active && !state.combat.started) {
    banner = `${active.name} goes first`;
    meta = "Start begins the round there.";
  } else if (active) {
    banner = `Round ${state.combat.round} · ${active.name}`;
    meta = `${list.indexOf(active) + 1} of ${list.length}`;
  }
  setText(document.getElementById("turn-banner"), banner);
  setText(document.getElementById("turn-meta"), meta);
  setText(document.getElementById("turn-next"), state.combat.started ? "Next" : "Start");
  document.getElementById("turn-next").disabled = list.length === 0;
  document.getElementById("turn-back").disabled = list.length === 0 || !state.combat.started;
  document.getElementById("reroll-all").disabled = list.length === 0;
}

function dieLine(person) {
  if (person.die == null) return "set";
  const sign = person.bonus >= 0 ? "+" : "−";
  return `d20 ${person.die} ${sign} ${Math.abs(person.bonus)}`;
}

function combatRow(person, active) {
  const marks = person.marks.length ? person.marks.join(", ") : "Marks";
  return h("article", {
    class: `combatant${active ? " is-active" : ""}${person.hp <= 0 ? " is-down" : ""}`,
    "aria-current": active ? "true" : null,
  }, [
    h("div", { class: "init-block" }, [
      h("input", {
        class: "init-input",
        type: "number",
        "data-field": "init",
        "data-id": person.id,
        value: String(person.init),
        "aria-label": `Initiative for ${person.name}`,
      }),
      h("p", { class: "init-die" }, dieLine(person)),
    ]),
    h("div", { class: "identity" }, [
      h("input", {
        class: "name-input",
        type: "text",
        "data-field": "combat-name",
        "data-id": person.id,
        value: person.name,
        maxlength: "80",
        spellcheck: "false",
        "aria-label": "Combatant name",
      }),
      h("div", { class: "hp" }, [
        h("button", {
          type: "button",
          class: "step",
          "data-action": "hp",
          "data-id": person.id,
          "data-delta": "-1",
          "aria-label": `Decrease hit points for ${person.name}`,
        }, "−"),
        h("input", {
          class: "hp-input",
          type: "number",
          "data-field": "hp",
          "data-id": person.id,
          value: String(person.hp),
          min: "0",
          "aria-label": `Hit points for ${person.name}`,
        }),
        h("span", { class: "hp-of" }, "/"),
        h("input", {
          class: "hp-input",
          type: "number",
          "data-field": "maxhp",
          "data-id": person.id,
          value: String(person.maxHp),
          min: "0",
          "aria-label": `Hit point maximum for ${person.name}`,
        }),
        h("button", {
          type: "button",
          class: "step",
          "data-action": "hp",
          "data-id": person.id,
          "data-delta": "1",
          "aria-label": `Increase hit points for ${person.name}`,
        }, "+"),
        person.hp <= 0 ? h("span", { class: "down-flag" }, "Down") : null,
        h("label", { class: "ac-label" }, [
          "AC",
          h("input", {
            class: "ac-input",
            type: "number",
            "data-field": "ac",
            "data-id": person.id,
            value: person.ac == null ? "" : String(person.ac),
            placeholder: "—",
            "aria-label": `Armor class for ${person.name}`,
          }),
        ]),
      ]),
    ]),
    h("div", { class: "combat-tools" }, [
      h("details", { class: "marks", "data-marks": person.id, open: openMarksId === person.id }, [
        h("summary", {}, marks),
        h("div", { class: "mark-grid" }, MARKS.map((mark) => h("label", {}, [
          h("input", {
            type: "checkbox",
            "data-field": "mark",
            "data-id": person.id,
            "data-mark": mark,
            checked: person.marks.includes(mark) ? "checked" : null,
          }),
          mark,
        ]))),
      ]),
      h("button", { type: "button", class: "text-btn", "data-action": "reroll", "data-id": person.id }, "Reroll"),
      h("button", { type: "button", class: "text-btn", "data-action": "remove-combatant", "data-id": person.id }, "Remove"),
    ]),
  ]);
}

function renderCombat() {
  ensureActive();
  renderBanner();
  const list = turnOrder();
  const mount = document.getElementById("combat-list");
  if (!list.length) {
    mount.replaceChildren(h("p", { class: "empty" }, "No one has rolled initiative."));
    return;
  }
  mount.replaceChildren(...list.map((person) => combatRow(person, person.id === state.combat.activeId)));
  if (pendingScroll) {
    mount.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
    pendingScroll = false;
  }
}

function nextOrder() {
  return state.combat.combatants.reduce((max, person) => Math.max(max, person.order), 0) + 1;
}

function addCombatant(form) {
  const name = form.elements.name.value.trim().slice(0, 80);
  if (!name) {
    showError("combatant", "Give them a name.");
    form.elements.name.focus();
    return;
  }
  if (state.combat.combatants.length >= 24) {
    showError("combatant", "The order holds 24.");
    return;
  }
  const bonus = readInt(form.elements.bonus, 0, -30, 30);
  const hp = readInt(form.elements.hp, 10, 0, 9999);
  const acRaw = form.elements.ac.value.trim();
  const ac = acRaw === "" ? null : readInt(form.elements.ac, 10, 0, 40);
  const manual = form.elements.initiative.value.trim();
  let init = 0;
  let die = null;
  if (manual === "") {
    const rolled = roll({ count: 1, sides: 20, modifier: bonus, mode: "normal" });
    init = rolled.total;
    die = rolled.kept[0];
  } else {
    init = readInt(form.elements.initiative, 0, -100, 200);
  }
  const person = {
    id: uid(),
    name,
    init,
    bonus,
    die,
    hp,
    maxHp: Math.max(hp, 1),
    ac,
    marks: [],
    order: nextOrder(),
  };
  state.combat.combatants.push(person);
  if (!state.combat.started) state.combat.activeId = null;
  ensureActive();
  showError("combatant", "");
  form.elements.name.value = "";
  form.elements.initiative.value = "";
  form.elements.name.focus();
  persist();
  renderCombat();
}

function bumpHp(id, delta) {
  const person = findCombatant(id);
  if (!person) return;
  person.hp = Math.min(9999, Math.max(0, person.hp + delta));
  persist();
  renderCombat();
}

function rerollOne(id) {
  const person = findCombatant(id);
  if (!person) return;
  const rolled = roll({ count: 1, sides: 20, modifier: person.bonus, mode: "normal" });
  person.init = rolled.total;
  person.die = rolled.kept[0];
  if (!state.combat.started) state.combat.activeId = null;
  ensureActive();
  persist();
  renderCombat();
}

function rerollAll() {
  for (const person of state.combat.combatants) {
    const rolled = roll({ count: 1, sides: 20, modifier: person.bonus, mode: "normal" });
    person.init = rolled.total;
    person.die = rolled.kept[0];
  }
  if (!state.combat.started) state.combat.activeId = null;
  ensureActive();
  persist();
  renderCombat();
}

function removeCombatant(id) {
  const list = turnOrder();
  const index = list.findIndex((person) => person.id === id);
  state.combat.combatants = state.combat.combatants.filter((person) => person.id !== id);
  if (state.combat.activeId === id) {
    const neighbor = list[index + 1] || list[index - 1] || null;
    state.combat.activeId = neighbor && neighbor.id !== id ? neighbor.id : null;
  }
  if (!state.combat.combatants.length) {
    state.combat.round = 1;
    state.combat.started = false;
    state.combat.activeId = null;
  } else if (!state.combat.started) {
    state.combat.activeId = null;
  }
  if (openMarksId === id) openMarksId = null;
  ensureActive();
  persist();
  renderCombat();
}

function stepTurn(direction) {
  const list = turnOrder();
  if (!list.length) return;
  if (!state.combat.started) {
    if (direction < 0) return;
    state.combat.started = true;
    state.combat.activeId = list[0].id;
    pendingScroll = true;
    persist();
    renderCombat();
    return;
  }
  const index = list.findIndex((person) => person.id === state.combat.activeId);
  if (index === -1) {
    state.combat.activeId = list[0].id;
  } else {
    const nextIndex = (index + direction + list.length) % list.length;
    if (direction > 0 && nextIndex === 0) state.combat.round += 1;
    if (direction < 0 && nextIndex === list.length - 1) {
      state.combat.round = Math.max(1, state.combat.round - 1);
    }
    state.combat.activeId = list[nextIndex].id;
  }
  pendingScroll = true;
  persist();
  renderCombat();
}

function levelOptions(selected) {
  const options = [];
  for (let level = 1; level <= 20; level += 1) {
    const option = h("option", { value: String(level) }, String(level));
    if (level === selected) option.selected = true;
    options.push(option);
  }
  return options;
}

function renderParty() {
  const mount = document.getElementById("party-list");
  if (!state.party.length) {
    mount.replaceChildren(h("p", { class: "empty" }, "No adventurers yet."));
    return;
  }
  mount.replaceChildren(...state.party.map((hero) => h("div", { class: "edit-row" }, [
    h("input", {
      type: "text",
      "data-field": "hero-name",
      "data-id": hero.id,
      value: hero.name,
      placeholder: "Adventurer",
      maxlength: "80",
      spellcheck: "false",
      "aria-label": "Adventurer name",
    }),
    h("label", { class: "inline" }, [
      "Level",
      h("select", { "data-field": "hero-level", "data-id": hero.id, "aria-label": "Level" }, levelOptions(hero.level)),
    ]),
    h("button", { type: "button", class: "text-btn", "data-action": "remove-hero", "data-id": hero.id }, "Remove"),
  ])));
}

function renderMonsters() {
  const mount = document.getElementById("monster-list");
  if (!state.monsters.length) {
    mount.replaceChildren(h("p", { class: "empty" }, "No creatures yet."));
    return;
  }
  mount.replaceChildren(...state.monsters.map((monster) => h("div", { class: "edit-row" }, [
    h("input", {
      type: "text",
      "data-field": "monster-name",
      "data-id": monster.id,
      value: monster.name,
      maxlength: "80",
      spellcheck: "false",
      "aria-label": "Creature name",
    }),
    h("label", { class: "inline" }, [
      "Count",
      h("input", {
        type: "number",
        "data-field": "monster-count",
        "data-id": monster.id,
        value: String(monster.count),
        min: "1",
        "aria-label": `Count of ${monster.name}`,
      }),
    ]),
    h("label", { class: "inline" }, [
      "XP each",
      h("input", {
        type: "number",
        "data-field": "monster-xp",
        "data-id": monster.id,
        value: String(monster.xp),
        min: "0",
        "aria-label": `Experience for one ${monster.name}`,
      }),
    ]),
    h("button", { type: "button", class: "text-btn", "data-action": "remove-monster", "data-id": monster.id }, "Remove"),
  ])));
}

function partyLabel() {
  if (!state.party.length) return "";
  const levels = state.party.map((hero) => hero.level);
  const unique = [...new Set(levels)];
  if (unique.length === 1) return `Party of ${state.party.length} at level ${unique[0]}`;
  return `Party of ${state.party.length}`;
}

function renderThreat({ reveal = false } = {}) {
  const result = rateEncounter({
    levels: state.party.map((hero) => hero.level),
    groups: state.monsters.map((monster) => ({ count: monster.count, xp: monster.xp })),
  });
  const mount = document.getElementById("threat-summary");
  const thresholds = result.thresholds;
  let word = "Add a party";
  let rating = "none";
  if (thresholds.size) {
    if (result.monsterCount === 0) {
      word = "Empty";
      rating = "empty";
    } else {
      word = WORDS[result.rating];
      rating = result.rating;
    }
  }
  const math = !thresholds.size || result.monsterCount === 0
    ? ""
    : result.multiplier === 1
      ? `${formatXp(result.adjusted)} XP`
      : `${formatXp(result.adjusted)} adjusted XP · ${formatXp(result.raw)} × ${result.multiplier}`;
  const bands = thresholds.size
    ? `Easy ${formatXp(thresholds.easy)} · Medium ${formatXp(thresholds.medium)} · Hard ${formatXp(thresholds.hard)} · Deadly ${formatXp(thresholds.deadly)}`
    : "Seat the party and the budget appears.";
  const width = thresholds.size && thresholds.deadly > 0
    ? Math.min(100, (result.adjusted / thresholds.deadly) * 100)
    : 0;
  const creatures = state.monsters
    .map((monster) => `${monster.name} ${monster.count} × ${formatXp(monster.xp)}`)
    .join(" · ");

  mount.dataset.rating = rating;
  mount.replaceChildren(...present([
    h("p", { class: "verdict" }, word),
    math ? h("p", { class: "math" }, math) : null,
    result.shift ? h("p", { class: "hint" }, SHIFT[result.shift]) : null,
    h("div", { class: "bar", "data-rating": rating }, [
      h("span", { class: "bar-fill", style: `width: ${width}%` }),
    ]),
    h("p", { class: "bands" }, partyLabel() ? `${partyLabel()} · ${bands}` : bands),
    creatures ? h("p", { class: "bands" }, creatures) : null,
  ]));
  if (reveal) document.getElementById("threat-summary").scrollIntoView({ block: "start" });
}

function addHeroes(form, times) {
  const level = readInt(form.elements.level, 3, 1, 20);
  const name = form.elements.name.value.trim().slice(0, 80);
  const room = 8 - state.party.length;
  const count = Math.min(times, room);
  if (count < 1) {
    showError("hero", "The table seats 8.");
    return;
  }
  for (let i = 0; i < count; i += 1) {
    state.party.push({ id: uid(), name: times === 1 ? name : "", level });
  }
  showError("hero", count < times ? `Added ${count}. The table seats 8.` : "");
  if (times === 1) {
    form.elements.name.value = "";
    form.elements.name.focus();
  }
  persist();
  renderParty();
  renderThreat({ reveal: true });
}

function addMonster(form) {
  const name = form.elements.name.value.trim().slice(0, 80);
  if (!name) {
    showError("monster", "Name the creature.");
    form.elements.name.focus();
    return;
  }
  if (form.elements.xp.value.trim() === "") {
    showError("monster", "Add the experience, or pick a challenge rating.");
    return;
  }
  if (state.monsters.length >= 12) {
    showError("monster", "Twelve groups is the limit.");
    return;
  }
  state.monsters.push({
    id: uid(),
    name,
    count: readInt(form.elements.count, 1, 1, 40),
    xp: readInt(form.elements.xp, 0, 0, 2000000),
  });
  showError("monster", "");
  form.elements.name.value = "";
  form.elements.name.focus();
  persist();
  renderMonsters();
  renderThreat({ reveal: true });
}

function removeHero(id) {
  state.party = state.party.filter((hero) => hero.id !== id);
  persist();
  renderParty();
  renderThreat({ reveal: true });
}

function removeMonster(id) {
  state.monsters = state.monsters.filter((monster) => monster.id !== id);
  persist();
  renderMonsters();
  renderThreat({ reveal: true });
}

function cardBody(card) {
  if (card.lines?.length) {
    return h("dl", {}, card.lines.flatMap(([label, value]) => [
      h("dt", {}, label),
      h("dd", {}, value),
    ]));
  }
  return h("p", {}, card.body);
}

function sparkCard(spark, latest) {
  const inner = spark.kind === "scene"
    ? spark.cards.map((card) => h("section", { class: "scene-part" }, [
      h("p", { class: "kicker" }, card.kind === "person" ? card.title : KIND_LABEL[card.kind]),
      cardBody(card),
    ]))
    : [cardBody(spark)];
  return h("article", { class: latest ? "card is-latest" : "card" }, [
    h("header", { class: "card-head" }, [
      h("h3", {}, spark.title),
      h("button", { type: "button", class: "text-btn", "data-action": "copy-spark", "data-id": spark.id }, "Copy"),
      h("button", { type: "button", class: "text-btn", "data-action": "dismiss-spark", "data-id": spark.id }, "Dismiss"),
    ]),
    ...inner,
  ]);
}

function renderSparks() {
  const mount = document.getElementById("spark-list");
  if (!state.sparks.length) {
    mount.replaceChildren(h("p", { class: "empty" }, "The table is quiet. Draw a prompt."));
    return;
  }
  mount.replaceChildren(...state.sparks.map((spark, index) => sparkCard(spark, index === 0)));
}

function addSpark(card) {
  state.sparks.unshift({ id: uid(), ...card });
  state.sparks = state.sparks.slice(0, 8);
  setText(document.getElementById("spark-live"), sparkText(state.sparks[0]));
  persist();
  renderSparks();
}

async function copySpark(id, button) {
  const spark = state.sparks.find((item) => item.id === id);
  if (!spark) return;
  const label = button.textContent;
  try {
    await navigator.clipboard.writeText(sparkText(spark));
    button.textContent = "Copied";
  } catch {
    button.textContent = "Copy failed";
  }
  setTimeout(() => {
    button.textContent = label;
  }, 1200);
}

function noteIfOut(light, spec, now) {
  if (light.endsAt <= now && !announcedOut.has(light.id)) {
    announcedOut.add(light.id);
    setText(document.getElementById("flame-live"), `${spec.label} is out.`);
  }
}

function renderFlames() {
  const mount = document.getElementById("flames");
  const now = Date.now();
  if (!state.lights.length) {
    flameSignature = "";
    mount.replaceChildren();
    return;
  }
  const signature = state.lights.map((light) => `${light.id}:${light.kind}:${light.covered}`).join("|");
  if (signature === flameSignature) {
    for (const light of state.lights) {
      const spec = findLight(light.kind);
      const article = mount.querySelector(`[data-flame="${CSS.escape(light.id)}"]`);
      if (!article || !spec) continue;
      const out = light.endsAt <= now;
      article.classList.toggle("is-out", out);
      setText(article.querySelector(".flame-time"), formatRemaining(light.endsAt - now));
      const snuffButton = article.querySelector("[data-action='snuff']");
      if (snuffButton) setText(snuffButton, out ? "Clear" : "Snuff");
      noteIfOut(light, spec, now);
    }
    return;
  }
  flameSignature = signature;
  const nodes = state.lights.map((light) => {
    const spec = findLight(light.kind);
    const out = light.endsAt <= now;
    noteIfOut(light, spec, now);
    return h("article", { class: out ? "flame is-out" : "flame", "data-flame": light.id }, [
      h("div", {}, [
        h("p", { class: "flame-name" }, spec.label),
        h("p", { class: "flame-caption" }, lightCaption(spec, light.covered)),
      ]),
      h("p", { class: "flame-time" }, formatRemaining(light.endsAt - now)),
      spec.hoodDim != null
        ? h("button", {
          type: "button",
          class: "text-btn",
          "data-action": "hood",
          "data-id": light.id,
        }, light.covered ? "Raise hood" : "Lower hood")
        : null,
      h("button", {
        type: "button",
        class: "text-btn",
        "data-action": "snuff",
        "data-id": light.id,
      }, out ? "Clear" : "Snuff"),
    ]);
  });
  mount.replaceChildren(...nodes);
}

function strike(form) {
  if (state.lights.length >= 8) {
    showError("light", "Eight flames is enough to track.");
    return;
  }
  const spec = findLight(form.elements.kind.value);
  if (!spec) return;
  state.lights.unshift({
    id: uid(),
    kind: spec.id,
    endsAt: Date.now() + spec.minutes * 60 * 1000,
    covered: false,
  });
  showError("light", "");
  persist();
  renderFlames();
}

function toggleHood(id) {
  const light = state.lights.find((item) => item.id === id);
  if (!light || light.kind !== "hooded") return;
  light.covered = !light.covered;
  persist();
  renderFlames();
}

function snuff(id) {
  state.lights = state.lights.filter((light) => light.id !== id);
  announcedOut.delete(id);
  persist();
  renderFlames();
}

function fillSelects() {
  const tray = document.getElementById("dice-tray");
  tray.replaceChildren(...STANDARD_SIDES.map((sides) => h("button", {
    type: "button",
    class: "die",
    "data-action": "set-sides",
    "data-sides": String(sides),
    "aria-label": `Roll a d${sides}`,
  }, `d${sides}`)));
  const levels = document.querySelector("#hero-form select[name='level']");
  levels.replaceChildren(...levelOptions(3));
  const cr = document.querySelector("#monster-form select[name='cr']");
  cr.replaceChildren(
    h("option", { value: "" }, "Set XP from challenge"),
    ...CR_XP.map(([rating, xp]) => h("option", { value: String(xp) }, `CR ${rating} · ${formatXp(xp)} XP`)),
  );
  const kinds = document.querySelector("#light-form select[name='kind']");
  kinds.replaceChildren(...LIGHTS.map((spec) => {
    const option = h("option", { value: spec.id }, lightOptionLabel(spec));
    if (spec.id === "torch") option.selected = true;
    return option;
  }));
}

function applyLoaded() {
  document.getElementById("dice-count").value = String(state.dice.count);
  document.getElementById("dice-mod").value = String(state.dice.modifier);
  document.getElementById("notes").value = state.notes;
  showTab(state.tab, { save: false });
  paintDice();
  if (state.dice.history[0]) renderStoredResult(state.dice.history[0]);
  else renderIdleResult();
  renderHistory();
  renderCombat();
  renderParty();
  renderMonsters();
  renderThreat();
  renderSparks();
  renderFlames();
}

function resetAll() {
  const ok = window.confirm("Clear the fight, the party, the flames, the prompts, and the scratch notes stored in this browser?");
  if (!ok) return;
  clearState();
  openMarksId = null;
  announcedOut.clear();
  state = normalize(null);
  document.getElementById("combatant-form").reset();
  document.getElementById("hero-form").reset();
  document.getElementById("monster-form").reset();
  fillSelects();
  applyLoaded();
  persist();
}

function onClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action } = button.dataset;
  if (action === "tab") showTab(button.dataset.tab);
  else if (action === "roll") doRoll();
  else if (action === "set-sides") {
    state.dice.sides = Number(button.dataset.sides);
    doRoll();
  } else if (action === "set-mode") {
    state.dice.mode = button.dataset.mode;
    paintDice();
    persist();
  } else if (action === "clear-rolls") {
    state.dice.history = [];
    persist();
    paintDice();
    renderIdleResult();
    renderHistory();
  } else if (action === "hp") bumpHp(button.dataset.id, Number(button.dataset.delta));
  else if (action === "reroll") rerollOne(button.dataset.id);
  else if (action === "reroll-all") rerollAll();
  else if (action === "remove-combatant") removeCombatant(button.dataset.id);
  else if (action === "next") stepTurn(1);
  else if (action === "back") stepTurn(-1);
  else if (action === "seat-four") addHeroes(document.getElementById("hero-form"), 4);
  else if (action === "remove-hero") removeHero(button.dataset.id);
  else if (action === "remove-monster") removeMonster(button.dataset.id);
  else if (action === "hood") toggleHood(button.dataset.id);
  else if (action === "snuff") snuff(button.dataset.id);
  else if (action === "draw") addSpark(draw(button.dataset.kind));
  else if (action === "draw-scene") addSpark(drawScene());
  else if (action === "copy-spark") copySpark(button.dataset.id, button);
  else if (action === "dismiss-spark") {
    state.sparks = state.sparks.filter((spark) => spark.id !== button.dataset.id);
    persist();
    renderSparks();
  } else if (action === "reset") resetAll();
}

function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (form.dataset.form === "combatant") addCombatant(form);
  else if (form.dataset.form === "hero") addHeroes(form, 1);
  else if (form.dataset.form === "monster") addMonster(form);
  else if (form.dataset.form === "light") strike(form);
}

function onInput(event) {
  const target = event.target;
  if (target.id === "notes") {
    state.notes = target.value.slice(0, 4000);
    persist();
    return;
  }
  if (target.id === "dice-count" || target.id === "dice-mod") {
    const count = looseInt(target.id === "dice-count" ? target.value : state.dice.count);
    const modifier = looseInt(target.id === "dice-mod" ? target.value : state.dice.modifier);
    if (target.id === "dice-count" && count != null && count >= 1 && count <= 40) state.dice.count = count;
    if (target.id === "dice-mod" && modifier != null && modifier >= -100 && modifier <= 100) state.dice.modifier = modifier;
    paintDice();
    persist();
    return;
  }
  const { field, id } = target.dataset;
  if (!field || !id) return;
  if (field === "hero-name") {
    const hero = state.party.find((item) => item.id === id);
    if (hero) hero.name = target.value.slice(0, 80);
    persist();
    return;
  }
  if (field === "monster-name") {
    const monster = state.monsters.find((item) => item.id === id);
    const name = target.value.slice(0, 80);
    if (!monster || !name.trim()) return;
    monster.name = name;
    persist();
    renderThreat();
    return;
  }
  if (field === "monster-count" || field === "monster-xp") {
    const monster = state.monsters.find((item) => item.id === id);
    const n = looseInt(target.value);
    if (!monster || n == null) return;
    if (field === "monster-count" && n >= 1 && n <= 40) monster.count = n;
    if (field === "monster-xp" && n >= 0 && n <= 2000000) monster.xp = n;
    persist();
    renderThreat();
    return;
  }
  if (field === "combat-name") {
    const person = findCombatant(id);
    const name = target.value.slice(0, 80);
    if (!person || !name.trim()) return;
    person.name = name;
    persist();
    renderBanner();
    return;
  }
  if (field === "hp" || field === "maxhp") {
    const person = findCombatant(id);
    const n = looseInt(target.value);
    if (!person || n == null || n < 0 || n > 9999) return;
    if (field === "hp") {
      person.hp = n;
      target.closest(".combatant")?.classList.toggle("is-down", n <= 0);
    } else person.maxHp = n;
    persist();
  } else if (field === "ac") {
    const person = findCombatant(id);
    if (!person) return;
    if (target.value.trim() === "") {
      person.ac = null;
      persist();
      return;
    }
    const n = looseInt(target.value);
    if (n != null && n >= 0 && n <= 40) {
      person.ac = n;
      persist();
    }
  }
}

function onChange(event) {
  const target = event.target;
  if (target.name === "cr" && target.form?.dataset.form === "monster") {
    if (target.value !== "") target.form.elements.xp.value = target.value;
    return;
  }
  const { field, id } = target.dataset;
  if (!field || !id) return;
  if (field === "hero-level") {
    const hero = state.party.find((item) => item.id === id);
    if (!hero) return;
    hero.level = readInt(target, hero.level, 1, 20);
    persist();
    renderThreat();
  } else if (field === "init") {
    const person = findCombatant(id);
    if (!person) return;
    person.init = readInt(target, person.init, -100, 200);
    person.die = null;
    persist();
    renderCombat();
  } else if (field === "mark") {
    const person = findCombatant(id);
    if (!person || !MARKS.includes(target.dataset.mark)) return;
    person.marks = person.marks.filter((mark) => mark !== target.dataset.mark);
    if (target.checked) person.marks.push(target.dataset.mark);
    person.marks.sort((a, b) => MARKS.indexOf(a) - MARKS.indexOf(b));
    openMarksId = id;
    persist();
    renderCombat();
  } else if (field === "hp" || field === "maxhp" || field === "ac" || field === "combat-name") {
    const person = findCombatant(id);
    if (!person) return;
    if (field === "combat-name") {
      const name = target.value.trim().slice(0, 80);
      if (!name) target.value = person.name;
      else {
        person.name = name;
        target.value = name;
      }
      persist();
      renderBanner();
      return;
    }
    if (field === "ac" && target.value.trim() === "") {
      person.ac = null;
      persist();
      return;
    }
    if (field === "hp") person.hp = readInt(target, person.hp, 0, 9999);
    if (field === "maxhp") person.maxHp = readInt(target, person.maxHp, 0, 9999);
    if (field === "ac") person.ac = readInt(target, person.ac ?? 10, 0, 40);
    persist();
    renderCombat();
  } else if (field === "monster-count" || field === "monster-xp") {
    const monster = state.monsters.find((item) => item.id === id);
    if (!monster) return;
    if (field === "monster-count") monster.count = readInt(target, monster.count, 1, 40);
    if (field === "monster-xp") monster.xp = readInt(target, monster.xp, 0, 2000000);
    persist();
    renderThreat();
  }
}

function onToggle(event) {
  const details = event.target.closest?.("details[data-marks]");
  if (!details) return;
  openMarksId = details.open ? details.dataset.marks : null;
}

function onKey(event) {
  if (event.target.closest("input, textarea, select, button")) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const tabs = { 1: "dice", 2: "order", 3: "threat", 4: "spark" };
  if (tabs[event.key]) {
    event.preventDefault();
    showTab(tabs[event.key]);
  } else if (event.key === "r" && state.tab === "dice") {
    event.preventDefault();
    doRoll();
  } else if (event.key === "n" && state.tab === "order") {
    event.preventDefault();
    stepTurn(1);
  }
}

function boot() {
  fillSelects();
  for (const light of state.lights) {
    if (light.endsAt <= Date.now()) announcedOut.add(light.id);
  }
  const before = state.combat.activeId;
  if (!state.combat.started) state.combat.activeId = null;
  ensureActive();
  applyLoaded();
  if (state.combat.activeId !== before) persist();
  document.body.addEventListener("click", onClick);
  document.body.addEventListener("submit", onSubmit);
  document.body.addEventListener("input", onInput);
  document.body.addEventListener("change", onChange);
  document.body.addEventListener("toggle", onToggle, true);
  document.addEventListener("keydown", onKey);
  document.body.addEventListener("wheel", (event) => {
    if (event.target.type === "number" && document.activeElement === event.target) event.target.blur();
  }, { passive: true });
  setInterval(renderFlames, 1000);
}

boot();
