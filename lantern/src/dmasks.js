// DM screen: calling rolls. A DC shown or hidden, group checks, contested
// rolls against a monster, presets, rolling for an away player, and passives.

import { ABILITIES, askBonus, cleanCharacter, passiveScore, SKILLS } from "./character.js";
import { askVerdict, groupVerdict, monsterBonus } from "./combat.js";
import { roll } from "./dice.js";
import { normalize } from "./store.js";
import { postBoard, postTalk } from "./table.js";

const ASK_KEY = "lantern.dm.asks";
const PRESET_KEY = "lantern.dm.presets";
const ASK_CAP = 10;
const PRESET_CAP = 12;
const PASSIVES = [["perception", "Perception"], ["investigation", "Investigation"], ["insight", "Insight"]];
let hooks = null;
let asks = [];
let lastRoom = null;

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

const signed = (n) => (n >= 0 ? `+${n}` : `${n}`);

function read(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "null");
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* kept for this page */ }
}

function askKey() {
  return `${ASK_KEY}.${hooks?.code() || "none"}`;
}

function loadAsks() {
  const list = read(askKey(), []);
  asks = Array.isArray(list) ? list.filter((item) => typeof item?.id === "string").slice(-ASK_CAP) : [];
}

function saveAsks() {
  write(askKey(), asks.slice(-ASK_CAP));
}

export function loadPresets() {
  const list = read(PRESET_KEY, []);
  return (Array.isArray(list) ? list : [])
    .filter((item) => typeof item?.ask === "string" && item.ask.trim())
    .slice(0, PRESET_CAP);
}

function presetLabel(preset) {
  return `${preset.ask}${Number.isInteger(preset.dc) ? ` DC ${preset.dc}${preset.hidden ? " (hidden)" : ""}` : ""}`;
}

function paintPresets() {
  const mount = document.getElementById("dm-ask-presets");
  if (!mount) return;
  const presets = loadPresets();
  mount.replaceChildren(...presets.map((preset, index) => h("span", { class: "preset" }, [
    h("button", { type: "button", class: "chip", "data-ask-preset": String(index) }, presetLabel(preset)),
    h("button", { type: "button", class: "text-btn", "data-ask-preset-remove": String(index), "aria-label": `Forget ${presetLabel(preset)}` }, "×"),
  ])));
}

function readForm() {
  const ask = document.getElementById("dm-ask").value.trim();
  const dcRaw = document.getElementById("dm-ask-dc").value.trim();
  const dc = /^\d+$/.test(dcRaw) && Number(dcRaw) >= 1 && Number(dcRaw) <= 40 ? Number(dcRaw) : null;
  const hidden = document.getElementById("dm-ask-hide").checked;
  const against = document.getElementById("dm-ask-against").value;
  return { ask, dc, hidden, against };
}

function playerCharacter(name) {
  const player = (lastRoom?.players || []).find((item) => item.name === name);
  return player ? normalize(player.snapshot).character : null;
}

async function sendAsk() {
  const { ask, dc, hidden, against } = readForm();
  if (!ask) {
    hooks.status("Name the roll first, like Perception.");
    return;
  }
  const to = document.getElementById("dm-talk-to").value;
  let contest = null;
  if (against) {
    const person = hooks.order().combatants.find((item) => item.id === against);
    if (person) {
      const bonus = monsterBonus(person, ask);
      const die = roll({ count: 1, sides: 20 }).kept[0];
      contest = { name: person.name, total: die + bonus, die, bonus };
    }
  }
  const shownDc = dc && !hidden && !contest ? dc : null;
  const text = `Roll ${ask}${shownDc ? ` (DC ${shownDc})` : ""}${contest ? `, against ${contest.name}` : ""}.`;
  const result = await postTalk(hooks.code(), { text, to, ask, dc: shownDc }, hooks.token());
  const id = result?.message?.id || result?.id;
  if (!id) throw new Error("The table did not keep that ask.");
  asks.push({ id, ask, to, dc, hidden, against: contest, at: Date.now() });
  saveAsks();
  document.getElementById("dm-ask").value = "";
  hooks.status(to ? `Asked ${to} for ${ask}.` : `Asked the table for ${ask}.`);
  await hooks.refresh();
}

