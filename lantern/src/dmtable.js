// DM screen: running the table, safety, and prep. The spotlight, a session
// start, pause, mood, chat control, seats, table rules, lines and veils, the
// X-card history, the next session, the notebook file, the session log, and
// screen layouts.

import { spotlight, sessionLog, downloadText } from "./session.js";
import { postBoard, postTalk } from "./table.js";
import { replaceStory, storyNotebook } from "./dmstory.js";

const LAYOUT_KEY = "lantern.dm.layouts";
const SINCE_MS = 6 * 60 * 60 * 1000;
let hooks = null;

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

const when = (ms) => new Date(ms).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });

async function board(body, done = "") {
  try {
    const result = await postBoard(hooks.code(), body, hooks.token());
    if (done) hooks.status(done);
    await hooks.refresh();
    return result;
  } catch (error) {
    hooks.status(error.message);
    return null;
  }
}

function filled(form, name, value) {
  const field = form?.elements[name];
  if (field && document.activeElement !== field) field.value = value;
}

// --- Layouts ------------------------------------------------------------------

export const DEFAULT_LAYOUTS = [
  { name: "Combat", module: "order", feed: "rolls" },
  { name: "Roleplay", module: "story", feed: "table" },
  { name: "Shopping", module: "shop", feed: "all" },
];

export function loadLayouts() {
  try {
    const list = JSON.parse(localStorage.getItem(LAYOUT_KEY) || "null");
    if (Array.isArray(list) && list.length) return list.filter((item) => item?.name).slice(0, 6);
  } catch { /* fall through to the defaults */ }
  return DEFAULT_LAYOUTS;
}

function paintLayouts() {
  const mount = document.getElementById("dm-layouts");
  if (!mount) return;
  mount.replaceChildren(...loadLayouts().map((layout, index) => h("button", {
    type: "button",
    class: "chip",
    "data-layout": String(index),
    title: `Opens ${layout.module || "no module"} with the ${layout.feed} feed`,
  }, layout.name)));
}

function saveLayout(name, module, feed) {
  const list = loadLayouts().filter((item) => item.name.toLowerCase() !== name.toLowerCase());
  list.push({ name: name.slice(0, 24), module, feed });
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(list.slice(-6))); } catch { /* kept for this page */ }
  paintLayouts();
}

// --- Painting -----------------------------------------------------------------

function paintSpotlight(room) {
  const mount = document.getElementById("dm-spotlight");
  if (!mount) return;
  const rows = spotlight(room, Date.now() - SINCE_MS);
  const top = rows[rows.length - 1]?.total || 1;
  mount.replaceChildren(...(rows.length ? rows.map((row, index) => h("div", { class: `spot-row${index === 0 && rows.length > 1 ? " is-quiet" : ""}` }, [
    h("span", { class: "spot-name" }, row.name),
    h("span", { class: "spot-bar" }, [h("span", { class: "spot-fill", style: `width: ${Math.round((row.total / top) * 100)}%` })]),
    h("span", { class: "hint" }, `${row.talk} said · ${row.acts} done`),
  ])) : [h("p", { class: "empty" }, "No one is seated.")]));
}

function paintSeats(room) {
  const mount = document.getElementById("dm-seats");
  if (!mount || mount.contains(document.activeElement)) return;
  mount.replaceChildren(...((room?.players || []).length ? room.players.map((player) => h("div", { class: "gear-row seat-row" }, [
    h("span", {}, player.name),
    h("input", { "aria-label": `New name for ${player.name}`, maxlength: "40", placeholder: "New name", "data-seat-new": player.name }),
    h("button", { type: "button", class: "text-btn", "data-seat": "seat-rename", "data-name": player.name }, "Rename"),
    h("button", { type: "button", class: "text-btn", "data-seat": "seat-link", "data-name": player.name }, "Move to a new device"),
    h("button", { type: "button", class: "text-btn danger", "data-seat": "seat-kick", "data-name": player.name }, "Remove"),
  ])) : [h("p", { class: "empty" }, "No one is seated.")]));
}

