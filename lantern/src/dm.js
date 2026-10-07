import { ABILITIES, SKILLS, abilityMod, abilityTotals, formatMod, presentCharacter } from "./character.js";
import { CR_XP, formatXp, rateEncounter } from "./encounter.js";
import { findLight, formatRemaining, lightCaption } from "./lights.js";
import { draw, drawScene, KIND_LABEL, sparkText } from "./oracle.js";
import {
  featuredEvent,
  feedKind,
  heroInOrder,
  lightTone,
  naturalTag,
  partyLevels,
  passiveSummary,
  skilledSummary,
} from "./screen.js";
import { counterFor, findOffer, formatCoin, parseCoin, stallById, STALLS } from "./gear.js";
import { normalize } from "./store.js";
import { DM_NAME, createRoom, describeSetup, fetchRoom, normalizeCode, postTalk, setShop } from "./table.js";
import { paintTalk, paintTargets } from "./talk.js";
import { bootTextSize } from "./textsize.js";

const WORDS = {
  trivial: "Trivial",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  deadly: "Deadly",
};

const FEED_LABEL = { all: "All", rolls: "Rolls", table: "The rest" };
const AWAY_MS = 20000;
const NOTE_CAP = 4000;
const NOTE_ROOMS = 20;

let code = "";
let playerUrl = "";
let signature = "";
let openName = "";
let lastRoom = null;
let seenEvent = "";
let freshTimer = 0;
let shopFormCode = "";
let codeBig = false;

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

function soonestLight(lights) {
  if (!lights.length) return null;
  return [...lights].sort((a, b) => a.endsAt - b.endsAt)[0];
}

function feedRow(event) {
  const natural = naturalTag(event.summary);
  return h("article", { class: natural ? `feed-row ${natural}` : "feed-row" }, [
    h("p", { class: "feed-name" }, event.name),
    h("p", { class: "feed-summary" }, event.summary),
    h("p", { class: "feed-time" }, clock(event.at)),
  ]);
}

function markChips(marks, tag = "p") {
  if (!marks.length) return null;
  return h(tag, { class: "mark-row" }, marks.map((mark) => h("span", {
    class: mark === "concentrating" ? "mark-chip is-concentrating" : "mark-chip",
  }, mark)));
}

function presence(player, tag = "p") {
  const away = Date.now() - player.seen > AWAY_MS;
  return h(tag, {
    class: away ? "away-flag is-away" : "away-flag",
    "data-seen": String(player.seen),
  }, away ? "Away" : "Here");
}

function lightLine(light, now, tag = "p") {
  const spec = findLight(light.kind);
  if (!spec) return null;
  const remaining = light.endsAt - now;
  const tone = lightTone(remaining);
  const toneClass = tone === "steady" ? "" : ` is-${tone}`;
  return h(tag, { class: `light-row${toneClass}`, "data-ends": String(light.endsAt) }, [
    `${spec.label} · ${lightCaption(spec, light.covered)} · `,
    h("span", { class: "dm-time" }, formatRemaining(remaining)),
  ]);
}

function diceBlock(history) {
  if (!history.length) return h("p", { class: "hint" }, "No rolls yet.");
  const [latest, ...rest] = history;
  const tag = latest.tag || "";
  return h("div", { class: "stack" }, [
    h("p", { class: tag ? `roll-total ${tag}` : "roll-total" }, String(latest.total)),
    h("p", {}, [
      latest.purpose ? `${latest.purpose} · ` : "",
      latest.formula,
      latest.detail ? ` · ${latest.detail}` : "",
      tag === "natural-20" ? " · Natural 20" : tag === "natural-1" ? " · Natural 1" : "",
    ].join("")),
    rest.length ? h("div", { class: "stack" }, rest.map((item) => h("p", { class: "hint" }, [
      item.purpose ? `${item.purpose}: ` : "",
      `${item.total} · ${item.formula}`,
      item.detail ? ` · ${item.detail}` : "",
      item.tag === "natural-20" ? " · Natural 20" : item.tag === "natural-1" ? " · Natural 1" : "",
    ].join("")))) : null,
  ]);
}

