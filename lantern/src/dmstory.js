// DM screen: story and world. Handouts, read-aloud boxes, NPC cards, the
// glossary and quests with hidden entries, a session plan with content
// warnings, a random encounter table, and the weather and the hour.

import { hourText } from "./combat.js";
import { postBoard, postTalk } from "./table.js";

const STORY_KEY = "lantern.dm.story";
const LIST_CAP = 40;
const IMAGE_SIDE = 900;
const IMAGE_CHARS = 118_000;
let hooks = null;
let story = loadStory();

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

const uid = () => crypto.randomUUID();
const clip = (value, max) => String(value ?? "").trim().slice(0, max);

export function blankStory() {
  return { boxes: [], npcs: [], scenes: [], stopAt: "", encounters: [] };
}

/** Keeps a story notebook in shape, whatever was stored. */
export function cleanStory(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const list = (value, clean) => (Array.isArray(value) ? value : []).map(clean).filter(Boolean).slice(0, LIST_CAP);
  return {
    boxes: list(source.boxes, (box) => (box?.text ? { id: clip(box.id, 60) || uid(), title: clip(box.title, 80), text: clip(box.text, 3000), read: box.read === true } : null)),
    npcs: list(source.npcs, (npc) => (npc?.name ? { id: clip(npc.id, 60) || uid(), name: clip(npc.name, 80), voice: clip(npc.voice, 200), shown: clip(npc.shown, 600), secrets: clip(npc.secrets, 1500) } : null)),
    scenes: list(source.scenes, (scene) => (scene?.title ? { id: clip(scene.id, 60) || uid(), title: clip(scene.title, 120), warning: clip(scene.warning, 160), done: scene.done === true } : null)),
    stopAt: clip(source.stopAt, 60),
    encounters: list(source.encounters, (row) => (row?.text ? {
      id: clip(row.id, 60) || uid(),
      text: clip(row.text, 160),
      monster: clip(row.monster, 80),
      count: Math.max(1, Math.min(12, Math.floor(Number(row.count)) || 1)),
      weight: Math.max(1, Math.min(20, Math.floor(Number(row.weight)) || 1)),
    } : null)),
  };
}

/** Picks a row from the encounter table, each row as likely as its weight. */
export function rollEncounter(rows, rng = Math.random) {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  if (!total) return null;
  let pick = Math.floor(rng() * total);
  for (const row of rows) {
    if (pick < row.weight) return row;
    pick -= row.weight;
  }
  return rows[rows.length - 1];
}

/** The world after time passes. */
export function passTime(world, hours) {
  const base = world || { day: 1, hour: 8, weather: "" };
  const total = base.hour + hours;
  return { day: Math.min(9999, base.day + Math.floor(total / 24)), hour: ((total % 24) + 24) % 24, weather: base.weather || "" };
}

function loadStory() {
  try {
    return cleanStory(JSON.parse(localStorage.getItem(STORY_KEY) || "null"));
  } catch {
    return blankStory();
  }
}

export function saveStory() {
  try { localStorage.setItem(STORY_KEY, JSON.stringify(story)); } catch { /* kept for this page */ }
}

export function storyNotebook() {
  return story;
}

export function replaceStory(next) {
  story = cleanStory(next);
  saveStory();
  paintStory();
}

// --- Painting -----------------------------------------------------------------

function paintBoxes() {
  const mount = document.getElementById("dm-boxes");
  if (!mount) return;
  mount.replaceChildren(...(story.boxes.length ? story.boxes.map((box) => h("article", { class: box.read ? "read-box is-read" : "read-box" }, [
    h("p", { class: "sheet-title" }, box.title || "Read aloud"),
    h("p", { class: "read-text" }, box.text),
    h("div", { class: "turn-actions" }, [
      h("button", { type: "button", class: "btn primary", "data-story": "read", "data-id": box.id }, box.read ? "Read it again" : "Read it to the table"),
      h("button", { type: "button", class: "text-btn", "data-story": "box-remove", "data-id": box.id }, "Remove"),
    ]),
  ])) : [h("p", { class: "empty" }, "Write boxed text ahead of time, then reveal it with one tap.")]));
}

