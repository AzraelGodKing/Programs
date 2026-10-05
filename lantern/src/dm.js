import { presentCharacter } from "./character.js";
import { CR_XP, formatXp, rateEncounter } from "./encounter.js";
import { findLight, formatRemaining, lightCaption } from "./lights.js";
import { draw, drawScene, KIND_LABEL, sparkText } from "./oracle.js";
import { normalize } from "./store.js";
import { createRoom, describeSetup, fetchRoom, normalizeCode, setShop } from "./table.js";

const WORDS = {
  trivial: "Trivial",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  deadly: "Deadly",
};

const AWAY_MS = 20000;
let code = "";
let signature = "";

function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function clock(ms) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

function turnOrder(combatants) {
  return [...combatants].sort((a, b) => b.init - a.init || a.order - b.order);
}

function feedRow(event) {
  const natural = event.summary.includes("Natural 20")
    ? "natural-20"
    : event.summary.includes("Natural 1")
      ? "natural-1"
      : "";
  return h("article", { class: natural ? `feed-row ${natural}` : "feed-row" }, [
    h("p", { class: "feed-name" }, event.name),
    h("p", { class: "feed-summary" }, event.summary),
    h("p", { class: "feed-time" }, clock(event.at)),
  ]);
}

function diceBlock(history) {
  if (!history.length) return h("p", { class: "hint" }, "No rolls yet.");
  return h("div", { class: "stack" }, history.map((item) => h("p", {}, [
    item.purpose ? `${item.purpose}: ` : "",
    `${item.total} · ${item.formula}`,
    item.detail ? ` · ${item.detail}` : "",
    item.tag === "natural-20" ? " · Natural 20" : item.tag === "natural-1" ? " · Natural 1" : "",
  ].join(""))));
}

function orderBlock(combat) {
  const list = turnOrder(combat.combatants);
  if (!list.length) return h("p", { class: "hint" }, "No one is in the order.");
  return h("div", { class: "stack" }, list.map((person) => {
    const active = person.id === combat.activeId;
    const down = person.hp <= 0;
    const ac = person.ac == null ? "" : ` · AC ${person.ac}`;
    const marks = person.marks.length ? ` · ${person.marks.join(", ")}` : "";
    const flag = down ? " · Down" : "";
    return h("p", { class: `dm-row${active ? " is-active" : ""}${down ? " is-down" : ""}` },
      `${person.init}  ${person.name}  ${person.hp}/${person.maxHp}${ac}${marks}${flag}`);
  }));
}

function lightBlock(lights) {
  if (!lights.length) return h("p", { class: "hint" }, "No lights.");
  const now = Date.now();
  return h("div", { class: "stack" }, lights.map((light) => {
    const spec = findLight(light.kind);
    if (!spec) return null;
    return h("p", {}, [
      `${spec.label} · ${lightCaption(spec, light.covered)} · `,
      h("span", { class: "dm-time", "data-ends": String(light.endsAt) }, formatRemaining(light.endsAt - now)),
    ]);
  }));
}

const DM_KEY = "lantern.dm.v1";

function blankTools() {
  return {
    sparks: [],
    levels: "1, 1, 1, 1",
    groups: [{ id: crypto.randomUUID(), name: "", count: 1, cr: "1/4" }],
  };
}

function cleanGroup(group) {
  if (!group || typeof group !== "object") return null;
  const cr = CR_XP.some(([id]) => id === group.cr) ? group.cr : "0";
  const count = Number(group.count);
  const name = typeof group.name === "string" ? group.name.slice(0, 80) : "";
  return {
    id: typeof group.id === "string" && group.id ? group.id.slice(0, 80) : crypto.randomUUID(),
    name,
    count: Number.isInteger(count) ? Math.min(40, Math.max(1, count)) : 1,
    cr,
  };
}

function loadTools() {
  try {
    const raw = JSON.parse(localStorage.getItem(DM_KEY) || "null");
    if (!raw || typeof raw !== "object") return blankTools();
    const groups = Array.isArray(raw.groups) ? raw.groups.map(cleanGroup).filter(Boolean).slice(0, 12) : [];
    return {
      sparks: Array.isArray(raw.sparks) ? raw.sparks.slice(0, 8) : [],
      levels: typeof raw.levels === "string" ? raw.levels.slice(0, 80) : "1, 1, 1, 1",
      groups: groups.length ? groups : blankTools().groups,
    };
  } catch {
    return blankTools();
  }
}

let tools = loadTools();

function saveTools() {
  localStorage.setItem(DM_KEY, JSON.stringify(tools));
}

function partyLevels(text) {
  return String(text || "")
    .split(/[^0-9]+/)
    .map((part) => Number(part))
    .filter((level) => Number.isInteger(level) && level >= 1 && level <= 30)
    .slice(0, 12);
}

function xpFor(cr) {
  return CR_XP.find(([id]) => id === cr)?.[1] ?? 10;
}