function orderBlock(combat) {
  const list = turnOrder(combat.combatants);
  if (!list.length) return h("p", { class: "hint" }, "No one is in the order.");
  const who = list.find((person) => person.id === combat.activeId);
  const started = combat.started || combat.round > 1;
  const round = started
    ? `Round ${combat.round}${who ? ` · ${who.name}'s turn` : ""}`
    : "The order has not started.";
  return h("div", { class: "stack" }, [
    h("p", { class: "hint" }, round),
    h("div", { class: "dm-order" }, list.map((person) => {
      const active = person.id === combat.activeId && started;
      const down = person.hp <= 0;
      const ac = person.ac == null ? "AC —" : `AC ${person.ac}`;
      return h("article", { class: `dm-person${active ? " is-active" : ""}${down ? " is-down" : ""}` }, [
        h("p", { class: "dm-init" }, String(person.init)),
        h("div", {}, [
          h("p", {}, person.name),
          markChips(person.marks),
        ]),
        h("p", { class: "vitals" }, `${person.hp}/${person.maxHp} · ${ac}${down ? " · Down" : ""}`),
      ]);
    })),
  ]);
}

function lightBlock(lights) {
  if (!lights.length) return h("p", { class: "hint" }, "No lights.");
  const now = Date.now();
  return h("div", { class: "stack" }, lights.map((light) => lightLine(light, now)));
}

function abilityRow(character) {
  const totals = abilityTotals(character);
  return h("div", { class: "score-row" }, ABILITIES.map((ability) => {
    const total = totals[ability.id];
    return h("p", { class: "score-cell" }, [
      h("strong", {}, ability.short),
      h("b", {}, String(total)),
      ` ${formatMod(abilityMod(total))}`,
    ]);
  }));
}

function characterBlock(character) {
  const view = presentCharacter(character);
  if (!view) return h("p", { class: "hint" }, "No character yet.");
  const skills = skilledSummary(character);
  return h("div", { class: "stack" }, [
    h("p", {}, view.title),
    h("p", { class: "hint" }, view.meta),
    abilityRow(character),
    h("p", {}, passiveSummary(character)),
    view.saves ? h("p", { class: "hint" }, `Saves: ${view.saves}.`) : null,
    view.hp ? h("p", {}, view.hp) : null,
    skills ? h("p", {}, skills) : null,
    view.coin ? h("p", {}, view.coin) : null,
    view.carried ? h("p", {}, view.carried) : null,
    view.languages ? h("p", { class: "hint" }, view.languages) : null,
    view.traits ? h("pre", { class: "dm-note" }, view.traits) : null,
  ]);
}

function seatCard(player) {
  const snapshot = normalize(player.snapshot);
  const view = presentCharacter(snapshot.character);
  const hero = heroInOrder(snapshot.combat.combatants, [snapshot.character.name, player.name]);
  const started = snapshot.combat.started || snapshot.combat.round > 1;
  const active = Boolean(hero && started && hero.id === snapshot.combat.activeId);
  const down = Boolean(hero && hero.hp <= 0);
  const open = player.name === openName;
  const now = Date.now();
  const light = soonestLight(snapshot.lights);
  const classes = ["seat-card"];
  if (open) classes.push("is-open");
  if (active) classes.push("is-active");
  if (down) classes.push("is-down");
  const vitals = hero
    ? `${hero.hp}/${hero.maxHp} · ${hero.ac == null ? "AC —" : `AC ${hero.ac}`} · Init ${hero.init}`
    : "";
  return h("button", {
    type: "button",
    class: classes.join(" "),
    "data-seat": player.name,
    "aria-pressed": open ? "true" : "false",
  }, [
    h("span", { class: "seat-top" }, [
      h("span", { class: "seat-name" }, player.name),
      presence(player, "span"),
    ]),
    h("span", { class: "hint" }, view ? view.title : "No character yet."),
    vitals ? h("span", { class: "vitals" }, vitals) : null,
    active ? h("span", { class: "their-turn" }, "Their turn") : null,
    down ? h("span", { class: "down-flag" }, "Down") : null,
    passiveSummary(snapshot.character) ? h("span", {}, passiveSummary(snapshot.character)) : null,
    hero ? markChips(hero.marks, "span") : null,
    light ? lightLine(light, now, "span") : null,
    h("span", { class: "hint" }, `Set for ${describeSetup(snapshot.dice, player.intent)}`),
  ]);
}