function paintState(room) {
  const b = room?.board;
  if (!b) return;
  const pause = document.getElementById("dm-pause");
  if (pause) pause.textContent = b.pause ? "Resume the table" : "Pause every seat";
  setPressed("[data-mood]", (node) => node.dataset.mood === (b.mood?.label || ""));
  setPressed("[data-chat]", (node) => node.dataset.chat === (b.chat?.mode || "open"));
  const xlog = document.getElementById("dm-xlog");
  if (xlog) {
    xlog.replaceChildren(...(b.xlog?.length ? [...b.xlog].reverse().map((at) => h("p", {}, `Tapped ${when(at)}`)) : [h("p", { class: "empty" }, "Nobody has tapped the X-card. Lantern never records who did.")]));
  }
  filled(document.getElementById("dm-rules-form"), "text", b.rules || "");
  filled(document.getElementById("dm-safety-form"), "lines", (b.safety?.lines || []).join("\n"));
  filled(document.getElementById("dm-safety-form"), "veils", (b.safety?.veils || []).join("\n"));
  const next = document.getElementById("dm-next-now");
  if (next) next.textContent = b.next ? `Players see: ${[b.next.label, b.next.at ? new Date(b.next.at).toLocaleString() : ""].filter(Boolean).join(", ")}` : "No next session is set.";
  const leader = document.getElementById("dm-poll-leader");
  if (leader) {
    const options = b.poll?.options || [];
    const best = [...options].sort((x, y) => y.votes.length - x.votes.length)[0];
    leader.hidden = !best || !best.votes.length;
    if (best) leader.textContent = `Use the poll: ${best.label} (${best.votes.length})`;
    leader.dataset.label = best?.label || "";
  }
}

function setPressed(selector, test) {
  for (const node of document.querySelectorAll(selector)) node.setAttribute("aria-pressed", test(node) ? "true" : "false");
}

/** Called after each poll. */
export function paintTableModule(room) {
  if (!document.getElementById("module-table")?.open) return;
  paintSpotlight(room);
  paintSeats(room);
  paintState(room);
}

// --- Actions ------------------------------------------------------------------

async function sessionStart() {
  const room = hooks.room();
  const recap = document.getElementById("dm-recap")?.value.trim();
  const stop = storyNotebook().scenes.find((scene) => scene.id === storyNotebook().stopAt);
  const text = recap || (stop ? `Last time, we stopped at: ${stop.title}.` : "");
  if (text) await board({ op: "handout", title: "Last time", text }, "");
  await board({ op: "ready-call" });
  const open = (room?.board?.quests || []).filter((quest) => !quest.done && !quest.hidden).map((quest) => quest.title);
  try {
    await postTalk(hooks.code(), { text: open.length ? `Open quests: ${open.join("; ")}.`.slice(0, 400) : "Welcome back. No quests are open yet.", kind: "ooc" }, hooks.token());
  } catch (error) {
    hooks.status(error.message);
    return;
  }
  hooks.status("The session has started: recap, ready check, and open quests are out.");
  await hooks.refresh();
}

async function seatAction(op, name) {
  if (op === "seat-kick" && !confirm(`Remove ${name} from the table? Their seat link stops working.`)) return;
  if (op === "seat-rename") {
    const field = document.querySelector(`[data-seat-new="${CSS.escape(name)}"]`);
    const to = field?.value.trim();
    if (!to) {
      hooks.status("Write the new name first.");
      return;
    }
    await board({ op, name, to }, `${name} is now ${to}.`);
    return;
  }
  const result = await board({ op, name }, op === "seat-kick" ? `${name} has left the table.` : "");
  if (op === "seat-link" && result?.token) {
    const url = `${location.origin}/player.html?room=${hooks.code()}&seat=${result.token}&name=${encodeURIComponent(name)}`;
    const out = document.getElementById("dm-seat-link");
    if (out) {
      out.hidden = false;
      out.replaceChildren(
        h("p", {}, `Open this on ${name}'s new device. It sits them back in their own seat. Share it only with them.`),
        h("input", { readonly: true, value: url, class: "seat-link-field", "aria-label": `Seat link for ${name}` }),
      );
      out.querySelector("input")?.select();
    }
  }
}

function exportNotebook() {
  const file = { lantern: 1, kind: "notebook", story: storyNotebook(), prep: hooks.prep() };
  downloadText(JSON.stringify(file, null, 2), "lantern-notebook.json", "application/json");
}