function paintNpcs() {
  const mount = document.getElementById("dm-npcs");
  if (!mount) return;
  mount.replaceChildren(...(story.npcs.length ? story.npcs.map((npc) => h("article", { class: "npc-card" }, [
    h("p", { class: "sheet-title" }, npc.name),
    npc.voice ? h("p", { class: "hint" }, `Voice: ${npc.voice}`) : null,
    npc.shown ? h("p", {}, npc.shown) : null,
    npc.secrets ? h("p", { class: "npc-secret" }, `Secret: ${npc.secrets}`) : null,
    h("div", { class: "turn-actions" }, [
      h("button", { type: "button", class: "btn", "data-story": "npc-show", "data-id": npc.id }, "Show the table"),
      h("button", { type: "button", class: "text-btn", "data-story": "npc-remove", "data-id": npc.id }, "Remove"),
    ]),
  ])) : [h("p", { class: "empty" }, "NPC secrets stay on this screen. Show the table hands out only the name and what they can see.")]));
}

function paintScenes() {
  const mount = document.getElementById("dm-scenes");
  if (!mount) return;
  mount.replaceChildren(...(story.scenes.length ? story.scenes.map((scene) => h("div", { class: `scene-row${scene.done ? " is-done" : ""}${story.stopAt === scene.id ? " is-stop" : ""}` }, [
    h("label", { class: "check-line" }, [
      h("input", { type: "checkbox", "data-story-scene": scene.id, checked: scene.done ? "checked" : null }),
      scene.title,
    ]),
    scene.warning ? h("span", { class: "tag warn-tag" }, `Warning: ${scene.warning}`) : null,
    story.stopAt === scene.id ? h("span", { class: "tag" }, "We stopped here") : h("button", { type: "button", class: "text-btn", "data-story": "stop", "data-id": scene.id }, "We stopped here"),
    scene.warning ? h("button", { type: "button", class: "text-btn", "data-story": "warn", "data-id": scene.id }, "Tell the table") : null,
    h("button", { type: "button", class: "text-btn", "data-story": "scene-remove", "data-id": scene.id }, "Remove"),
  ])) : [h("p", { class: "empty" }, "List tonight's scenes, tick them off, and mark where you stopped.")]));
}

function paintEncounters() {
  const mount = document.getElementById("dm-encounters");
  if (!mount) return;
  const total = story.encounters.reduce((sum, row) => sum + row.weight, 0);
  mount.replaceChildren(...(story.encounters.length ? story.encounters.map((row) => h("div", { class: "gear-row" }, [
    h("span", {}, `${row.text}${row.monster ? ` · ${row.count} × ${row.monster}` : ""} · ${Math.round((row.weight / total) * 100)}%`),
    h("button", { type: "button", class: "text-btn", "data-story": "enc-remove", "data-id": row.id }, "Remove"),
  ])) : [h("p", { class: "empty" }, "Add a few rows, then roll. A heavier row comes up more often.")]));
}

function paintBoard(room) {
  const board = room?.board;
  const quests = document.getElementById("dm-quests");
  if (quests && board) {
    quests.replaceChildren(...(board.quests.length ? board.quests.map((quest) => h("div", { class: `gear-row${quest.done ? " is-done" : ""}` }, [
      h("span", {}, `${quest.title}${quest.hidden ? " · hidden" : ""}${quest.done ? " · done" : ""}`),
      h("button", { type: "button", class: "text-btn", "data-story-board": "quest-toggle", "data-id": quest.id }, quest.done ? "Reopen" : "Complete"),
      h("button", { type: "button", class: "text-btn", "data-story-board": "quest-hide", "data-id": quest.id }, quest.hidden ? "Show" : "Hide"),
      h("button", { type: "button", class: "text-btn", "data-story-board": "quest-remove", "data-id": quest.id }, "Remove"),
    ])) : [h("p", { class: "empty" }, "No quests on the board.")]));
  }
  const glossary = document.getElementById("dm-glossary");
  if (glossary && board) {
    glossary.replaceChildren(...(board.glossary.length ? board.glossary.map((item) => h("div", { class: "gear-row" }, [
      h("span", {}, `${item.name}${item.hidden ? " · hidden" : ""}${item.body ? `: ${item.body}` : ""}`),
      h("button", { type: "button", class: "text-btn", "data-story-board": "glossary-reveal", "data-id": item.id }, item.hidden ? "Reveal" : "Hide"),
      h("button", { type: "button", class: "text-btn", "data-story-board": "glossary-remove", "data-id": item.id }, "Remove"),
    ])) : [h("p", { class: "empty" }, "The glossary is empty.")]));
  }
  const handouts = document.getElementById("dm-handouts");
  if (handouts && board) {
    handouts.replaceChildren(...(board.handouts.length ? [...board.handouts].reverse().map((item) => h("div", { class: "gear-row" }, [
      h("span", {}, `${item.title} · ${item.to || "the table"}${item.image ? " · picture" : ""}`),
      h("button", { type: "button", class: "text-btn", "data-story-board": "handout-remove", "data-id": item.id }, "Take back"),
    ])) : [h("p", { class: "empty" }, "Nothing handed out yet.")]));
  }
  const world = document.getElementById("dm-world-now");
  if (world) {
    const now = board?.world;
    world.textContent = now ? `Day ${now.day}, ${String(now.hour).padStart(2, "0")}:00 (${hourText(now.hour)})${now.weather ? `, ${now.weather}` : ""}. The table sees this.` : "The table sees no day or weather yet.";
    const form = document.getElementById("dm-world-form");
    if (now && form && !form.contains(document.activeElement)) {
      form.elements.day.value = String(now.day);
      form.elements.hour.value = String(now.hour);
      form.elements.weather.value = now.weather;
    }
  }
  const targets = document.getElementById("dm-handout-to");
  if (targets && document.activeElement !== targets) {
    const current = targets.value;
    targets.replaceChildren(h("option", { value: "" }, "The whole table"), ...(room?.players || []).map((player) => h("option", { value: player.name }, player.name)));
    if ([...targets.options].some((option) => option.value === current)) targets.value = current;
  }
}