function answerFor(ask, name) {
  return (lastRoom?.events || []).find((event) => event.ask === ask.id && event.name === name) || null;
}

function askCard(ask) {
  const names = ask.to ? [ask.to] : (lastRoom?.players || []).map((player) => player.name);
  const totals = [];
  const rows = names.map((name) => {
    const answer = answerFor(ask, name);
    const total = Number.isInteger(answer?.total) ? answer.total : null;
    if (total !== null) totals.push(total);
    const verdict = askVerdict({ total, dc: ask.dc, against: ask.against?.total ?? null });
    return h("li", { class: verdict ? `ask-answer is-${verdict}` : "ask-answer" }, total !== null ? [
      h("strong", {}, name),
      ` ${total}${answer.by ? " (rolled by you)" : ""}`,
      verdict ? h("span", { class: "tag" }, verdict) : null,
    ] : [
      h("strong", {}, name),
      " waiting ",
      h("button", { type: "button", class: "text-btn", "data-ask-for": ask.id, "data-name": name }, "Roll for them"),
    ]);
  });
  const group = !ask.against && names.length > 1 ? groupVerdict(totals, ask.dc) : "";
  return h("article", { class: "ask-card" }, [
    h("div", { class: "ask-card-head" }, [
      h("strong", {}, ask.ask),
      ask.dc ? h("span", { class: "tag" }, `DC ${ask.dc}${ask.hidden ? ", hidden" : ""}`) : null,
      h("span", { class: "hint" }, ask.to ? `to ${ask.to}` : "to the table"),
      h("button", { type: "button", class: "text-btn", "data-ask-drop": ask.id }, "Done"),
    ]),
    ask.against ? h("p", { class: "hint" }, `${ask.against.name} rolled ${ask.against.total} (${ask.against.die}${signed(ask.against.bonus)}).`) : null,
    h("ul", { class: "ask-answers" }, rows),
    group ? h("p", { class: "ask-group" }, group) : null,
  ]);
}

function paintCards() {
  const mount = document.getElementById("dm-ask-cards");
  if (!mount) return;
  mount.replaceChildren(...[...asks].reverse().slice(0, 5).map(askCard));
}

function paintAgainst() {
  const select = document.getElementById("dm-ask-against");
  if (!select || document.activeElement === select) return;
  const current = select.value;
  const monsters = hooks.order().combatants.filter((person) => !person.seat);
  select.replaceChildren(
    h("option", { value: "" }, "No one"),
    ...monsters.map((person) => h("option", { value: person.id }, person.name)),
  );
  if (monsters.some((person) => person.id === current)) select.value = current;
}

/** Passive scores for every seat, against an optional DC. */
export function passiveRows(players, dc) {
  return (players || []).map((player) => {
    const character = cleanCharacter(normalize(player.snapshot).character);
    if (!character.touched) return null;
    const scores = PASSIVES.map(([id, label]) => ({ id, label, score: passiveScore(character, id) }));
    return { name: character.name || player.name, scores, notices: Number.isInteger(dc) ? scores.filter((item) => item.score >= dc).map((item) => item.label) : [] };
  }).filter(Boolean);
}

