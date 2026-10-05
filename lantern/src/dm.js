import { presentCharacter } from "./character.js";
import { formatXp, rateEncounter } from "./encounter.js";
import { findLight, formatRemaining, lightCaption } from "./lights.js";
import { KIND_LABEL } from "./oracle.js";
import { normalize } from "./store.js";
import { createRoom, describeSetup, fetchRoom, normalizeCode } from "./table.js";

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

function threatBlock(snapshot) {
  const result = rateEncounter({
    levels: snapshot.party.map((hero) => hero.level),
    groups: snapshot.monsters.map((monster) => ({ count: monster.count, xp: monster.xp })),
  });
  const party = snapshot.party.length
    ? snapshot.party.map((hero) => `${hero.name || "Unnamed"} ${hero.level}`).join(", ")
    : "No party seated.";
  const creatures = snapshot.monsters.length
    ? snapshot.monsters.map((monster) => `${monster.count} × ${monster.name} (${formatXp(monster.xp)} XP)`).join(" · ")
    : "No creatures.";
  const verdict = result.rating ? WORDS[result.rating] : "No budget yet";
  const math = result.monsterCount
    ? `${formatXp(result.adjusted)} adjusted XP · ${formatXp(result.raw)} × ${result.multiplier}`
    : "";
  return h("div", { class: "stack" }, [
    h("p", {}, math ? `${verdict} · ${math}` : verdict),
    h("p", { class: "hint" }, party),
    h("p", { class: "hint" }, creatures),
  ]);
}

function sparkBlock(sparks) {
  if (!sparks.length) return h("p", { class: "hint" }, "No prompts.");
  return h("div", { class: "stack" }, sparks.map((spark) => {
    if (spark.kind === "scene") {
      return h("div", {}, [
        h("p", {}, "Scene"),
        ...spark.cards.map((card) => h("p", { class: "hint" }, `${card.title}: ${card.lines?.map((pair) => pair.join(" ")).join(" · ") || card.body}`)),
      ]);
    }
    const lines = spark.lines?.length
      ? spark.lines.map((pair) => pair.join(": ")).join(" · ")
      : spark.body;
    return h("p", {}, `${KIND_LABEL[spark.kind] || spark.title}: ${lines}`);
  }));
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
      h("h3", {}, "Threat"),
      threatBlock(snapshot),
    ]),
    h("section", { class: "board-block" }, [
      h("h3", {}, "Spark"),
      sparkBlock(snapshot.sparks),
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
  const playerUrl = `${location.origin}/?room=${code}`;
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
  const initial = normalizeCode(new URLSearchParams(location.search).get("room"));
  if (initial.length === 4) showTable(initial);
  setInterval(() => { void poll(); }, 1000);
}

boot();