function dossier(player, events) {
  const snapshot = normalize(player.snapshot);
  const latest = events.find((event) => event.name === player.name);
  return h("article", {}, [
    h("header", { class: "player-head" }, [
      h("h2", {}, player.name),
      presence(player),
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

const DM_KEY = "lantern.dm.v1";

function blankTools() {
  return {
    sparks: [],
    levels: "1, 1, 1, 1",
    groups: [{ id: crypto.randomUUID(), name: "", count: 1, cr: "1/4" }],
    prepareOpen: false,
    feed: "all",
    notes: {},
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

function cleanNotes(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const notes = {};
  for (const [room, text] of Object.entries(raw).slice(-NOTE_ROOMS)) {
    const key = normalizeCode(room);
    if (key.length < 4 || typeof text !== "string") continue;
    notes[key] = text.slice(0, NOTE_CAP);
  }
  return notes;
}

function loadTools() {
  try {
    const raw = JSON.parse(localStorage.getItem(DM_KEY) || "null");
    if (!raw || typeof raw !== "object") return blankTools();
    const groups = Array.isArray(raw.groups) ? raw.groups.map(cleanGroup).filter(Boolean).slice(0, 12) : [];
    const feed = raw.feed === "rolls" || raw.feed === "table" ? raw.feed : "all";
    return {
      sparks: Array.isArray(raw.sparks) ? raw.sparks.slice(0, 8) : [],
      levels: typeof raw.levels === "string" ? raw.levels.slice(0, 80) : "1, 1, 1, 1",
      groups: groups.length ? groups : blankTools().groups,
      prepareOpen: raw.prepareOpen === true,
      feed,
      notes: cleanNotes(raw.notes),
    };
  } catch {
    return blankTools();
  }
}

let tools = loadTools();

function saveTools() {
  localStorage.setItem(DM_KEY, JSON.stringify(tools));
}

function rememberNotes(text) {
  if (!code) return;
  const notes = { ...tools.notes };
  delete notes[code];
  notes[code] = text.slice(0, NOTE_CAP);
  const keys = Object.keys(notes);
  while (keys.length > NOTE_ROOMS) delete notes[keys.shift()];
  tools.notes = notes;
  saveTools();
}

function partyLevelText(players) {
  const levels = partyLevels(players.map((player) => normalize(player.snapshot).character));
  return levels.join(", ");
}

function creaturePhrase(groups) {
  return groups
    .filter((group) => group.name.trim())
    .map((group) => `${group.count} ${group.name.trim()}`)
    .join(", ");
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
  const levels = String(tools.levels || "")
    .split(/[^0-9]+/)
    .map((part) => Number(part))
    .filter((level) => Number.isInteger(level) && level >= 1 && level <= 30)
    .slice(0, 12);
  const groups = tools.groups.map((group) => ({ count: group.count, xp: CR_XP.find(([id]) => id === group.cr)?.[1] ?? 10 }));
  const result = rateEncounter({ levels, groups });
  const verdict = result.rating ? WORDS[result.rating] : "Add the party's levels.";
  const named = creaturePhrase(tools.groups);
  const math = result.monsterCount
    ? `${formatXp(result.adjusted)} adjusted XP · ${formatXp(result.raw)} × ${result.multiplier}`
    : "No creatures yet.";
  const easy = result.thresholds.size
    ? `Easy ${formatXp(result.thresholds.easy)} · Medium ${formatXp(result.thresholds.medium)} · Hard ${formatXp(result.thresholds.hard)} · Deadly ${formatXp(result.thresholds.deadly)}`
    : "";
  mount.replaceChildren(...[
    h("p", { class: "threat-verdict", "data-rating": result.rating || "" }, verdict),
    named ? h("p", {}, named) : null,
    h("p", {}, math),
    easy ? h("p", { class: "hint" }, easy) : null,
  ].filter(Boolean));
}

function paintPartyLevels(players) {
  const hint = document.getElementById("party-level-hint");
  const button = document.getElementById("use-party");
  if (!hint || !button) return;
  const text = partyLevelText(players);
  if (!text) {
    hint.textContent = "No finished sheets at the table yet.";
    button.hidden = true;
    return;
  }
  hint.textContent = `Seated heroes: level ${text}.`;
  button.hidden = false;
  button.dataset.levels = text;
}

function paintFeedFilter(counts) {
  for (const button of document.querySelectorAll("[data-feed]")) {
    const kind = button.dataset.feed;
    button.setAttribute("aria-pressed", kind === tools.feed ? "true" : "false");
    if (counts && Object.hasOwn(counts, kind)) button.textContent = `${FEED_LABEL[kind]} · ${counts[kind]}`;
  }
}

function paintNotes() {
  const notes = document.getElementById("dm-notes");
  if (!notes || document.activeElement === notes) return;
  notes.value = tools.notes[code] || "";
}

function paintTools() {
  const levels = document.getElementById("dm-levels");
  if (levels && document.activeElement !== levels) levels.value = tools.levels;
  const prepare = document.getElementById("dm-prepare");
  if (prepare) prepare.open = tools.prepareOpen;
  renderDmSpark();
  renderDmGroups();
  renderDmThreat();
  paintFeedFilter();
  paintNotes();
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
  document.getElementById("dm-prepare")?.addEventListener("toggle", () => {
    tools.prepareOpen = document.getElementById("dm-prepare").open;
    saveTools();
  });
  document.getElementById("use-party")?.addEventListener("click", () => {
    const text = document.getElementById("use-party").dataset.levels || "";
    if (!text) return;
    tools.levels = text;
    saveTools();
    const levels = document.getElementById("dm-levels");
    if (levels) levels.value = text;
    renderDmThreat();
  });
  document.getElementById("dm-notes")?.addEventListener("input", (event) => {
    rememberNotes(event.target.value);
  });
  paintTools();
}

function filteredEvents(events) {
  if (tools.feed === "rolls") return events.filter((event) => feedKind(event.summary) === "roll");
  if (tools.feed === "table") return events.filter((event) => feedKind(event.summary) !== "roll");
  return events;
}

function emptyFeed() {
  if (tools.feed === "rolls") return "No rolls yet.";
  if (tools.feed === "table") return "No other news yet.";
  return "Nothing has happened since this table opened.";
}

function paintLatest(events) {
  const node = document.getElementById("latest-call");
  if (!node) return;
  const event = featuredEvent(events);
  if (!event) {
    node.hidden = true;
    seenEvent = "";
    return;
  }
  node.hidden = false;
  if (event.id === seenEvent) return;
  seenEvent = event.id;
  const tag = naturalTag(event.summary);
  const base = `latest-call${tag ? ` ${tag}` : ""}`;
  node.className = `${base} is-fresh`;
  clearTimeout(freshTimer);
  freshTimer = setTimeout(() => { node.className = base; }, 2500);
  const kicker = feedKind(event.summary) === "roll" ? "Last roll" : "Just now";
  node.replaceChildren(
    h("p", { class: "latest-kicker" }, kicker),
    h("p", { class: "latest-line" }, [
      h("strong", {}, event.name),
      ` ${event.summary}`,
    ]),
  );
}

function renderRoom(room) {
  lastRoom = room;
  const names = room.players.map((player) => player.name);
  if (!names.includes(openName)) openName = names[0] || "";
  const focusSeat = document.activeElement?.dataset?.seat || "";
  const feed = document.getElementById("dm-feed");
  const scroll = feed.scrollTop;
  const counts = {
    all: room.events.length,
    rolls: room.events.filter((event) => feedKind(event.summary) === "roll").length,
    table: room.events.filter((event) => feedKind(event.summary) !== "roll").length,
  };
  const shown = filteredEvents(room.events);
  document.getElementById("feed-list").replaceChildren(
    ...(shown.length ? shown.map(feedRow) : [h("p", { class: "hint" }, emptyFeed())]),
  );
  paintFeedFilter(counts);
  const strip = document.getElementById("party-strip");
  strip.replaceChildren(...(room.players.length
    ? room.players.map(seatCard)
    : [h("p", { class: "empty" }, "No one has joined. Read them the code.")]));
  const chosen = room.players.find((player) => player.name === openName);
  const dossierMount = document.getElementById("dm-dossier");
  if (!chosen) dossierMount.hidden = true;
  else {
    dossierMount.hidden = false;
    dossierMount.replaceChildren(dossier(chosen, room.events));
  }
  feed.scrollTop = scroll;
  paintLatest(room.events);
  paintPartyLevels(room.players);
  paintCodeSize(room.players.length);
  if (focusSeat) document.querySelector(`[data-seat="${CSS.escape(focusSeat)}"]`)?.focus({ preventScroll: true });
  tickTimes();
}

function paintCodeSize(seated) {
  const box = document.getElementById("dm-command");
  const toggle = document.getElementById("toggle-code");
  if (!box || !toggle) return;
  const compact = seated > 0 && !codeBig;
  box.classList.toggle("is-compact", compact);
  toggle.hidden = seated === 0;
  toggle.textContent = compact ? "Show the code big" : "Shrink the code";
}

function tickTimes() {
  const now = Date.now();
  for (const node of document.querySelectorAll("[data-ends]")) {
    const remaining = Number(node.dataset.ends) - now;
    const time = node.querySelector(".dm-time");
    if (time) time.textContent = formatRemaining(remaining);
    const tone = lightTone(remaining);
    node.classList.toggle("is-low", tone === "low");
    node.classList.toggle("is-out", tone === "out");
  }
  let here = 0;
  let away = 0;
  for (const node of document.querySelectorAll("[data-seen]")) {
    const isAway = now - Number(node.dataset.seen) > AWAY_MS;
    node.textContent = isAway ? "Away" : "Here";
    node.classList.toggle("is-away", isAway);
    if (node.closest(".seat-card")) {
      if (isAway) away += 1;
      else here += 1;
    }
  }
  const count = document.getElementById("dm-count");
  if (!count) return;
  const seated = here + away;
  count.textContent = seated ? (away ? `${here} here · ${away} away` : `${here} here`) : "";
}

function setStatus(message) {
  const status = document.getElementById("dm-status");
  if (status) status.textContent = message;
}

async function copyText(text, button) {
  const previous = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.left = "-1000px";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
  button.textContent = "Copied";
  setTimeout(() => { button.textContent = previous; }, 1200);
}

function paintGoods(goods) {
  const mount = document.getElementById("shop-goods");
  mount.replaceChildren(...goods.map((good) => h("div", { class: "shop-good" }, [
    h("label", {}, [
      h("input", { type: "checkbox", "data-good": good.id, checked: good.on !== false }),
      h("span", {}, good.name),
    ]),
    h("input", {
      type: "text",
      "data-price": good.id,
      value: formatCoin(good.cp),
      "aria-label": `Price for ${good.name}`,
      spellcheck: "false",
    }),
  ])));
}

function fillShopForm(shop) {
  const select = document.getElementById("shop-stall");
  select.replaceChildren(...STALLS.map((stall) => h("option", { value: stall.id }, stall.name)));
  const published = shop && typeof shop === "object" ? shop : null;
  const stallId = published?.stall && stallById(published.stall) ? published.stall : "market";
  select.value = stallId;
  const base = counterFor(stallId);
  const priced = new Map((published?.goods || []).map((good) => [good.id, good]));
  const usePublished = Boolean(published && Array.isArray(published.goods));
  document.getElementById("shop-name").value = published?.name || base.name;
  document.getElementById("shop-hint").textContent = stallById(stallId).hint;
  paintGoods(base.goods.map((good) => {
    const saved = priced.get(good.id);
    return {
      ...good,
      cp: saved ? saved.cp : good.cp,
      on: usePublished ? Boolean(saved) : true,
    };
  }));
}

function ensureShopForm(room) {
  const editing = document.getElementById("dm-shop-panel")?.contains(document.activeElement);
  if (shopFormCode !== code && !editing) {
    shopFormCode = code;
    fillShopForm(room.shop);
  }
}

function paintShopLive(room) {
  const shop = room.shop;
  const open = shop !== false && (typeof shop !== "object" || shop.open !== false);
  const name = shop && typeof shop === "object" && shop.name ? shop.name : "the market";
  const live = document.getElementById("shop-live");
  if (live) live.textContent = open ? `Players see ${name}.` : "The shop is closed.";
  const summary = document.getElementById("shop-summary");
  if (summary) summary.textContent = open ? `· open, ${name}` : "· closed";
  const box = document.getElementById("dm-shop");
  if (box && document.activeElement !== box) box.checked = open;
}

function readCounter(open) {
  const stall = document.getElementById("shop-stall").value;
  const known = stallById(stall);
  const goods = [];
  for (const box of document.querySelectorAll("[data-good]")) {
    if (!box.checked) continue;
    const offer = findOffer(box.dataset.good);
    if (!offer) continue;
    const price = document.querySelector(`[data-price="${CSS.escape(offer.id)}"]`);
    const cp = parseCoin(price?.value);
    goods.push({
      id: offer.id,
      name: offer.name,
      cp: cp == null ? offer.cp : cp,
      service: offer.service === true,
    });
  }
  return {
    open,
    stall,
    name: document.getElementById("shop-name").value.trim() || known?.name || "Shop",
    goods,
  };
}

async function publishCounter(open) {
  if (!code) return;
  try {
    await setShop(code, readCounter(open));
    signature = "";
    const box = document.getElementById("dm-shop");
    if (box) box.checked = open;
    setStatus(open ? "That shop is open." : "The counter is closed.");
    await poll();
  } catch (error) {
    setStatus(error.message);
  }
}

async function poll() {
  if (!code) return;
  let room;
  try {
    room = await fetchRoom(code, DM_NAME);
  } catch (error) {
    setStatus(error.message);
    return;
  }
  if (!room) {
    setStatus("No table with that code.");
    return;
  }
  setStatus("");
  paintShopLive(room);
  ensureShopForm(room);
  const next = JSON.stringify(room);
  if (next === signature) return;
  signature = next;
  renderRoom(room);
  paintTalk(document.getElementById("dm-talk-log"), room.messages || []);
  paintTargets(
    document.getElementById("dm-talk-to"),
    (room.players || []).map((player) => player.name),
    DM_NAME,
  );
}

function chooseSeat(name) {
  if (!lastRoom || !lastRoom.players.some((player) => player.name === name)) return;
  openName = name;
  renderRoom(lastRoom);
  document.getElementById("dm-dossier")?.scrollIntoView({ block: "nearest" });
}

function cycleSeat(step) {
  if (!lastRoom?.players.length) return;
  const names = lastRoom.players.map((player) => player.name);
  const index = Math.max(0, names.indexOf(openName));
  chooseSeat(names[(index + step + names.length) % names.length]);
}

function showTable(next) {
  code = normalizeCode(next);
  signature = "";
  seenEvent = "";
  openName = "";
  shopFormCode = "";
  const url = new URL(location.href);
  url.searchParams.set("room", code);
  history.replaceState(null, "", url);
  document.getElementById("gate").hidden = true;
  document.getElementById("dm-main").hidden = false;
  document.getElementById("room-code").textContent = code;
  const link = document.getElementById("player-link");
  playerUrl = `${location.origin}/player.html?room=${code}`;
  link.href = playerUrl;
  link.textContent = playerUrl;
  paintNotes();
  void poll();
}

function boot() {
  bootTextSize(document.getElementById("text-size"));
  document.getElementById("toggle-code")?.addEventListener("click", () => {
    codeBig = !codeBig;
    paintCodeSize(lastRoom?.players.length || 0);
  });
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
  const askList = document.getElementById("ask-options");
  if (askList) {
    const names = [
      ...SKILLS.map((skill) => skill.label),
      "Initiative",
      ...ABILITIES.map((ability) => `${ability.label} save`),
      ...ABILITIES.map((ability) => `${ability.label} check`),
    ];
    askList.replaceChildren(...names.map((name) => h("option", { value: name })));
  }
  document.getElementById("dm-ask-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!code) return;
    const field = document.getElementById("dm-ask");
    const ask = field.value.trim();
    if (!ask) {
      setStatus("Name the roll first, like Perception.");
      return;
    }
    const to = document.getElementById("dm-talk-to").value;
    try {
      await postTalk(code, { name: DM_NAME, text: `Roll ${ask}.`, to, ask });
      field.value = "";
      setStatus(to ? `Asked ${to} for ${ask}.` : `Asked the table for ${ask}.`);
      signature = "";
      await poll();
    } catch (error) {
      setStatus(error.message);
    }
  });
  document.getElementById("dm-talk-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!code) return;
    const field = document.getElementById("dm-talk-text");
    const text = field.value.trim();
    if (!text) {
      setStatus("Write a message first.");
      return;
    }
    try {
      await postTalk(code, {
        name: DM_NAME,
        text,
        to: document.getElementById("dm-talk-to").value,
      });
      field.value = "";
      signature = "";
      await poll();
    } catch (error) {
      setStatus(error.message);
    }
  });
  document.getElementById("shop-stall").addEventListener("change", (event) => {
    const counter = counterFor(event.target.value);
    document.getElementById("shop-name").value = counter.name;
    document.getElementById("shop-hint").textContent = stallById(counter.stall).hint;
    paintGoods(counter.goods.map((good) => ({ ...good, on: true })));
  });
  document.getElementById("shop-open").addEventListener("click", () => {
    void publishCounter(true);
  });
  document.getElementById("dm-shop").addEventListener("change", async (event) => {
    if (!code) return;
    const open = event.target.checked;
    const published = lastRoom && typeof lastRoom.shop === "object" ? lastRoom.shop : null;
    const body = published ? { ...published, open } : { open };
    try {
      await setShop(code, body);
      signature = "";
      setStatus(open ? "The counter is open." : "The counter is closed.");
    } catch (error) {
      event.target.checked = !open;
      setStatus(error.message);
    }
  });
  document.getElementById("copy-code").addEventListener("click", () => {
    if (code) void copyText(code, document.getElementById("copy-code"));
  });
  document.getElementById("copy-link").addEventListener("click", () => {
    if (playerUrl) void copyText(playerUrl, document.getElementById("copy-link"));
  });
  document.getElementById("dm-feed").addEventListener("click", (event) => {
    const button = event.target.closest("[data-feed]");
    if (!button) return;
    tools.feed = button.dataset.feed === "rolls" || button.dataset.feed === "table" ? button.dataset.feed : "all";
    saveTools();
    if (lastRoom) renderRoom(lastRoom);
  });
  document.getElementById("party-strip").addEventListener("click", (event) => {
    const card = event.target.closest("[data-seat]");
    if (card) chooseSeat(card.dataset.seat);
  });
  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const tag = event.target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || event.target?.isContentEditable) return;
    if (event.key === "?") {
      event.preventDefault();
      document.getElementById("keys-dialog")?.showModal();
      return;
    }
    if (!code) return;
    if (event.key === "c" || event.key === "C") {
      event.preventDefault();
      void copyText(code, document.getElementById("copy-code"));
    } else if (event.key === "[") cycleSeat(-1);
    else if (event.key === "]") cycleSeat(1);
  });
  document.getElementById("open-keys")?.addEventListener("click", () => document.getElementById("keys-dialog").showModal());
  document.getElementById("close-keys")?.addEventListener("click", () => document.getElementById("keys-dialog").close());
  const initial = normalizeCode(new URLSearchParams(location.search).get("room"));
  if (initial.length === 4) showTable(initial);
  bootTools();
  setInterval(() => { void poll(); }, 1000);
}

boot();