function paintPassives() {
  const mount = document.getElementById("dm-passive-list");
  if (!mount) return;
  const raw = document.getElementById("dm-passive-dc")?.value.trim();
  const dc = /^\d+$/.test(raw || "") ? Number(raw) : null;
  const rows = passiveRows(lastRoom?.players, dc);
  mount.replaceChildren(...(rows.length ? rows.map((row) => h("p", { class: row.notices.length ? "passive-row is-noticed" : "passive-row" }, [
    h("strong", {}, row.name),
    " ",
    row.scores.map((item) => `${item.label} ${item.score}`).join(" · "),
    " ",
    dc !== null ? h("span", { class: "tag" }, row.notices.length ? `notices by ${row.notices.join(", ")}` : "misses it") : null,
  ])) : [h("p", { class: "empty" }, "Passives show once a hero is seated.")]));
}

async function rollFor(askId, name) {
  const ask = asks.find((item) => item.id === askId);
  if (!ask) return;
  const character = playerCharacter(name);
  const info = character ? askBonus(character, ask.ask) : null;
  const bonus = info?.bonus ?? 0;
  const die = roll({ count: 1, sides: 20 }).kept[0];
  const total = die + bonus;
  await postBoard(hooks.code(), {
    op: "dm-roll",
    name,
    ask: ask.id,
    total,
    text: `The DM rolled ${info?.label || ask.ask} for ${name}: ${total} (${die}${signed(bonus)}).`,
  }, hooks.token());
  await hooks.refresh();
}

/** Called after each poll with the DM's view of the room. */
export function paintAsks(room) {
  lastRoom = room;
  paintCards();
  paintAgainst();
  paintPassives();
}

export function asksTableChanged() {
  loadAsks();
  paintCards();
}

/** hooks: code, token, order, status, refresh. */
export function bootAsks(next) {
  hooks = next;
  loadAsks();
  paintPresets();
  const list = document.getElementById("ask-options");
  if (list) {
    const names = [
      ...SKILLS.map((skill) => skill.label),
      "Initiative",
      ...ABILITIES.map((ability) => `${ability.label} save`),
      ...ABILITIES.map((ability) => `${ability.label} check`),
    ];
    list.replaceChildren(...names.map((name) => h("option", { value: name })));
  }
  document.getElementById("dm-ask-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!hooks.code()) return;
    try {
      await sendAsk();
    } catch (error) {
      hooks.status(error.message);
    }
  });
  document.getElementById("dm-ask-save")?.addEventListener("click", () => {
    const { ask, dc, hidden } = readForm();
    if (!ask) {
      hooks.status("Name the roll, then save it.");
      return;
    }
    const presets = loadPresets().filter((item) => presetLabel(item) !== presetLabel({ ask, dc, hidden }));
    presets.unshift({ ask, dc, hidden });
    write(PRESET_KEY, presets.slice(0, PRESET_CAP));
    paintPresets();
  });
  document.getElementById("dm-passive-dc")?.addEventListener("input", paintPassives);
  document.getElementById("dm-talk")?.addEventListener("click", async (event) => {
    const preset = event.target.closest("[data-ask-preset]");
    if (preset) {
      const chosen = loadPresets()[Number(preset.dataset.askPreset)];
      if (!chosen) return;
      document.getElementById("dm-ask").value = chosen.ask;
      document.getElementById("dm-ask-dc").value = Number.isInteger(chosen.dc) ? String(chosen.dc) : "";
      document.getElementById("dm-ask-hide").checked = chosen.hidden === true;
      document.getElementById("dm-ask").focus();
      return;
    }
    const forget = event.target.closest("[data-ask-preset-remove]");
    if (forget) {
      const presets = loadPresets();
      presets.splice(Number(forget.dataset.askPresetRemove), 1);
      write(PRESET_KEY, presets);
      paintPresets();
      return;
    }
    const drop = event.target.closest("[data-ask-drop]");
    if (drop) {
      asks = asks.filter((item) => item.id !== drop.dataset.askDrop);
      saveAsks();
      paintCards();
      return;
    }
    const forName = event.target.closest("[data-ask-for]");
    if (forName) {
      try {
        await rollFor(forName.dataset.askFor, forName.dataset.name);
      } catch (error) {
        hooks.status(error.message);
      }
    }
  });
}