async function importNotebook(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data?.lantern !== 1 || data.kind !== "notebook") throw new Error("That is not a Lantern notebook file.");
    replaceStory(data.story);
    if (data.prep) hooks.setPrep(data.prep);
    hooks.status("The notebook is back.");
  } catch (error) {
    hooks.status(error.message || "That file did not read.");
  }
}

function exportLog() {
  const hours = Number(document.getElementById("dm-log-since")?.value) || 6;
  const room = { ...hooks.room(), code: hooks.code() };
  const text = sessionLog(room, Date.now() - hours * 60 * 60 * 1000, { title: `Lantern session at ${hooks.code()}` });
  downloadText(text, `lantern-session-${new Date().toISOString().slice(0, 10)}.md`, "text/markdown");
}

function onClick(event) {
  const t = event.target;
  const seat = t.closest("[data-seat]");
  if (seat) return void seatAction(seat.dataset.seat, seat.dataset.name);
  const mood = t.closest("[data-mood]");
  if (mood) return void board({ op: "mood", label: mood.dataset.mood }, mood.dataset.mood ? `Mood: ${mood.dataset.mood}.` : "Mood cleared.");
  const chat = t.closest("[data-chat]");
  if (chat) return void board({ op: "chat-mode", mode: chat.dataset.chat, slow: Number(document.getElementById("dm-slow")?.value) || 30 }, chat.dataset.chat === "open" ? "Table talk is open." : chat.dataset.chat === "slow" ? "Slow chat is on." : "Table talk is paused.");
  const id = t.closest("button")?.id;
  if (id === "dm-pause") {
    const on = !hooks.room()?.board?.pause;
    return void board({ op: "pause", on, text: document.getElementById("dm-pause-text")?.value || "" }, on ? "Every seat is paused." : "The table is back.");
  }
  if (id === "dm-start") return void sessionStart();
  if (id === "dm-xlog-clear") return void board({ op: "xlog-clear" }, "The X-card history is cleared.");
  if (id === "dm-poll-leader") return void board({ op: "next", label: t.dataset.label, at: hooks.room()?.board?.next?.at || 0 }, "The poll result is the next session.");
  if (id === "dm-next-clear") return void board({ op: "next", label: "", at: 0 }, "No next session is set.");
  if (id === "dm-export-notebook") return exportNotebook();
  if (id === "dm-export-log") return exportLog();
}

/** hooks: code, token, room, status, refresh, prep, setPrep, openModule(name), setFeed(name). */
export function bootTable(next) {
  hooks = next;
  paintLayouts();
  const module = document.getElementById("module-table");
  module?.addEventListener("toggle", () => paintTableModule(hooks.room()));
  module?.addEventListener("click", onClick);
  document.getElementById("dm-rules-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void board({ op: "rules", text: event.target.elements.text.value }, "The table rules are on every seat.");
  });
  document.getElementById("dm-safety-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void board({ op: "safety", lines: event.target.elements.lines.value, veils: event.target.elements.veils.value }, "Lines and veils are on every seat.");
  });
  document.getElementById("dm-next-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const at = form.elements.at.value ? new Date(form.elements.at.value).getTime() : 0;
    void board({ op: "next", at, label: form.elements.label.value }, "Players can see the next session and add it to their calendar.");
  });
  document.getElementById("dm-notebook-file")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) void importNotebook(file);
    event.target.value = "";
  });
  document.getElementById("dm-layouts")?.addEventListener("click", (event) => {
    const chip = event.target.closest("[data-layout]");
    if (!chip) return;
    const layout = loadLayouts()[Number(chip.dataset.layout)];
    if (!layout) return;
    hooks.setFeed(layout.feed || "all");
    if (layout.module) hooks.openModule(layout.module);
  });
  document.getElementById("dm-layout-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.target;
    const name = form.elements.name.value.trim();
    if (!name) return;
    saveLayout(name, form.elements.module.value, form.elements.feed.value);
    form.reset();
    hooks.status(`${name} is a layout button now.`);
  });
  document.getElementById("dm-layout-reset")?.addEventListener("click", () => {
    try { localStorage.removeItem(LAYOUT_KEY); } catch { /* nothing kept */ }
    paintLayouts();
  });
}