function paintStory() {
  paintBoxes();
  paintNpcs();
  paintScenes();
  paintEncounters();
}

/** Called after each poll. */
export function paintStoryRoom(room) {
  if (!document.getElementById("module-story")?.open) return;
  paintBoard(room);
}

// --- Actions ------------------------------------------------------------------

async function board(body, done = "") {
  try {
    await postBoard(hooks.code(), body, hooks.token());
    if (done) hooks.status(done);
    await hooks.refresh();
    paintBoard(hooks.room());
    return true;
  } catch (error) {
    hooks.status(error.message);
    return false;
  }
}

/** Shrinks a picture to a JPEG small enough for a handout. */
export async function shrinkImage(file) {
  const bitmap = await createImageBitmap(file);
  let side = IMAGE_SIDE;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", 0.72);
    if (url.length <= IMAGE_CHARS) return url;
    side = Math.round(side * 0.75);
  }
  throw new Error("That picture will not shrink small enough.");
}

async function sendHandout(form) {
  const title = form.elements.title.value.trim();
  const text = form.elements.text.value.trim();
  const file = form.elements.image.files?.[0];
  if (!title) {
    hooks.status("Give the handout a title.");
    return;
  }
  let image = "";
  try {
    if (file) image = await shrinkImage(file);
  } catch (error) {
    hooks.status(error.message);
    return;
  }
  const to = form.elements.to.value;
  if (await board({ op: "handout", title, text, image, to }, to ? `Handed to ${to}.` : "Handed to the table.")) form.reset();
}