function renderDmSpark() {
  const mount = document.getElementById("dm-spark");
  if (!mount) return;
  if (!tools.sparks.length) {
    mount.replaceChildren(h("p", { class: "empty" }, "Draw a prompt when the room goes quiet."));
    return;
  }
  mount.replaceChildren(...tools.sparks.map((spark) => h("article", { class: "summary" }, [
    h("p", { class: "sheet-title" }, spark.title || KIND_LABEL[spark.kind] || "Prompt"),
    h("p", {}, sparkText(spark)),
  ])));
}

function renderDmGroups() {
  const mount = document.getElementById("dm-groups");
  if (!mount) return;
  mount.replaceChildren(...tools.groups.map((group) => h("div", { class: "gear-row" }, [
    h("input", {
      type: "text",
      "data-dm-field": "name",
      "data-id": group.id,
      value: group.name,
      maxlength: "80",
      placeholder: "Creature",
      "aria-label": "Creature name",
    }),
    h("input", {
      type: "number",
      "data-dm-field": "count",
      "data-id": group.id,
      value: String(group.count),
      min: "1",
      max: "40",
      "aria-label": "How many",
    }),
    h("select", { "data-dm-field": "cr", "data-id": group.id, "aria-label": "Challenge rating" }, CR_XP.map(([id, xp]) => (
      h("option", { value: id, selected: id === group.cr ? true : null }, `CR ${id} · ${formatXp(xp)}`)
    ))),
    h("button", { type: "button", class: "text-btn", "data-dm": "remove-group", "data-id": group.id }, "Remove"),
  ])));
}

function renderDmThreat() {
  const mount = document.getElementById("dm-threat");
  if (!mount) return;
  const levels = partyLevels(tools.levels);
  const groups = tools.groups.map((group) => ({ count: group.count, xp: xpFor(group.cr) }));
  const result = rateEncounter({ levels, groups });
  const verdict = result.rating ? WORDS[result.rating] : "Add the party's levels.";
  const math = result.monsterCount
    ? `${formatXp(result.adjusted)} adjusted XP · ${formatXp(result.raw)} × ${result.multiplier}`
    : "No creatures yet.";
  const easy = result.thresholds.size
    ? `Easy ${formatXp(result.thresholds.easy)} · Medium ${formatXp(result.thresholds.medium)} · Hard ${formatXp(result.thresholds.hard)} · Deadly ${formatXp(result.thresholds.deadly)}`
    : "";
  mount.replaceChildren(...[
    h("p", {}, `${verdict} · ${math}`),
    easy ? h("p", { class: "hint" }, easy) : null,
  ].filter(Boolean));
}

function paintTools() {
  const levels = document.getElementById("dm-levels");
  if (levels && document.activeElement !== levels) levels.value = tools.levels;
  renderDmSpark();
  renderDmGroups();
  renderDmThreat();
}

function onDmClick(event) {
  const button = event.target.closest("[data-dm]");
  if (!button) return;
  const kind = button.dataset.dm;
  if (kind === "draw") {
    tools.sparks.unshift(draw(button.dataset.kind));
    tools.sparks = tools.sparks.slice(0, 8);
  } else if (kind === "scene") {
    tools.sparks.unshift(drawScene());
    tools.sparks = tools.sparks.slice(0, 8);
  } else if (kind === "add-group") {
    tools.groups.push({ id: crypto.randomUUID(), name: "", count: 1, cr: "1/4" });
  } else if (kind === "remove-group") {
    tools.groups = tools.groups.filter((group) => group.id !== button.dataset.id);
    if (!tools.groups.length) tools.groups.push({ id: crypto.randomUUID(), name: "", count: 1, cr: "0" });
  } else return;
  saveTools();
  paintTools();
}

function onDmInput(event) {
  const target = event.target;
  if (target.id === "dm-levels") {
    tools.levels = target.value.slice(0, 80);
    saveTools();
    renderDmThreat();
    return;
  }
  const group = tools.groups.find((item) => item.id === target.dataset.id);
  const field = target.dataset.dmField;
  if (!field || !group) return;
  if (field === "name") group.name = target.value.slice(0, 80);
  else if (field === "count") {
    const count = Number(target.value);
    if (Number.isInteger(count)) group.count = Math.min(40, Math.max(1, count));
  } else if (field === "cr") group.cr = target.value;
  saveTools();
  renderDmThreat();
}

function bootTools() {
  const root = document.getElementById("dm-tools");
  if (!root) return;
  root.addEventListener("click", onDmClick);
  root.addEventListener("input", onDmInput);
  root.addEventListener("change", onDmInput);
  paintTools();
}

function characterBlock(character) {
  const view = presentCharacter(character);
  if (!view) return h("p", { class: "hint" }, "No character yet.");
  return h("div", { class: "stack" }, [
    h("p", {}, view.title),
    h("p", { class: "hint" }, view.meta),
    h("p", {}, view.abilities),
    view.saves ? h("p", { class: "hint" }, `Saves: ${view.saves}.`) : null,
    view.hp ? h("p", {}, view.hp) : null,
    view.coin ? h("p", {}, view.coin) : null,
    view.carried ? h("p", {}, view.carried) : null,
    view.skills ? h("p", {}, view.skills) : null,
    view.languages ? h("p", { class: "hint" }, view.languages) : null,
    view.traits ? h("pre", { class: "dm-note" }, view.traits) : null,
  ]);
}

