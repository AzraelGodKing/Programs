// The DM's library: monsters, spells, and magic items in Lantern's own format,
// read from a PDF or a Lantern file and kept in this browser. Characters read
// from a PDF are handed out as a Lantern character file.

import {
  blankLibrary,
  cleanLibrary,
  cleanMonster,
  cleanSpell,
  cleanItem,
  exportLibrary,
  mergeLibrary,
  readLibraryFile,
  readPdfContent,
} from "./library.js";
import { abilityMod, formatMod, presentCharacter } from "./character.js";

const KEY = "lantern.library";
const ORDINAL = ["Cantrip", "1st level", "2nd level", "3rd level", "4th level", "5th level", "6th level", "7th level", "8th level", "9th level"];

let library = load();
let tab = "monsters";
let pending = null;
let pendingCharacter = null;
let hooks = {};

function load() {
  try {
    return cleanLibrary(JSON.parse(localStorage.getItem(KEY) || "null") || blankLibrary());
  } catch {
    return blankLibrary();
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(library));
  } catch {
    status("This browser would not store the library. Export it to keep it.");
  }
}

function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : String(value));
  }
  for (const child of [children].flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function status(message) {
  const node = document.getElementById("library-status");
  if (node) node.textContent = message;
}

function download(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function monsterLine(monster) {
  return [`CR ${monster.cr || "?"}`, `AC ${monster.ac}`, `HP ${monster.hp}`, monster.type].filter(Boolean).join(" · ");
}

function entries(title, list) {
  if (!list.length) return null;
  return h("div", { class: "lib-entries" }, [
    h("p", { class: "lib-section" }, title),
    ...list.map((entry) => h("p", {}, [entry.name ? h("strong", {}, `${entry.name}. `) : null, entry.text])),
  ]);
}

function monsterBody(monster) {
  const scores = ["str", "dex", "con", "int", "wis", "cha"].map((id) => `${id.toUpperCase()} ${monster.scores[id]} (${formatMod(abilityMod(monster.scores[id]))})`).join("  ");
  return [
    h("p", { class: "hint" }, `${monster.size} ${monster.type}${monster.alignment ? `, ${monster.alignment}` : ""}`),
    h("p", {}, `Armor Class ${monster.ac}${monster.acNote ? ` (${monster.acNote})` : ""} · Hit Points ${monster.hp}${monster.hpDice ? ` (${monster.hpDice})` : ""} · Speed ${monster.speed || "—"}`),
    h("p", { class: "lib-scores" }, scores),
    ...[["Saving Throws", monster.saves], ["Skills", monster.skills], ["Resistances", monster.resist], ["Senses", monster.senses], ["Languages", monster.languages]]
      .filter(([, value]) => value)
      .map(([label, value]) => h("p", {}, [h("strong", {}, `${label} `), value])),
    h("p", {}, [h("strong", {}, "Challenge "), `${monster.cr || "?"} (${monster.xp} XP)`]),
    entries("Traits", monster.traits),
    entries("Actions", monster.actions),
    entries("Reactions", monster.reactions),
    entries("Legendary actions", monster.legendary),
  ];
}

function spellLine(spell) {
  const level = spell.level === 0 ? `${spell.school || "Cantrip"} cantrip` : `${ORDINAL[spell.level]} ${spell.school}`;
  return [level.trim(), spell.ritual ? "ritual" : "", spell.concentration ? "concentration" : ""].filter(Boolean).join(" · ");
}

function spellBody(spell) {
  return [
    h("p", {}, [["Casting Time", spell.castingTime], ["Range", spell.range], ["Components", spell.components], ["Duration", spell.duration]]
      .filter(([, value]) => value)
      .map(([label, value]) => h("span", { class: "lib-field" }, [h("strong", {}, `${label} `), value]))),
    spell.text ? h("p", { class: "lib-text" }, spell.text) : null,
  ];
}

function itemLine(item) {
  return [item.kind, item.rarity, item.attune ? "requires attunement" : ""].filter(Boolean).join(" · ");
}

function listFor(kind) {
  const query = (document.getElementById("library-search")?.value || "").trim().toLowerCase();
  return library[kind].filter((item) => !query || item.name.toLowerCase().includes(query));
}

function paintTabs() {
  for (const button of document.querySelectorAll("[data-library-tab]")) {
    button.setAttribute("aria-pressed", button.dataset.libraryTab === tab ? "true" : "false");
  }
  const search = document.getElementById("library-search-field");
  if (search) search.hidden = tab === "characters";
  const exportButton = document.querySelector("[data-library='export']");
  if (exportButton) exportButton.hidden = tab === "characters";
}

function paintPending() {
  const mount = document.getElementById("library-pending");
  if (!mount) return;
  if (pendingCharacter) {
    const view = presentCharacter(pendingCharacter);
    mount.replaceChildren(h("div", { class: "lib-review" }, [
      h("h3", {}, "Read from the PDF"),
      h("label", {}, ["Name", h("input", { id: "pending-character-name", value: pendingCharacter.name, maxlength: "80" })]),
      h("p", {}, view ? view.meta : ""),
      h("p", {}, view ? view.abilities : ""),
      view?.carried ? h("p", { class: "hint" }, `Carrying ${view.carried}`) : null,
      h("p", { class: "hint" }, "Download the Lantern character file and give it to the player. They import it on their seat, check each step, and sit down."),
      h("div", { class: "turn-actions" }, [
        h("button", { type: "button", class: "btn primary", "data-library": "download-character" }, "Download character file"),
        h("button", { type: "button", class: "text-btn", "data-library": "discard" }, "Discard"),
      ]),
    ]));
    return;
  }
  if (!pending) {
    mount.replaceChildren();
    return;
  }
  const rows = [];
  for (const kind of ["monsters", "spells", "items"]) {
    pending[kind].forEach((item, index) => {
      const fields = [h("input", { type: "checkbox", checked: "checked", "data-pending": kind, "data-index": String(index), "aria-label": `Keep ${item.name}` }),
        h("input", { value: item.name, maxlength: "80", "data-pending-field": "name", "data-pending-kind": kind, "data-index": String(index), "aria-label": "Name" })];
      if (kind === "monsters") {
        for (const [field, label] of [["ac", "AC"], ["hp", "HP"], ["cr", "CR"]]) {
          fields.push(h("label", { class: "inline-field" }, [label, h("input", { value: String(item[field]), maxlength: "6", size: "4", "data-pending-field": field, "data-pending-kind": kind, "data-index": String(index) })]));
        }
      }
      rows.push(h("div", { class: "lib-pending-row" }, [
        h("div", { class: "gear-row" }, fields),
        h("p", { class: "hint" }, kind === "monsters" ? monsterLine(item) : kind === "spells" ? spellLine(item) : itemLine(item)),
      ]));
    });
  }
  mount.replaceChildren(h("div", { class: "lib-review" }, [
    h("h3", {}, `Found ${rows.length}`),
    h("p", { class: "hint" }, "Fix a name or a number, untick anything that is wrong, then save. You can open each entry after saving to check the rest."),
    ...rows,
    h("div", { class: "turn-actions" }, [
      h("button", { type: "button", class: "btn primary", "data-library": "save-pending" }, "Save to the library"),
      h("button", { type: "button", class: "text-btn", "data-library": "discard" }, "Discard"),
    ]),
  ]));
}

function paintList() {
  const mount = document.getElementById("library-list");
  if (!mount) return;
  if (tab === "characters") {
    mount.replaceChildren(h("p", { class: "hint" }, "Read a character sheet PDF here to make a Lantern character file for a player or an NPC. Players can also read their own PDF on the player seat."));
    return;
  }
  const list = listFor(tab);
  if (!list.length) {
    mount.replaceChildren(h("p", { class: "empty" }, library[tab].length ? "Nothing matches." : "Nothing here yet. Read a PDF or import a Lantern file."));
    return;
  }
  mount.replaceChildren(...list.map((item) => {
    const line = tab === "monsters" ? monsterLine(item) : tab === "spells" ? spellLine(item) : itemLine(item);
    const actions = tab === "monsters"
      ? [h("button", { type: "button", class: "btn", "data-library": "to-threat", "data-id": item.id }, "Add to Threat"),
        h("button", { type: "button", class: "btn", "data-library": "to-order", "data-id": item.id }, "Add to the order")]
      : tab === "items"
        ? [h("button", { type: "button", class: "btn", "data-library": "to-stash", "data-id": item.id }, "Put in the party stash")]
        : [];
    return h("details", { class: "lib-row" }, [
      h("summary", {}, [h("span", { class: "lib-name" }, item.name), h("span", { class: "hint" }, ` ${line}`)]),
      ...(tab === "monsters" ? monsterBody(item) : tab === "spells" ? spellBody(item) : [item.text ? h("p", { class: "lib-text" }, item.text) : null]),
      h("div", { class: "turn-actions" }, [...actions, h("button", { type: "button", class: "text-btn", "data-library": "remove", "data-id": item.id }, "Remove")]),
    ]);
  }));
}

function paint() {
  paintTabs();
  paintPending();
  paintList();
  const count = document.getElementById("library-count");
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (count) count.textContent = `${plural(library.monsters.length, "monster")} · ${plural(library.spells.length, "spell")} · ${plural(library.items.length, "item")}`;
}

async function readFile(file) {
  status("Reading…");
  pending = null;
  pendingCharacter = null;
  try {
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      const { readPdf, looksScanned } = await import("./pdfread.js");
      const pdf = await readPdf(file);
      if (looksScanned(pdf)) {
        status("That PDF is a picture of a page, with no text to read. A PDF exported from a document or a fillable sheet works.");
        return;
      }
      if (tab === "characters") {
        const found = readPdfContent(pdf, "character");
        if (!found.character) {
          status("No character sheet found in that PDF.");
          return;
        }
        pendingCharacter = found.character;
        status("");
      } else {
        const found = readPdfContent(pdf, tab);
        const total = found.monsters.length + found.spells.length + found.items.length;
        if (!total) {
          const other = readPdfContent(pdf);
          const hint = other.monsters.length ? "monsters" : other.spells.length ? "spells" : other.items.length ? "items" : other.character ? "characters" : "";
          status(hint ? `No ${tab} found, but there are ${hint}. Switch to ${hint[0].toUpperCase()}${hint.slice(1)} and read it again.` : `No ${tab} found in that PDF. Lantern reads stat blocks laid out like the SRD.`);
          return;
        }
        pending = { monsters: found.monsters, spells: found.spells, items: found.items };
        status("");
      }
    } else {
      const data = JSON.parse(await file.text());
      if (data?.kind === "character") {
        status("That is already a Lantern character file. The player imports it on their seat.");
        return;
      }
      const incoming = readLibraryFile(data);
      library = mergeLibrary(library, incoming);
      save();
      status(`Imported ${incoming.monsters.length} monsters, ${incoming.spells.length} spells, and ${incoming.items.length} items.`);
    }
  } catch (error) {
    status(error instanceof SyntaxError ? "That file is not a Lantern file or a PDF." : error.message);
  } finally {
    paint();
  }
}

function savePending() {
  if (!pending) return;
  const keep = blankLibrary();
  for (const box of document.querySelectorAll("[data-pending]")) {
    if (!box.checked) continue;
    const kind = box.dataset.pending;
    const index = Number(box.dataset.index);
    const item = { ...pending[kind][index] };
    for (const input of document.querySelectorAll(`[data-pending-kind="${kind}"][data-index="${index}"]`)) {
      const field = input.dataset.pendingField;
      item[field] = field === "ac" || field === "hp" ? Number(input.value) : input.value;
    }
    if (kind === "monsters" && item.cr !== pending[kind][index].cr) item.xp = undefined;
    const clean = kind === "monsters" ? cleanMonster(item) : kind === "spells" ? cleanSpell(item) : cleanItem(item);
    if (clean) keep[kind].push(clean);
  }
  library = mergeLibrary(library, keep);
  save();
  pending = null;
  status(`Saved ${keep.monsters.length + keep.spells.length + keep.items.length} to the library.`);
  paint();
}

function find(id) {
  return library[tab].find((item) => item.id === id);
}

async function onClick(event) {
  const tabButton = event.target.closest("[data-library-tab]");
  if (tabButton) {
    tab = tabButton.dataset.libraryTab;
    pending = null;
    pendingCharacter = null;
    status("");
    paint();
    return;
  }
  const button = event.target.closest("[data-library]");
  if (!button) return;
  const action = button.dataset.library;
  if (action === "read") document.getElementById("library-file")?.click();
  else if (action === "export") download(exportLibrary(library), `lantern-library-${new Date().toISOString().slice(0, 10)}.json`);
  else if (action === "discard") {
    pending = null;
    pendingCharacter = null;
    paint();
  } else if (action === "save-pending") savePending();
  else if (action === "download-character" && pendingCharacter) {
    const name = document.getElementById("pending-character-name")?.value.trim() || pendingCharacter.name;
    const character = { ...pendingCharacter, name };
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "character";
    download({ lantern: 1, kind: "character", savedAt: new Date().toISOString(), dead: false, character }, `lantern-character-${slug}.json`);
    status(`Downloaded ${name}. Send the file to the player.`);
  } else if (action === "remove") {
    library = { ...library, [tab]: library[tab].filter((item) => item.id !== button.dataset.id) };
    save();
    paint();
  } else if (action === "to-threat") {
    const monster = find(button.dataset.id);
    if (monster) {
      hooks.addGroup?.(monster);
      status(`${monster.name} is in Threat.`);
    }
  } else if (action === "to-order") {
    const monster = find(button.dataset.id);
    if (monster) {
      await hooks.addToOrder?.(monster);
      status(`${monster.name} rolled initiative and joined the order.`);
    }
  } else if (action === "to-stash") {
    const item = find(button.dataset.id);
    if (!item) return;
    try {
      await hooks.stashPut?.(item);
      status(`${item.name} is in the party stash.`);
    } catch (error) {
      status(error.message);
    }
  }
}

export function bootLibrary(options) {
  hooks = options;
  const root = document.getElementById("module-library");
  if (!root) return;
  root.addEventListener("click", (event) => { void onClick(event); });
  document.getElementById("library-search")?.addEventListener("input", paintList);
  document.getElementById("library-file")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void readFile(file);
  });
  paint();
}