async function onClick(event) {
  const button = event.target.closest("[data-story]");
  const boardButton = event.target.closest("[data-story-board]");
  if (boardButton) {
    await board({ op: boardButton.dataset.storyBoard, id: boardButton.dataset.id });
    return;
  }
  if (!button) return;
  const { id } = button.dataset;
  const kind = button.dataset.story;
  if (kind === "read") {
    const box = story.boxes.find((item) => item.id === id);
    if (!box) return;
    try {
      await postTalk(hooks.code(), { text: box.title ? `${box.title}. ${box.text}`.slice(0, 400) : box.text.slice(0, 400), kind: "read" }, hooks.token());
      box.read = true;
      hooks.status("Read to the table.");
      await hooks.refresh();
    } catch (error) {
      hooks.status(error.message);
    }
  } else if (kind === "box-remove") story.boxes = story.boxes.filter((item) => item.id !== id);
  else if (kind === "npc-remove") story.npcs = story.npcs.filter((item) => item.id !== id);
  else if (kind === "npc-show") {
    const npc = story.npcs.find((item) => item.id === id);
    if (npc) await board({ op: "handout", title: npc.name, text: npc.shown || `You meet ${npc.name}.` }, `${npc.name} is on the table.`);
  } else if (kind === "scene-remove") story.scenes = story.scenes.filter((item) => item.id !== id);
  else if (kind === "stop") story.stopAt = id;
  else if (kind === "warn") {
    const scene = story.scenes.find((item) => item.id === id);
    if (scene) {
      try {
        await postTalk(hooks.code(), { text: `Heads up before the next scene: ${scene.warning}. Say so, or use the X-card, if you would rather skip it.`, kind: "ooc" }, hooks.token());
        hooks.status("The table has the warning.");
        await hooks.refresh();
      } catch (error) {
        hooks.status(error.message);
      }
    }
  } else if (kind === "enc-remove") story.encounters = story.encounters.filter((item) => item.id !== id);
  else if (kind === "enc-roll") {
    const row = rollEncounter(story.encounters);
    const out = document.getElementById("dm-encounter-result");
    if (!row || !out) return;
    out.replaceChildren(
      h("p", { class: "sheet-title" }, row.text),
      row.monster ? h("div", { class: "turn-actions" }, [
        h("button", { type: "button", class: "btn primary", "data-story": "enc-order", "data-id": row.id }, `Quick add ${row.count} × ${row.monster}`),
        h("button", { type: "button", class: "btn", "data-story": "enc-threat", "data-id": row.id }, "Send to Threat"),
      ]) : null,
    );
    return;
  } else if (kind === "enc-order" || kind === "enc-threat") {
    const row = story.encounters.find((item) => item.id === id);
    if (!row) return;
    try {
      if (kind === "enc-order") await hooks.addToOrder(row.monster, row.count);
      else hooks.addGroup(row.monster, row.count);
      hooks.status(kind === "enc-order" ? `${row.count} × ${row.monster} are in the order.` : `${row.count} × ${row.monster} are in Threat.`);
    } catch (error) {
      hooks.status(error.message);
    }
    return;
  } else if (kind === "time") {
    const hours = Number(button.dataset.hours);
    const next = passTime(hooks.room()?.board?.world, hours);
    await board({ op: "world", ...next }, "Time moves on.");
    return;
  } else if (kind === "world-clear") {
    await board({ op: "world", clear: true }, "The day and weather are hidden.");
    return;
  } else return;
  saveStory();
  paintStory();
}

function onChange(event) {
  const scene = event.target.closest("[data-story-scene]");
  if (!scene) return;
  const found = story.scenes.find((item) => item.id === scene.dataset.storyScene);
  if (!found) return;
  found.done = scene.checked;
  saveStory();
  paintScenes();
}

function addTo(list, item, form) {
  if (story[list].length >= LIST_CAP) {
    hooks.status("That list is full.");
    return;
  }
  story = cleanStory({ ...story, [list]: [...story[list], { id: uid(), ...item }] });
  saveStory();
  paintStory();
  form.reset();
}

/** hooks: code, token, room, status, refresh, addToOrder(name, count), addGroup(name, count). */
export function bootStory(next) {
  hooks = next;
  const module = document.getElementById("module-story");
  module?.addEventListener("toggle", () => {
    paintStory();
    paintBoard(hooks.room());
  });
  module?.addEventListener("click", (event) => { void onClick(event); });
  module?.addEventListener("change", onChange);
  const forms = {
    "dm-box-form": (form) => addTo("boxes", { title: form.elements.title.value, text: form.elements.text.value }, form),
    "dm-npc-form": (form) => addTo("npcs", { name: form.elements.name.value, voice: form.elements.voice.value, shown: form.elements.shown.value, secrets: form.elements.secrets.value }, form),
    "dm-scene-form": (form) => addTo("scenes", { title: form.elements.title.value, warning: form.elements.warning.value }, form),
    "dm-enc-form": (form) => addTo("encounters", { text: form.elements.text.value, monster: form.elements.monster.value, count: form.elements.count.value, weight: form.elements.weight.value }, form),
    "dm-handout-form": (form) => void sendHandout(form),
    "dm-quest-form": (form) => void board({ op: "quest-add", title: form.elements.title.value, hidden: form.elements.hidden.checked }, "Quest added.").then((ok) => ok && form.reset()),
    "dm-gloss-form": (form) => void board({ op: "glossary-add", name: form.elements.name.value, body: form.elements.body.value, hidden: form.elements.hidden.checked }, "Glossary entry added.").then((ok) => ok && form.reset()),
    "dm-world-form": (form) => void board({ op: "world", day: Number(form.elements.day.value) || 1, hour: Number(form.elements.hour.value) || 0, weather: form.elements.weather.value }, "The table sees the new day and weather."),
  };
  for (const [id, run] of Object.entries(forms)) {
    document.getElementById(id)?.addEventListener("submit", (event) => {
      event.preventDefault();
      run(event.target);
    });
  }
}