function playerBoard(player, events) {
  const snapshot = normalize(player.snapshot);
  const latest = events.find((event) => event.name === player.name);
  const away = Date.now() - player.seen > AWAY_MS;
  return h("article", { class: "player-board" }, [
    h("header", { class: "player-head" }, [
      h("h2", {}, player.name),
      h("p", { class: away ? "away-flag is-away" : "away-flag", "data-seen": String(player.seen) }, away ? "Away" : "Here"),
    ]),
    h("p", {}, `Ready to roll ${describeSetup(snapshot.dice, player.intent)}`),
    latest ? h("p", { class: "hint" }, latest.summary) : null,
    h("section", { class: "board-block" }, [
      h("h3", {}, "Character"),
      characterBlock(snapshot.character),
    ]),
    h("section", { class: "board-block" }, [
      h("h3", {}, "Dice"),
      diceBlock(snapshot.dice.history),
    ]),
    h("section", { class: "board-block" }, [
      h("h3", {}, "Order"),
      orderBlock(snapshot.combat),
    ]),
    h("section", { class: "board-block" }, [
      h("h3", {}, "Light"),
      lightBlock(snapshot.lights),
    ]),
    h("section", { class: "board-block" }, [
      h("h3", {}, "Scratch"),
      h("pre", { class: "dm-note" }, snapshot.notes || "No notes."),
    ]),
  ]);
}

function renderRoom(room) {
  const feed = document.getElementById("dm-feed");
  const players = document.getElementById("player-list");
  feed.replaceChildren(
    h("h2", {}, "Just now"),
    ...(room.events.length
      ? room.events.map(feedRow)
      : [h("p", { class: "hint" }, "Nothing has happened since this table opened.")]),
  );
  players.replaceChildren(...(room.players.length
    ? room.players.map((player) => playerBoard(player, room.events))
    : [h("p", { class: "empty" }, "No one has joined. Share the code.")]));
}

function tickTimes() {
  const now = Date.now();
  for (const node of document.querySelectorAll("[data-ends]")) {
    node.textContent = formatRemaining(Number(node.dataset.ends) - now);
  }
  for (const node of document.querySelectorAll("[data-seen]")) {
    const away = now - Number(node.dataset.seen) > AWAY_MS;
    node.textContent = away ? "Away" : "Here";
    node.classList.toggle("is-away", away);
  }
}

function setStatus(message) {
  const status = document.getElementById("dm-status");
  if (status) status.textContent = message;
}

async function poll() {
  if (!code) return;
  let room;
  try {
    room = await fetchRoom(code);
  } catch (error) {
    setStatus(error.message);
    return;
  }
  if (!room) {
    setStatus("No table with that code.");
    return;
  }
  setStatus("");
  const shopBox = document.getElementById("dm-shop");
  if (shopBox && document.activeElement !== shopBox) shopBox.checked = room.shop !== false;
  const next = JSON.stringify(room);
  if (next === signature) return;
  signature = next;
  const feed = document.getElementById("dm-feed");
  const scroll = feed.scrollTop;
  renderRoom(room);
  document.getElementById("dm-feed").scrollTop = scroll;
  tickTimes();
}

function showTable(next) {
  code = normalizeCode(next);
  signature = "";
  const url = new URL(location.href);
  url.searchParams.set("room", code);
  history.replaceState(null, "", url);
  document.getElementById("gate").hidden = true;
  document.getElementById("dm-main").hidden = false;
  document.getElementById("room-code").textContent = code;
  const link = document.getElementById("player-link");
  const playerUrl = `${location.origin}/player.html?room=${code}`;
  link.href = playerUrl;
  link.textContent = playerUrl;
  void poll();
}

function boot() {
  document.getElementById("open-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const status = document.getElementById("gate-status");
    try {
      const room = await createRoom();
      showTable(room.code);
    } catch (error) {
      status.textContent = error.message;
    }
  });
  document.getElementById("watch-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const next = normalizeCode(document.getElementById("watch-code").value);
    if (next.length < 4) {
      document.getElementById("gate-status").textContent = "Table codes are four characters.";
      return;
    }
    showTable(next);
  });
  document.getElementById("dm-shop").addEventListener("change", async (event) => {
    if (!code) return;
    const open = event.target.checked;
    try {
      await setShop(code, open);
      signature = "";
    } catch (error) {
      event.target.checked = !open;
      setStatus(error.message);
    }
  });
  const initial = normalizeCode(new URLSearchParams(location.search).get("room"));
  if (initial.length === 4) showTable(initial);
  bootTools();
  setInterval(() => { void poll(); }, 1000);
}

boot();
