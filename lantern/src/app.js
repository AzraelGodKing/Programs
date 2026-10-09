import {
  ABILITIES,
  ALIGNMENTS,
  BACKGROUNDS,
  CLASSES,
  POINT_BUY_BUDGET,
  RACES,
  SKILLS,
  STANDARD_ARRAY,
  abilityMod,
  abilityTotals,
  addBackgroundSkills,
  askBonus,
  assignStandard,
  blankCharacter,
  choiceSummary,
  classInfo,
  cleanCharacter,
  currentHp,
  defaultScores,
  findAbility,
  findBackground,
  findClass,
  findRace,
  findSkill,
  formatMod,
  longRest,
  markDeath,
  maxHpOf,
  offeredSkillIds,
  pointBuySpent,
  presentCharacter,
  racialBonuses,
  rollScores,
  skillBonus,
  shortRest,
  skillHint,
  stepHp,
  stepPointBuy,
  suggestedHp,
  toggleMark,
} from "./character.js";
import { facesLabel, formula, roll, STANDARD_SIDES } from "./dice.js";
import {
  coinCounts,
  counterFor,
  equipNewCharacter,
  findOffer,
  formatCoin,
  buyBackItem,
  payCounter,
  restockStaples,
  stapleQuote,
  sellOffers,
  sellPrice,
  sellToCounter,
  useItem,
} from "./gear.js";
import { CR_XP, formatXp, rateEncounter } from "./encounter.js";
import { findLight, formatRemaining, LIGHTS, lightCaption, lightOptionLabel } from "./lights.js";
import { MARKS, PACK_MARKS } from "./marks.js";
import { activeRow, blankOrder, cleanOrder, turnRows } from "./order.js";
import { lightTone } from "./screen.js";
import { KIND_LABEL } from "./oracle.js";
import {
  activeCharacter,
  addCharacter,
  characterFilename,
  characterLabel,
  charactersAt,
  chooseCharacter,
  clearRoster,
  exportCharacter,
  findEntry,
  loadRoster,
  markDead,
  normalizeRoster,
  readCharacterFile,
  rosterHasCharacters,
  saveRoster,
  writeSheet,
} from "./roster.js";
import { SAVE_BYTES, SaveError, clearState, exportNight, importNight, loadState, nightFilename, normalize, saveState } from "./store.js";
import { DM_NAME, fetchRoom, loadSeat, normalizeCode, postBuyback, postOrder, postTalk, pushTable, rollSummary, saveSeat } from "./table.js";
import { paintHere, paintTalk, paintTargets } from "./talk.js";
import { bootTextSize } from "./textsize.js";
import { registerOffline } from "./pwa.js";

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

const shareQueue = [];
let shareTimer = null;
let noteTimer = null;
let traitTimer = null;
let lineageKey = "";
let subclassKey = "";
let flushing = false;
let seatError = "";
let roster = loadRoster();
let activeId = "";
let gateMode = "play";
let viewingId = "";
let sheetBeforeCreate = null;
let creatorStep = 0;

const CREATOR_STEPS = [
  { id: "name", copy: "Start with the name the table will use." },
  { id: "people", copy: "Where they are from. Custom is there when the list is short." },
  { id: "class", copy: "What they do when the torch goes out." },
  { id: "scores", copy: "The standard array, point buy, four d6s, or numbers you already rolled." },
  { id: "story", copy: "Background, skills, and the hit points they sit down with." },
  { id: "review", copy: "Read it once. Saving seats them, and the pack is what they use at the table." },
];

function sharedSnapshot() {
  const snapshot = { ...state };
  delete snapshot.drafts;
  return snapshot;
}

function currentIntent() {
  return document.getElementById("roll-for")?.value || "";
}

function persist(summary) {
  if (gateMode === "play" && activeId) {
    const code = seatedCode();
    if (code) {
      roster = writeSheet(roster, code, activeId, state.character);
      saveRoster(roster);
    }
  }
  saveState(state);
  if (typeof summary === "string" && summary.trim()) {
    shareQueue.push(summary.trim().slice(0, 300));
  }
  clearTimeout(shareTimer);
  shareTimer = setTimeout(() => { void flushShare(); }, shareQueue.length ? 30 : 280);
}

async function flushShare() {
  if (flushing) return;
  const seat = loadSeat();
  if (!seat.name || !seat.room) {
    shareQueue.length = 0;
    return;
  }
  flushing = true;
  const summaries = shareQueue.splice(0, 20);
  let ok = false;
  try {
    const result = await pushTable(seat.room, {
      name: seat.name,
      summaries,
      snapshot: sharedSnapshot(),
      intent: currentIntent(),
    });
    const status = document.getElementById("seat-status");
    if (!result.ok) {
      shareQueue.unshift(...summaries);
      if (shareQueue.length > 20) shareQueue.length = 20;
      seatError = result.error;
      if (status) status.textContent = result.error;
      return;
    }
    ok = true;
    if ("shop" in result) applyShop(result.shop);
    if (seatError) {
      seatError = "";
      paintSeatStatus();
    }
  } finally {
    flushing = false;
    if (ok && shareQueue.length) {
      clearTimeout(shareTimer);
      shareTimer = setTimeout(() => { void flushShare(); }, 30);
    }
  }
}

function paintSeatStatus() {
  const status = document.getElementById("seat-status");
  if (!status) return;
  const seat = loadSeat();
  const seated = Boolean(seat.name && seat.room);
  document.body.classList.toggle("is-seated", seated);
  paintSharedOrder();
  const edit = document.getElementById("edit-seat");
  if (edit) edit.hidden = !seated || document.body.classList.contains("seat-editing");
  if (!seated) {
    status.textContent = "Solo until you join a table. The DM sees the night from the moment you join.";
    return;
  }
  status.textContent = `Sharing with the DM as ${seat.name} at ${seat.room}.`;
}

function editSeat() {
  document.body.classList.add("seat-editing");
  paintSeatStatus();
  document.getElementById("seat-name")?.focus();
}

function paintPurposes() {
  const value = currentIntent().trim();
  for (const button of document.querySelectorAll("[data-action='purpose']")) {
    button.setAttribute("aria-pressed", button.dataset.purpose === value ? "true" : "false");
  }
}

function bootSeat() {
  const seat = loadSeat();
  const fromUrl = normalizeCode(new URLSearchParams(location.search).get("room"));
  if (fromUrl) seat.room = fromUrl;
  document.getElementById("seat-name").value = seat.name;
  document.getElementById("seat-room").value = seat.room;
  if (fromUrl) saveSeat(seat);
  paintSeatStatus();
  paintPurposes();
}

function joinSeat(form) {
  const name = form.elements.name.value.trim().slice(0, 40);
  const room = normalizeCode(form.elements.room.value);
  const status = document.getElementById("seat-status");
  if (!name || room.length < 4) {
    if (status) status.textContent = "Add your name and the four-character table code.";
    return;
  }
  if (name.toLowerCase() === DM_NAME.toLowerCase()) {
    if (status) status.textContent = "That name is the DM's. Pick another.";
    return;
  }
  form.elements.room.value = room;
  saveSeat({ name, room });
  document.body.classList.remove("seat-editing");
  seatError = "";
  paintSeatStatus();
  persist("Joined the table.");
  openTableGate();
}

function seatedCode() {
  const seat = loadSeat();
  return seat.name && seat.room.length === 4 ? seat.room : "";
}

function setGateStatus(message) {
  const status = document.getElementById("character-gate-status");
  if (status) status.textContent = message;
}

function downloadJson(file, filename) {
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function setSheetLocked(locked) {
  const panel = document.getElementById("panel-character");
  if (!panel) return;
  for (const el of panel.querySelectorAll("input, select, textarea, button")) {
    el.disabled = locked;
  }
}

function rosterRow(entry, verb, action) {
  return h("article", { class: entry.dead ? "roster-row is-dead" : "roster-row is-living" }, [
    h("h3", {}, characterLabel(entry)),
    h("p", { class: "hint" }, `${entry.dead ? "Died" : "Living"} · level ${entry.sheet.level}`),
    h("div", { class: "roster-actions" }, [
      h("button", { type: "button", class: "btn", "data-action": action, "data-id": entry.id }, verb),
      h("button", { type: "button", class: "btn", "data-action": "export-character", "data-id": entry.id }, "Export"),
    ]),
  ]);
}

const PLAYER_MODULES = {
  order: "module-order",
  character: "module-pack",
  notes: "module-notes",
  table: "module-table",
};

let moduleSync = true;

function closePlayerModules() {
  moduleSync = false;
  for (const id of Object.values(PLAYER_MODULES)) {
    const dialog = document.getElementById(id);
    if (dialog?.open) dialog.close();
  }
  moduleSync = true;
}

function paintPlayerTabs(tab) {
  for (const name of ["dice", "order", "threat", "spark", "character", "notes", "table"]) {
    const button = document.getElementById(`tab-${name}`);
    if (!button) continue;
    const on = name === tab;
    button.setAttribute("aria-selected", on ? "true" : "false");
    button.tabIndex = on ? 0 : -1;
    if (button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", on && name !== "dice" ? "true" : "false");
  }
}

function paintGate() {
  const gate = document.getElementById("character-gate");
  const code = seatedCode();
  const list = code ? charactersAt(roster, code) : [];
  document.body.classList.toggle("roster-open", gateMode === "choose");
  document.body.classList.toggle("sheet-focus", gateMode === "create" || gateMode === "view");
  document.body.classList.toggle("sheet-play", gateMode === "play");
  document.body.classList.toggle("creating", gateMode === "create");
  if (gateMode !== "play") closePlayerModules();
  if (gate) gate.hidden = gateMode === "play";
  const opener = document.getElementById("open-roster");
  if (opener) opener.hidden = !code || gateMode !== "play";
  const died = document.getElementById("mark-dead");
  if (died) died.hidden = gateMode !== "play" || !activeId;
  const saveBottom = document.getElementById("save-character-bottom");
  if (saveBottom) saveBottom.hidden = gateMode !== "create";
  setSheetLocked(gateMode === "view");
  if (gateMode === "play") {
    setGateStatus("");
    showTab(state.tab, { save: false });
    paintCreator();
    return;
  }
  if (gateMode === "create" || gateMode === "view") {
    document.getElementById("panel-character").hidden = false;
    for (const name of ["dice", "order", "threat", "spark", "notes", "table"]) {
      const panel = document.getElementById(`panel-${name}`);
      if (panel) panel.hidden = true;
    }
  }
  const title = document.getElementById("character-gate-title");
  const lede = document.getElementById("character-gate-lede");
  const actions = document.getElementById("character-gate-actions");
  const mount = document.getElementById("character-gate-list");
  if (gateMode === "create") {
    title.textContent = "Create a character";
    lede.textContent = "Six steps. Jump back whenever you want, then sit down.";
    actions.replaceChildren(...present([
      h("button", { type: "button", class: "btn primary", "data-action": "save-character" }, "Save this character"),
      list.length ? h("button", { type: "button", class: "btn", "data-action": "open-roster" }, "Back") : null,
      h("button", { type: "button", class: "btn", "data-action": "import-character" }, "Import a character file"),
    ]));
    mount.replaceChildren();
    paintCreator();
    return;
  }
  if (gateMode === "view") {
    const entry = findEntry(roster, code, viewingId);
    title.textContent = entry ? characterLabel(entry) : "Character";
    lede.textContent = entry?.dead
      ? "This character died. The sheet stays here to read and export."
      : "A look at this sheet. Export keeps a file of it.";
    actions.replaceChildren(
      h("button", { type: "button", class: "btn", "data-action": "export-character", "data-id": viewingId }, "Export"),
      h("button", { type: "button", class: "btn", "data-action": "open-roster" }, "Back"),
    );
    mount.replaceChildren();
    paintCreator();
    return;
  }
  title.textContent = "Who sits down?";
  lede.textContent = "Load a living character, start a new one, or look back at a character who died.";
  actions.replaceChildren(
    h("button", { type: "button", class: "btn primary", "data-action": "create-character" }, "Create a new character"),
    h("button", { type: "button", class: "btn", "data-action": "import-character" }, "Import a character file"),
  );
  mount.replaceChildren(
    ...list.filter((entry) => !entry.dead).map((entry) => rosterRow(entry, "Load", "load-character")),
    ...list.filter((entry) => entry.dead).map((entry) => rosterRow(entry, "View", "view-character")),
  );
  paintCreator();
}

function paintCreator() {
  const creating = gateMode === "create";
  const nav = document.getElementById("creator-nav");
  const copy = document.getElementById("creator-copy");
  if (nav) nav.hidden = !creating;
  if (copy) copy.hidden = !creating;
  const step = CREATOR_STEPS[Math.min(creatorStep, CREATOR_STEPS.length - 1)] || CREATOR_STEPS[0];
  if (creating && copy) copy.textContent = step.copy;
  for (const item of CREATOR_STEPS) {
    const node = document.querySelector(`#panel-character > [data-step="${item.id}"]`);
    if (node) node.classList.toggle("is-on", creating && item.id === step.id);
  }
  nav?.querySelectorAll("[data-creator-step], [data-step]").forEach((button) => {
    if (!button.dataset.step || button.dataset.action !== "creator-step") return;
    const on = button.dataset.step === step.id;
    if (on) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  const saveBottom = document.getElementById("save-character-bottom");
  if (saveBottom && creating) saveBottom.hidden = step.id !== "review";
}

function renderDrafts() {
  const list = document.getElementById("draft-list");
  if (!list) return;
  if (!state.drafts.length) {
    list.replaceChildren(h("p", { class: "hint" }, "No drafts yet."));
    return;
  }
  list.replaceChildren(...state.drafts.map((draft) => h("article", { class: "draft" }, [
    h("input", {
      type: "text",
      "data-draft": "title",
      "data-id": draft.id,
      value: draft.title,
      maxlength: "80",
      placeholder: "A title for you",
      "aria-label": "Draft title",
    }),
    h("textarea", {
      "data-draft": "body",
      "data-id": draft.id,
      maxlength: "4000",
      rows: "4",
      placeholder: "What you do not want the table to hear yet.",
      "aria-label": "Draft",
    }, draft.body),
    h("button", { type: "button", class: "text-btn", "data-action": "delete-draft", "data-id": draft.id }, "Delete draft"),
  ])));
}

function addDraft() {
  state.drafts.push({ id: crypto.randomUUID(), title: "", body: "" });
  saveState(state);
  renderDrafts();
  document.querySelector("#draft-list article:last-child input")?.focus();
}

function deleteDraft(id) {
  state.drafts = state.drafts.filter((draft) => draft.id !== id);
  saveState(state);
  renderDrafts();
}

function rememberDraft(target) {
  const draft = state.drafts.find((item) => item.id === target.dataset.id);
  if (!draft) return;
  if (target.dataset.draft === "title") draft.title = target.value.slice(0, 80);
  if (target.dataset.draft === "body") draft.body = target.value.slice(0, 4000);
  saveState(state);
}

async function sendTalk() {
  const seat = loadSeat();
  const field = document.getElementById("talk-text");
  const status = document.getElementById("talk-status");
  const text = field?.value.trim() || "";
  if (!seat.name || !seat.room) {
    if (status) status.textContent = "Join a table to talk. Drafts still stay on this seat.";
    return;
  }
  if (!text) {
    if (status) status.textContent = "Write a message first.";
    return;
  }
  try {
    await postTalk(seat.room, {
      name: seat.name,
      text,
      to: document.getElementById("talk-to")?.value || "",
    });
    if (field) field.value = "";
    if (status) status.textContent = "";
    await watchShop();
  } catch (error) {
    if (status) status.textContent = error.message;
  }
}

function showPlay() {
  gateMode = "play";
  viewingId = "";
  sheetBeforeCreate = null;
  const before = state.character;
  state.character = equipNewCharacter(state.character);
  paintGate();
  renderKit();
  if (state.character !== before) persist("Packed the starting gear.");
}

function showChoose() {
  gateMode = "choose";
  viewingId = "";
  setSheetLocked(false);
  paintGate();
}

function beginCreate() {
  const code = seatedCode();
  sheetBeforeCreate = cleanCharacter(state.character);
  const adopt = !charactersAt(roster, code).length && state.character.touched && !rosterHasCharacters(roster);
  if (!adopt) state.character = blankCharacter();
  lineageKey = "";
  subclassKey = "";
  creatorStep = 0;
  gateMode = "create";
  viewingId = "";
  setGateStatus("");
  renderCharacter();
  paintGate();
}

function openTableGate() {
  const code = seatedCode();
  if (!code) {
    showPlay();
    return;
  }
  if (!charactersAt(roster, code).length) beginCreate();
  else showChoose();
}

function openRoster() {
  const code = seatedCode();
  if (!code) return;
  if (gateMode === "create" || gateMode === "view") {
    const active = activeCharacter(roster, code);
    state.character = active ? cleanCharacter(active.sheet) : (sheetBeforeCreate || blankCharacter());
    sheetBeforeCreate = null;
    viewingId = "";
    lineageKey = "";
    subclassKey = "";
    renderCharacter();
    if (charactersAt(roster, code).length) showChoose();
    else showPlay();
    return;
  }
  if (!charactersAt(roster, code).length) beginCreate();
  else showChoose();
}

function saveNewCharacter() {
  const code = seatedCode();
  const name = state.character.name.trim();
  if (!name) {
    setGateStatus("Give this character a name.");
    return;
  }
  state.character.touched = true;
  state.character = equipNewCharacter(state.character);
  const made = addCharacter(roster, code, state.character);
  if (!made) return;
  roster = made.roster;
  activeId = made.entry.id;
  saveRoster(roster);
  sheetBeforeCreate = null;
  setGateStatus("");
  showPlay();
  renderCharacter();
  persist(`Sits down as ${name}.`);
}

async function importCharacter(file) {
  const code = seatedCode();
  if (!code) {
    setGateStatus("Join a table first. Characters are kept per table.");
    return;
  }
  let sheet;
  let dead;
  try {
    if (file.size > SAVE_BYTES) throw new Error("That file is too large to be a character.");
    ({ sheet, dead } = readCharacterFile(JSON.parse(await file.text())));
  } catch (error) {
    setGateStatus(error instanceof SyntaxError ? "That file is not a Lantern character." : error.message);
    return;
  }
  const made = addCharacter(roster, code, sheet);
  if (!made) return;
  roster = dead ? markDead(made.roster, code, made.entry.id) : made.roster;
  saveRoster(roster);
  if (dead) {
    openRoster();
    setGateStatus(`${sheet.name} came in as a fallen hero. View them from the list.`);
    return;
  }
  loadCharacter(made.entry.id);
}

function loadCharacter(id) {
  const code = seatedCode();
  const entry = findEntry(roster, code, id);
  if (!entry || entry.dead) return;
  state.character = cleanCharacter(entry.sheet);
  activeId = entry.id;
  roster = chooseCharacter(roster, code, entry.id);
  saveRoster(roster);
  lineageKey = "";
  subclassKey = "";
  showPlay();
  renderCharacter();
  persist(`Sits down as ${entry.sheet.name || "an unnamed hero"}.`);
}

function viewCharacter(id) {
  const code = seatedCode();
  const entry = findEntry(roster, code, id);
  if (!entry) return;
  if (gateMode !== "view") sheetBeforeCreate = cleanCharacter(state.character);
  state.character = cleanCharacter(entry.sheet);
  viewingId = entry.id;
  gateMode = "view";
  lineageKey = "";
  subclassKey = "";
  setGateStatus("");
  renderCharacter();
  paintGate();
}

function markCharacterDead() {
  const code = seatedCode();
  const entry = findEntry(roster, code, activeId);
  if (!entry || entry.dead) return;
  const name = entry.sheet.name || "This character";
  if (!window.confirm(`Mark ${name} as dead? The sheet stays in this browser to view and export.`)) return;
  roster = markDead(roster, code, entry.id);
  saveRoster(roster);
  activeId = "";
  state.character = blankCharacter();
  lineageKey = "";
  subclassKey = "";
  persist(`${name} died.`);
  renderCharacter();
  showChoose();
}

function exportOne(id) {
  const entry = findEntry(roster, seatedCode(), id);
  if (!entry) return;
  downloadJson(exportCharacter(entry), characterFilename(entry));
  setGateStatus(`Exported ${characterLabel(entry)}.`);
}

function resumeRoster() {
  roster = loadRoster();
  const code = seatedCode();
  const active = code ? activeCharacter(roster, code) : null;
  if (active) {
    state.character = cleanCharacter(active.sheet);
    activeId = active.id;
    gateMode = "play";
    return;
  }
  activeId = "";
  if (!code) {
    gateMode = "play";
    return;
  }
  if (charactersAt(roster, code).length) {
    gateMode = "choose";
    return;
  }
  gateMode = "create";
  if (!(state.character.touched && !rosterHasCharacters(roster))) state.character = blankCharacter();
}

function spoken(label) {
  const text = String(label || "").toLowerCase();
  return `${/^[aeiou]/.test(text) ? "an" : "a"} ${text}`;
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
  if (!["dice", "order", "character", "notes", "table"].includes(tab)) tab = "dice";
  state.tab = tab;
  if (gateMode !== "play") {
    paintPlayerTabs(tab);
    if (save) persist();
    return;
  }
  const dialog = tab === "dice" ? null : document.getElementById(PLAYER_MODULES[tab]);
  if (!dialog?.open) {
    closePlayerModules();
    const dice = document.getElementById("panel-dice");
    if (dice) dice.hidden = false;
    const character = document.getElementById("panel-character");
    if (character) character.hidden = true;
    for (const name of ["threat", "spark"]) {
      const panel = document.getElementById(`panel-${name}`);
      if (panel) panel.hidden = true;
    }
    if (dialog) {
      const panel = dialog.querySelector("[data-module-panel]");
      if (panel) panel.hidden = false;
      dialog.showModal();
    }
  }
  paintPlayerTabs(tab);
  if (tab === "table") seeWhispers();
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

function stripText(item) {
  if (!item || item.total == null) return "";
  return [String(item.total), item.purpose, item.formula].filter(Boolean).join(" · ");
}

function paintRollStrip(text) {
  for (const node of document.querySelectorAll(".roll-strip")) {
    node.hidden = !text;
    node.textContent = text || "";
  }
}

function renderIdleResult() {
  const root = document.getElementById("dice-result");
  root.dataset.tag = "";
  root.replaceChildren(h("p", { class: "result-idle" }, "The die is in your hand."));
  paintRollStrip("");
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
  paintRollStrip(stripText(item));
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
  paintRollStrip(stripText(state.dice.history[0]));
}

function renderHistory() {
  const mount = document.getElementById("dice-history");
  mount.replaceChildren(...state.dice.history.map((item) => h("article", { class: item.tag ? `ticket ${item.tag}` : "ticket" }, present([
    h("p", { class: "ticket-total" }, String(item.total)),
    item.purpose ? h("p", { class: "ticket-detail" }, item.purpose) : null,
    h("p", {}, item.formula),
    h("p", { class: "ticket-detail" }, item.detail),
  ]))));
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
  const purpose = currentIntent().trim().slice(0, 60);
  const line = formula(result);
  const detail = facesLabel(result);
  state.dice.history.unshift({
    id: uid(),
    formula: line,
    total: result.total,
    detail,
    purpose,
    tag: result.tag,
  });
  state.dice.history = state.dice.history.slice(0, 12);
  persist(rollSummary({ purpose, formula: line, total: result.total, detail, tag: result.tag }));
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
  const how = die == null
    ? `set initiative ${init}`
    : `rolled initiative ${init} (${dieLine(person)})`;
  const armor = ac == null ? "" : `, AC ${ac}`;
  persist(`Added ${name} to the order, ${how}, ${hp} hit points${armor}.`);
  renderCombat();
}

function bumpHp(id, delta) {
  const person = findCombatant(id);
  if (!person) return;
  person.hp = Math.min(9999, Math.max(0, person.hp + delta));
  persist(`${person.name} is at ${person.hp} hit points.`);
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
  persist(`Rerolled initiative for ${person.name}: ${person.init} (${dieLine(person)}).`);
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
  const names = turnOrder().map((person) => `${person.name} ${person.init}`).join(", ");
  persist(names ? `Rerolled initiative: ${names}.` : undefined);
  renderCombat();
}

function removeCombatant(id) {
  const gone = findCombatant(id);
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
  persist(gone ? `Removed ${gone.name} from the order.` : undefined);
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
    persist(`Started the round on ${list[0].name}.`);
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
  const active = turnOrder().find((person) => person.id === state.combat.activeId);
  persist(active ? `Moved the turn to ${active.name}. Round ${state.combat.round}.` : undefined);
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
  const label = times === 1
    ? (name || "an unnamed adventurer")
    : `${count} adventurer${count === 1 ? "" : "s"}`;
  persist(`Seated ${label} at level ${level}.`);
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
  const added = state.monsters[state.monsters.length - 1];
  persist(`Added ${added.count} × ${added.name} (${formatXp(added.xp)} XP each).`);
  renderMonsters();
  renderThreat({ reveal: true });
}

function removeHero(id) {
  const hero = state.party.find((item) => item.id === id);
  state.party = state.party.filter((item) => item.id !== id);
  persist(hero ? `Removed ${hero.name || "an unnamed adventurer"} (level ${hero.level}) from the party.` : undefined);
  renderParty();
  renderThreat({ reveal: true });
}

function removeMonster(id) {
  const monster = state.monsters.find((item) => item.id === id);
  state.monsters = state.monsters.filter((item) => item.id !== id);
  persist(monster ? `Removed ${monster.count} × ${monster.name} from the encounter.` : undefined);
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
    paintLightLive();
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
    paintLightLive();
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
  paintLightLive();
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
  persist(`Lit ${spoken(spec.label)}.`);
  renderFlames();
  const add = form.closest("details");
  if (add) add.open = false;
}

function toggleHood(id) {
  const light = state.lights.find((item) => item.id === id);
  if (!light || light.kind !== "hooded") return;
  light.covered = !light.covered;
  persist(light.covered ? "Lowered a lantern hood." : "Raised a lantern hood.");
  renderFlames();
}

function snuff(id) {
  const light = state.lights.find((item) => item.id === id);
  const spec = light ? findLight(light.kind) : null;
  const out = Boolean(light && light.endsAt <= Date.now());
  state.lights = state.lights.filter((item) => item.id !== id);
  announcedOut.delete(id);
  const label = spec ? spec.label.toLowerCase() : "light";
  persist(out ? `Cleared ${spoken(label)}.` : `Put out ${spoken(label)}.`);
  renderFlames();
}

function setControl(id, value) {
  const node = document.getElementById(id);
  if (!node || document.activeElement === node) return;
  const next = value == null ? "" : String(value);
  if (node.value !== next) node.value = next;
}

function showField(id, on) {
  const node = document.getElementById(id);
  if (node) node.hidden = !on;
}

function sheetLine() {
  return choiceSummary(state.character).replace(/^Character, /, "Set the character: ");
}

function abilityControl(ability, method) {
  const score = state.character.scores[ability.id];
  let control;
  if (method === "standard") {
    control = h("select", {
      "data-sheet": "array",
      "data-ability": ability.id,
      "aria-label": `${ability.label} score`,
    }, STANDARD_ARRAY.map((value) => h("option", {
      value: String(value),
      selected: value === score ? "selected" : null,
    }, String(value))));
  } else if (method === "pointbuy") {
    control = h("div", { class: "point-step" }, [
      h("button", {
        type: "button",
        class: "step",
        "data-action": "point",
        "data-ability": ability.id,
        "data-delta": "-1",
        "aria-label": `Lower ${ability.label}`,
      }, "−"),
      h("span", { class: "point-value", "data-base": ability.id }, String(score)),
      h("button", {
        type: "button",
        class: "step",
        "data-action": "point",
        "data-ability": ability.id,
        "data-delta": "1",
        "aria-label": `Raise ${ability.label}`,
      }, "+"),
    ]);
  } else {
    control = h("input", {
      type: "number",
      min: "1",
      max: "30",
      value: String(score),
      "data-sheet": "score",
      "data-ability": ability.id,
      "aria-label": `${ability.label} score`,
    });
  }
  return h("article", { class: "ability", "data-ability-card": ability.id }, [
    h("p", { class: "ability-name" }, ability.short),
    control,
    h("p", { class: "ability-total" }, ""),
    h("p", { class: "ability-note" }, ""),
  ]);
}

function renderAbilities() {
  const mount = document.getElementById("ability-grid");
  const method = state.character.method;
  if (mount.dataset.method !== method) {
    mount.dataset.method = method;
    mount.replaceChildren(...ABILITIES.map((ability) => abilityControl(ability, method)));
  }
  const totals = abilityTotals(state.character);
  const racial = racialBonuses(state.character);
  for (const ability of ABILITIES) {
    const card = mount.querySelector(`[data-ability-card="${ability.id}"]`);
    const total = totals[ability.id];
    const bonus = racial[ability.id];
    const base = state.character.scores[ability.id];
    setText(card.querySelector(".ability-total"), `${total} (${formatMod(abilityMod(total))})`);
    setText(card.querySelector(".ability-note"), bonus ? `${base} base, ${formatMod(bonus)} from the people` : `${base} base`);
    const point = card.querySelector("[data-base]");
    if (point) setText(point, String(base));
    const select = card.querySelector("select");
    if (select && document.activeElement !== select) select.value = String(base);
    const input = card.querySelector("input");
    if (input && document.activeElement !== input && input.value !== String(base)) input.value = String(base);
  }
  const pointLine = document.getElementById("point-buy-line");
  pointLine.hidden = method !== "pointbuy";
  if (method === "pointbuy") {
    const spent = pointBuySpent(state.character.scores);
    setText(pointLine, spent == null
      ? "Scores need to sit between 8 and 15."
      : `${POINT_BUY_BUDGET - spent} points left of ${POINT_BUY_BUDGET}.`);
  }
  document.getElementById("roll-again").hidden = method !== "rolled";
  for (const button of document.querySelectorAll("#score-methods button")) {
    button.setAttribute("aria-pressed", button.dataset.method === method ? "true" : "false");
  }
}

function renderPickGrid(mount, abilities, selected, sheet) {
  if (!mount.childElementCount) {
    mount.replaceChildren(...abilities.map((ability) => h("label", {}, [
      h("input", {
        type: "checkbox",
        "data-sheet": sheet,
        "data-ability": ability.id,
      }),
      ability.label,
    ])));
  }
  for (const input of mount.querySelectorAll("input")) {
    input.checked = selected.includes(input.dataset.ability);
  }
}

function syncLineage() {
  const race = findRace(state.character.raceId);
  const field = document.getElementById("lineage-field");
  const select = document.getElementById("character-lineage");
  if (!race?.lineages.length) {
    field.hidden = true;
    showField("custom-lineage-field", false);
    lineageKey = "";
    return;
  }
  field.hidden = false;
  setText(document.getElementById("lineage-label"), race.lineageLabel);
  if (lineageKey !== race.id) {
    lineageKey = race.id;
    select.replaceChildren(
      ...race.lineages.map((lineage) => h("option", { value: lineage.id }, lineage.name)),
      h("option", { value: "custom" }, "Custom"),
    );
  }
  if (state.character.lineageId !== "custom" && !race.lineages.some((lineage) => lineage.id === state.character.lineageId)) {
    state.character.lineageId = race.lineages[0].id;
  }
  if (document.activeElement !== select) select.value = state.character.lineageId;
  showField("custom-lineage-field", state.character.lineageId === "custom");
  setControl("character-custom-lineage", state.character.customLineage);
}

function syncSubclass() {
  const klass = findClass(state.character.classId);
  const field = document.getElementById("subclass-field");
  const select = document.getElementById("character-subclass");
  if (!state.character.classId) {
    field.hidden = true;
    showField("custom-subclass-field", false);
    subclassKey = "";
    return;
  }
  field.hidden = false;
  if (subclassKey !== state.character.classId) {
    subclassKey = state.character.classId;
    select.replaceChildren(
      h("option", { value: "" }, "No subclass yet"),
      ...(klass ? klass.subclasses.map((sub) => h("option", { value: sub.id }, sub.name)) : []),
      h("option", { value: "custom" }, "Custom"),
    );
  }
  if (document.activeElement !== select) select.value = state.character.subclassId;
  showField("custom-subclass-field", state.character.subclassId === "custom");
  setControl("character-custom-subclass", state.character.customSubclass);
}

function renderKit() {
  const mountSkills = document.getElementById("kit-skills");
  const mountItems = document.getElementById("kit-items");
  if (!mountSkills || !mountItems) return;
  const character = state.character;
  const view = presentCharacter(character);
  setText(document.getElementById("kit-title"), view ? view.title : "Pack");
  setText(document.getElementById("kit-meta"), view ? view.meta : "");
  setText(document.getElementById("kit-hp-now"), view ? String(currentHp(character)) : "—");
  setText(document.getElementById("kit-hp-max"), view ? `/ ${maxHpOf(character)}` : "");
  const marks = document.getElementById("kit-marks");
  if (marks) {
    marks.replaceChildren(...PACK_MARKS.map((mark) => {
      const on = (character.marks || []).includes(mark);
      return h("button", {
        type: "button",
        class: on ? "mark-chip is-on" : "mark-chip",
        "data-action": "sheet-mark",
        "data-mark": mark,
        "aria-pressed": on ? "true" : "false",
      }, mark);
    }));
  }
  const down = Boolean(view) && currentHp(character) === 0;
  const death = document.getElementById("death-line");
  if (death) death.hidden = !down;
  setText(document.getElementById("death-success"), String(character.deathSuccess || 0));
  setText(document.getElementById("death-fail"), String(character.deathFail || 0));
  setText(document.getElementById("kit-purse"), character.purse == null ? "" : formatCoin(character.purse));
  const skills = addBackgroundSkills(character);
  mountSkills.replaceChildren(...(skills.length
    ? skills.map((id) => {
      const skill = findSkill(id);
      if (!skill) return null;
      return h("button", {
        type: "button",
        class: "btn",
        "data-action": "roll-skill",
        "data-id": id,
      }, `${skill.label} ${formatMod(skillBonus(character, id))}`);
    })
    : [h("p", { class: "empty" }, "No skills were chosen. That choice stays on the sheet, before the table.")]));
  mountItems.replaceChildren(...(character.items.length
    ? character.items.map((item) => h("button", {
      type: "button",
      class: "btn",
      "data-action": "use-item",
      "data-id": item.id,
    }, item.qty > 1 ? `${item.name} × ${item.qty}` : item.name))
    : [h("p", { class: "empty" }, "The pack is empty.")]));
}

function paintPurse(node, cp) {
  if (!node) return;
  if (cp == null) {
    node.replaceChildren(h("span", {}, "No purse yet."));
    return;
  }
  node.replaceChildren(...coinCounts(cp).map((coin) => h("span", {}, `${coin.count} ${coin.name}`)));
}

let shopPane = "buy";

function showShopPane(pane) {
  shopPane = pane === "sell" ? "sell" : "buy";
  const buy = document.getElementById("shop-buy");
  const sell = document.getElementById("shop-sell");
  const buyTab = document.getElementById("shop-tab-buy");
  const sellTab = document.getElementById("shop-tab-sell");
  if (buy) buy.hidden = shopPane !== "buy";
  if (sell) sell.hidden = shopPane !== "sell";
  if (buyTab) buyTab.setAttribute("aria-selected", shopPane === "buy" ? "true" : "false");
  if (sellTab) sellTab.setAttribute("aria-selected", shopPane === "sell" ? "true" : "false");
}

function renderGear() {
  const character = state.character;
  paintPurse(document.getElementById("gear-purse"), character.purse);
  const shop = document.getElementById("gear-shop");
  const purse = character.purse ?? 0;
  const offers = counterOffers();
  setText(document.getElementById("gear-title"), counter.name || "Shop");
  const lede = document.getElementById("gear-lede");
  if (lede) {
    const goods = offers.some((offer) => !offer.service);
    const services = offers.some((offer) => offer.service);
    const lines = [];
    if (goods) lines.push("Buying takes the price out of the purse. This counter buys those goods back at half price.");
    if (services) lines.push("A service is paid, not packed.");
    if (!goods) lines.push("This counter does not buy gear.");
    if (!lines.length) lines.push("Nothing is on this counter.");
    lede.textContent = lines.join(" ");
  }
  shop.replaceChildren(...(offers.length
    ? offers.map((offer) => h("div", { class: "gear-row" }, [
      h("span", {}, `${offer.name} · ${formatCoin(offer.cp)}`),
      h("button", {
        type: "button",
        class: "btn",
        "data-action": "buy-item",
        "data-id": offer.id,
        disabled: purse < offer.cp ? true : null,
      }, offer.service ? "Pay" : "Buy"),
    ]))
    : [h("p", { class: "hint" }, "Nothing is on this counter.")]));
  const sell = document.getElementById("gear-sell");
  if (!sell) return;
  const sales = sellOffers(offers, character.items);
  const carried = new Map((character.items || []).map((item) => [item.id, item]));
  sell.replaceChildren(...(sales.length
    ? sales.map((offer) => {
      const item = carried.get(offer.id);
      const label = item && item.qty > 1 ? `${offer.name} × ${item.qty}` : offer.name;
      return h("div", { class: "gear-row" }, [
        h("span", {}, `${label} · ${formatCoin(sellPrice(offer.cp))}`),
        h("button", { type: "button", class: "btn", "data-action": "sell-item", "data-id": offer.id }, "Sell"),
      ]);
    })
    : [h("p", { class: "hint" }, offers.some((offer) => !offer.service)
      ? "Nothing in the pack is something this counter buys."
      : "This counter does not buy gear.")]));
  const held = heldForSeat();
  const buybackTitle = document.getElementById("gear-buyback-title");
  const buybackHint = document.getElementById("gear-buyback-hint");
  const buyback = document.getElementById("gear-buyback");
  if (buybackTitle) buybackTitle.hidden = held.length === 0;
  if (buybackHint) buybackHint.hidden = held.length === 0;
  if (buyback) {
    buyback.replaceChildren(...held.map((line) => {
      const gear = findOffer(line.id);
      const label = line.qty > 1 ? `${gear.name} × ${line.qty}` : gear.name;
      return h("div", { class: "gear-row" }, [
        h("span", {}, `${label} · ${formatCoin(line.cp)}`),
        h("button", {
          type: "button",
          class: "btn",
          "data-action": "buy-back",
          "data-id": line.id,
          "data-cp": String(line.cp),
          disabled: purse < line.cp ? true : null,
        }, "Buy back"),
      ]);
    }));
  }
}

let shopOpen = true;
let shopBusy = false;
let counter = { open: true, name: "Market", goods: null };
let buybacks = [];

function heldForSeat() {
  const seat = loadSeat();
  return buybacks.filter((line) => (
    line
    && line.seller === seat.name
    && Number.isInteger(line.cp)
    && line.cp >= 0
    && Number.isInteger(line.qty)
    && line.qty > 0
    && findOffer(line.id)
    && findOffer(line.id).service !== true
  ));
}

function normalizeShop(shop) {
  if (shop && typeof shop === "object") {
    const name = typeof shop.name === "string" ? shop.name.trim() : "";
    return {
      open: shop.open !== false,
      name: name || "Shop",
      goods: Array.isArray(shop.goods) ? shop.goods : null,
    };
  }
  return { open: shop !== false, name: "Market", goods: null };
}

function counterOffers() {
  if (!Array.isArray(counter.goods)) return counterFor("market").goods;
  return counter.goods.flatMap((good) => {
    if (!good || typeof good.id !== "string" || !Number.isInteger(good.cp) || good.cp < 0) return [];
    const known = findOffer(good.id);
    if (!known) return [];
    return [{
      id: known.id,
      name: known.name,
      cp: good.cp,
      service: known.service === true || good.service === true,
    }];
  });
}

function applyShop(shop, held) {
  counter = normalizeShop(shop);
  shopOpen = counter.open;
  if (Array.isArray(held)) buybacks = held;
  else if (!shopOpen) buybacks = [];
  const button = document.querySelector("[data-action='open-gear']");
  if (button) {
    button.hidden = !shopOpen;
    button.textContent = counter.name || "Shop";
  }
  const note = document.getElementById("shop-note");
  if (note) note.hidden = shopOpen;
  const dialog = document.getElementById("gear-dialog");
  if (!shopOpen && dialog?.open) dialog.close();
  if (dialog?.open) renderGear();
}

let sharedOrder = blankOrder();
let orderRev = -1;
let orderBusy = 0;
let lastMessages = [];
let chimeArmed = false;
const chimeSeen = { turn: "", whisper: "", light: "" };
let audioCtx = null;
const WHISPER_KEY = "lantern.seen.whispers";

function readIds(key) {
  try {
    const list = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(list) ? list.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function chimeOn() {
  try { return localStorage.getItem("lantern.chime") === "on"; } catch { return false; }
}

function paintChime() {
  const button = document.getElementById("chime-toggle");
  if (button) button.textContent = chimeOn() ? "Chime: on" : "Chime: off";
}

function beep() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") void audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = 740;
  gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.05, audioCtx.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
}

function maybeChime(channel, id) {
  if (!id || chimeSeen[channel] === id) return;
  chimeSeen[channel] = id;
  if (!chimeArmed || !chimeOn()) return;
  beep();
}

function toggleChime() {
  const next = chimeOn() ? "off" : "on";
  try { localStorage.setItem("lantern.chime", next); } catch { /* the label still changes for this page */ }
  paintChime();
  if (next === "on") {
    chimeArmed = true;
    beep();
  }
}

function paintSharedOrder() {
  const seated = document.body.classList.contains("is-seated");
  const shared = document.getElementById("shared-order");
  const local = document.getElementById("panel-order");
  if (shared) shared.hidden = !seated;
  if (local) local.hidden = seated;
  if (!seated) return;
  const list = turnRows(sharedOrder);
  const active = activeRow(sharedOrder);
  const banner = document.getElementById("shared-banner");
  const meta = document.getElementById("shared-meta");
  if (!list.length) {
    if (banner) banner.textContent = "No one has rolled initiative.";
    if (meta) meta.textContent = "Roll yours when the DM calls for it.";
  } else if (!active) {
    if (banner) banner.textContent = "Initiative is in.";
    if (meta) meta.textContent = "The DM starts the round.";
  } else {
    const mine = active.seat === loadSeat().name;
    if (banner) banner.textContent = mine ? `Your turn. Round ${sharedOrder.round}.` : `Round ${sharedOrder.round}. ${active.name}.`;
    if (meta) meta.textContent = `${list.indexOf(active) + 1} of ${list.length}`;
  }
  const mount = document.getElementById("shared-list");
  if (!mount) return;
  mount.replaceChildren(...(list.length
    ? list.map((row) => {
      const on = Boolean(active && row.id === active.id);
      const ac = row.ac == null ? "" : ` · AC ${row.ac}`;
      const marks = row.marks.length ? ` · ${row.marks.join(", ")}` : "";
      return h("article", { class: on ? "combatant is-active" : "combatant" }, [
        h("p", {}, `${row.init}  ${row.name}`),
        h("p", { class: "hint" }, `${row.hp}/${row.maxHp}${ac}${marks}`),
      ]);
    })
    : [h("p", { class: "empty" }, "The order is empty.")]));
}

function paintTurnLive() {
  const node = document.getElementById("turn-live");
  if (!node) return;
  const active = activeRow(sharedOrder);
  const seated = document.body.classList.contains("is-seated") && gateMode === "play";
  if (!seated || !active) {
    node.hidden = true;
    return;
  }
  const mine = active.seat && active.seat === loadSeat().name;
  node.hidden = false;
  node.textContent = mine
    ? `Your turn. Round ${sharedOrder.round}.`
    : `Round ${sharedOrder.round}. ${active.name}.`;
  maybeChime("turn", `${sharedOrder.round}:${active.id}`);
}

function unseenWhispers(messages, selfName) {
  const seen = new Set(readIds(WHISPER_KEY));
  return (messages || []).filter((message) => (
    message && message.to === selfName && message.from !== selfName && !seen.has(message.id)
  ));
}

function paintWhispers(messages, selfName) {
  lastMessages = messages || [];
  const unseen = selfName ? unseenWhispers(lastMessages, selfName) : [];
  const banner = document.getElementById("whisper-live");
  const badge = document.getElementById("table-badge");
  const latest = unseen[unseen.length - 1];
  if (banner) {
    banner.hidden = !latest || gateMode !== "play";
    if (latest) setText(document.getElementById("whisper-text"), `${latest.from} whispers: ${latest.text}`);
  }
  if (badge) {
    badge.hidden = unseen.length === 0;
    badge.textContent = unseen.length ? String(unseen.length) : "";
  }
  if (latest) maybeChime("whisper", latest.id);
}

function seeWhispers() {
  const seat = loadSeat();
  const ids = lastMessages.filter((message) => message && message.to === seat.name).map((message) => message.id);
  const next = [...new Set([...readIds(WHISPER_KEY), ...ids])].slice(-80);
  try { localStorage.setItem(WHISPER_KEY, JSON.stringify(next)); } catch { /* the badge still clears after this paint */ }
  paintWhispers(lastMessages, seat.name);
}

function paintLightLive() {
  const node = document.getElementById("light-live");
  if (!node) return;
  const now = Date.now();
  let soonest = null;
  for (const light of state.lights) {
    if (lightTone(light.endsAt - now) !== "low") continue;
    if (!soonest || light.endsAt < soonest.endsAt) soonest = light;
  }
  if (!soonest || gateMode !== "play") {
    node.hidden = true;
    return;
  }
  const spec = findLight(soonest.kind);
  node.hidden = false;
  node.textContent = `${spec?.label || "A light"} is in its last minutes. ${formatRemaining(soonest.endsAt - now)} left.`;
  maybeChime("light", soonest.id);
}

function noteOrder(raw) {
  const order = cleanOrder(raw);
  if (order.rev < orderRev) return;
  orderRev = order.rev;
  sharedOrder = order;
  paintSharedOrder();
  paintTurnLive();
}

function applySharedOrder(raw) {
  const order = cleanOrder(raw);
  if (orderBusy || order.rev < orderRev) return;
  const seat = loadSeat();
  const row = order.rows.find((item) => item.seat === seat.name);
  const changed = order.rev !== orderRev;
  noteOrder(order);
  if (!changed || !row) return;
  const marks = row.marks.join("|");
  const local = (state.character.marks || []).join("|");
  if (state.character.hp === row.hp && state.character.maxHp === row.maxHp && local === marks) return;
  state.character = cleanCharacter({
    ...state.character,
    hp: row.hp,
    maxHp: row.maxHp,
    marks: row.marks,
    deathSuccess: row.hp > 0 ? 0 : state.character.deathSuccess,
    deathFail: row.hp > 0 ? 0 : state.character.deathFail,
  });
  persist();
  renderKit();
}

async function withVitals(edit) {
  orderBusy += 1;
  try {
    edit();
    const seat = loadSeat();
    if (!seat.name || seat.room.length !== 4) return;
    const saved = await postOrder(seat.room, {
      name: seat.name,
      op: "vitals",
      label: state.character.name || seat.name,
      hp: currentHp(state.character),
      maxHp: maxHpOf(state.character),
      marks: state.character.marks || [],
    });
    noteOrder(saved.order);
  } catch (error) {
    setText(document.getElementById("rest-note"), error.message);
  } finally {
    orderBusy -= 1;
  }
}

function changeSheetHp(delta) {
  const before = currentHp(state.character);
  const next = stepHp(state.character, delta);
  if (next.hp === before && next.maxHp === state.character.maxHp) return;
  void withVitals(() => {
    state.character = next;
    persist(`${state.character.name || "The hero"} is at ${state.character.hp} hit points.`);
    renderKit();
  });
}

function flipPackMark(mark) {
  const next = toggleMark(state.character, mark);
  const line = (next.marks || []).join(", ") || "no conditions";
  void withVitals(() => {
    state.character = next;
    persist(`${state.character.name || "The hero"}: ${line}.`);
    renderKit();
  });
}

function takeShortRest() {
  const info = classInfo(state.character);
  const note = document.getElementById("rest-note");
  if (!info) {
    setText(note, "Choose a class before a short rest.");
    return;
  }
  const face = roll({ count: 1, sides: info.hitDie, modifier: 0 }).kept[0];
  const result = shortRest(state.character, face);
  if (!result.ok) {
    setText(note, result.reason);
    return;
  }
  const left = result.character.hitDice;
  const message = `Rolled ${face} on a d${info.hitDie}. Gained ${result.gain}. ${left} hit ${left === 1 ? "die" : "dice"} left.`;
  void withVitals(() => {
    state.character = result.character;
    persist(`Short rest. Rolled ${face}, gained ${result.gain}.`);
    renderCharacter();
    setText(note, message);
  });
}

function takeLongRest() {
  const note = document.getElementById("rest-note");
  const result = longRest(state.character);
  if (!result.ok) {
    setText(note, result.reason);
    return;
  }
  const left = result.character.hitDice;
  void withVitals(() => {
    state.character = result.character;
    persist("A long rest. Hit points are full.");
    renderCharacter();
    setText(note, `A long rest. Hit points are full. ${left} hit ${left === 1 ? "die" : "dice"} left.`);
  });
}

function tapDeath(kind) {
  if (currentHp(state.character) !== 0) return;
  state.character = markDeath(state.character, kind);
  persist(kind === "success" ? "A death save succeeds." : "A death save fails.");
  renderKit();
}

async function rollInitiative() {
  const seat = loadSeat();
  const error = document.getElementById("shared-error");
  if (!seat.name || seat.room.length !== 4) {
    setText(error, "Join a table before rolling initiative.");
    return;
  }
  const bonus = abilityMod(abilityTotals(state.character).dex);
  const result = roll({ count: 1, sides: 20, modifier: bonus, mode: "normal" });
  orderBusy += 1;
  try {
    const saved = await postOrder(seat.room, {
      name: seat.name,
      op: "initiative",
      label: state.character.name || seat.name,
      init: result.total,
      bonus,
      hp: currentHp(state.character),
      maxHp: maxHpOf(state.character),
      marks: state.character.marks || [],
    });
    noteOrder(saved.order);
    if (error) error.textContent = "";
    persist(`Rolled initiative ${result.total}.`);
  } catch (err) {
    setText(error, err.message);
  } finally {
    orderBusy -= 1;
  }
}

function paintStapleQuote() {
  const note = document.getElementById("gear-restock");
  if (!note) return;
  const quote = stapleQuote(state.character, counterOffers());
  if (!quote.lines.length && !quote.short.length) {
    note.replaceChildren();
    return;
  }
  const bits = [];
  if (quote.lines.length) {
    const line = quote.lines.map((item) => `${item.name} · ${formatCoin(item.cp)}`).join(", ");
    bits.push(h("span", {}, `This counter can add ${line}. ${formatCoin(quote.total)} altogether.`));
    bits.push(h("button", { type: "button", class: "btn", "data-action": "buy-staples" }, "Buy them"));
    bits.push(h("button", { type: "button", class: "text-btn", "data-action": "skip-staples" }, "Not now"));
  }
  if (quote.short.length) {
    bits.push(h("span", {}, `Not enough coin for ${quote.short.map((item) => item.name).join(", ")}.`));
  }
  note.replaceChildren(...bits);
}

function buyStaples() {
  const restock = restockStaples(state.character, counterOffers());
  const note = document.getElementById("gear-restock");
  if (!restock.bought.length) {
    paintStapleQuote();
    return;
  }
  state.character = restock.character;
  const line = restock.bought.map((item) => `${item.name} for ${formatCoin(item.cp)}`).join(", ");
  persist(`Bought ${line}.`);
  renderCharacter();
  if (note) note.textContent = `Bought ${line}.`;
  renderGear();
}

async function watchShop() {
  const seat = loadSeat();
  if (!seat.name || !seat.room) {
    applyShop(true, []);
    sharedOrder = blankOrder();
    orderRev = -1;
    paintSharedOrder();
    paintTurnLive();
    paintWhispers([], "");
    paintHere(document.getElementById("table-here"), [], "");
    return;
  }
  let room;
  try {
    room = await fetchRoom(seat.room, seat.name);
  } catch {
    return;
  }
  if (!room) return;
  applyShop(room.shop, room.buybacks);
  paintTalk(document.getElementById("talk-log"), room.messages || []);
  paintHere(document.getElementById("table-here"), room.players || [], seat.name);
  paintAsk(room.messages || [], seat.name);
  paintWhispers(room.messages || [], seat.name);
  applySharedOrder(room.order);
  paintTargets(
    document.getElementById("talk-to"),
    (room.players || []).map((player) => player.name),
    seat.name,
  );
}

function openGear() {
  if (!shopOpen) return;
  const error = document.getElementById("gear-error");
  if (error) error.textContent = "";
  paintStapleQuote();
  showShopPane("buy");
  renderGear();
  document.getElementById("gear-dialog").showModal();
}

function purchase(id) {
  if (!shopOpen) return;
  const offer = counterOffers().find((item) => item.id === id);
  const result = offer ? payCounter(state.character, offer) : { ok: false, reason: "That is not on the counter." };
  const error = document.getElementById("gear-error");
  if (!result.ok) {
    if (error) error.textContent = result.reason;
    return;
  }
  state.character = result.character;
  if (error) error.textContent = "";
  const name = offer.name;
  const price = formatCoin(offer.cp);
  persist(result.service
    ? `Paid ${name} at ${counter.name}. ${price}.`
    : `Bought ${name} for ${price}.`);
  renderCharacter();
  renderGear();
}

async function sellPiece(id) {
  if (!shopOpen || shopBusy) return;
  const offer = counterOffers().find((item) => item.id === id);
  const result = offer ? sellToCounter(state.character, offer) : { ok: false, reason: "That is not on the counter." };
  const error = document.getElementById("gear-error");
  if (!result.ok) {
    if (error) error.textContent = result.reason;
    return;
  }
  const seat = loadSeat();
  if (seat.name && seat.room) {
    shopBusy = true;
    try {
      const saved = await postBuyback(seat.room, {
        name: seat.name,
        id: offer.id,
        cp: result.gained,
        action: "sell",
      });
      buybacks = Array.isArray(saved.buybacks) ? saved.buybacks : buybacks;
    } catch (err) {
      if (error) error.textContent = err.message;
      return;
    } finally {
      shopBusy = false;
    }
  }
  state.character = result.character;
  if (error) error.textContent = "";
  persist(`Sold ${offer.name} at ${counter.name} for ${formatCoin(result.gained)}.`);
  renderCharacter();
  renderGear();
}

async function buyBackPiece(id, cpText) {
  if (!shopOpen || shopBusy) return;
  const cp = Number(cpText);
  const error = document.getElementById("gear-error");
  const line = heldForSeat().find((item) => item.id === id && item.cp === cp);
  if (!line) {
    if (error) error.textContent = "That is no longer held for buy back.";
    return;
  }
  const gear = findOffer(line.id);
  const preview = buyBackItem(state.character, { id: line.id, cp: line.cp });
  if (!preview.ok) {
    if (error) error.textContent = preview.reason;
    return;
  }
  const seat = loadSeat();
  if (!seat.name || !seat.room) {
    if (error) error.textContent = "Join a table before buying that back.";
    return;
  }
  shopBusy = true;
  try {
    const saved = await postBuyback(seat.room, {
      name: seat.name,
      id: line.id,
      cp: line.cp,
      action: "buy",
    });
    const taken = buyBackItem(state.character, { id: line.id, cp: line.cp });
    if (!taken.ok) {
      const restored = await postBuyback(seat.room, {
        name: seat.name,
        id: line.id,
        cp: line.cp,
        action: "sell",
      }).catch(() => saved);
      buybacks = Array.isArray(restored.buybacks) ? restored.buybacks : buybacks;
      if (error) error.textContent = taken.reason;
      renderGear();
      return;
    }
    buybacks = Array.isArray(saved.buybacks) ? saved.buybacks : buybacks;
    state.character = taken.character;
  } catch (err) {
    if (error) error.textContent = err.message;
    return;
  } finally {
    shopBusy = false;
  }
  if (error) error.textContent = "";
  persist(`Bought back ${gear.name} for ${formatCoin(line.cp)}.`);
  renderCharacter();
  renderGear();
}

function spendItem(id) {
  const result = useItem(state.character, id);
  if (!result.ok) return;
  state.character = result.character;
  const line = result.spent
    ? (result.left > 0 ? `Uses ${result.used}. ${result.left} left.` : `Uses the last ${result.used}.`)
    : `Uses ${result.used}.`;
  persist(line);
  renderKit();
}

const ASK_KEY = "lantern.asks.done";
const ASK_FRESH_MS = 15 * 60 * 1000;
let pendingAsk = null;

function answeredAsks() {
  try {
    const list = JSON.parse(localStorage.getItem(ASK_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function markAsk(id) {
  const list = answeredAsks().filter((item) => item !== id);
  list.push(id);
  try { localStorage.setItem(ASK_KEY, JSON.stringify(list.slice(-50))); } catch { /* still hidden for this page */ }
}

function paintAsk(messages, selfName) {
  const done = new Set(answeredAsks());
  const now = Date.now();
  const ask = [...(messages || [])].reverse().find((message) => (
    message.ask
    && message.from === DM_NAME
    && (!message.to || message.to === selfName)
    && now - message.at < ASK_FRESH_MS
    && !done.has(message.id)
  ));
  pendingAsk = ask || null;
  const banner = document.getElementById("ask-banner");
  if (!banner) return;
  banner.hidden = !ask || gateMode !== "play";
  if (!ask) return;
  const info = askBonus(state.character, ask.ask);
  const what = info ? `${info.label} (${formatMod(info.bonus)})` : ask.ask;
  setText(document.getElementById("ask-text"), `The DM asks ${ask.to ? "you" : "the table"} for ${what}.`);
}

function answerAsk() {
  if (!pendingAsk) return;
  const ask = pendingAsk;
  markAsk(ask.id);
  document.getElementById("ask-banner").hidden = true;
  const info = askBonus(state.character, ask.ask);
  const purpose = document.getElementById("roll-for");
  state.dice.count = 1;
  state.dice.sides = 20;
  state.dice.mode = "normal";
  document.getElementById("dice-count").value = "1";
  if (purpose) purpose.value = info ? info.label : ask.ask;
  showTab("dice");
  if (info) {
    state.dice.modifier = info.bonus;
    document.getElementById("dice-mod").value = String(info.bonus);
    doRoll();
  } else {
    paintDice();
    paintPurposes();
    document.getElementById("dice-mod")?.focus();
  }
}

function skipAsk() {
  if (!pendingAsk) return;
  markAsk(pendingAsk.id);
  pendingAsk = null;
  document.getElementById("ask-banner").hidden = true;
}

function rollSkill(id) {
  const skill = findSkill(id);
  if (!skill || gateMode !== "play") return;
  const bonus = skillBonus(state.character, id);
  state.dice.count = 1;
  state.dice.sides = 20;
  state.dice.modifier = bonus;
  state.dice.mode = "normal";
  const count = document.getElementById("dice-count");
  const mod = document.getElementById("dice-mod");
  const purpose = document.getElementById("roll-for");
  if (count) count.value = "1";
  if (mod) mod.value = String(bonus);
  if (purpose) purpose.value = skill.label;
  showTab("dice");
  doRoll();
}

function renderCharacter() {
  const character = state.character;
  const view = presentCharacter(character);
  const summary = document.getElementById("character-summary");
  if (!view) {
    summary.replaceChildren(
      h("p", { class: "sheet-title" }, "A blank sheet"),
      h("p", { class: "hint" }, "Choose a people and a class, or write your own."),
    );
  } else {
    summary.replaceChildren(...present([
      h("p", { class: "sheet-title" }, view.title),
      h("p", { class: "math" }, view.meta),
      h("p", {}, view.abilities),
      view.saves ? h("p", { class: "hint" }, `Saves: ${view.saves}.`) : null,
      view.hp ? h("p", {}, view.hp) : null,
      view.languages ? h("p", { class: "hint" }, view.languages) : null,
      view.skills ? h("p", { class: "hint" }, view.skills) : null,
    ]));
  }

  setControl("character-name", character.name);
  setControl("character-level", character.level);
  setControl("character-alignment", character.alignment);
  showField("custom-alignment-field", character.alignment === "custom");
  setControl("character-custom-alignment", character.customAlignment);
  setControl("character-race", character.raceId);
  syncLineage();
  showField("custom-race-field", character.raceId === "custom");
  showField("racial-bonus-field", character.raceId === "custom");
  setControl("character-custom-race", character.customRace);
  setControl("character-custom-size", character.customSize);
  setControl("character-custom-speed", character.customSpeed);
  setControl("character-custom-languages", character.customLanguages);
  const bonusMount = document.getElementById("racial-bonus-field");
  if (!bonusMount.childElementCount) {
    bonusMount.replaceChildren(...ABILITIES.map((ability) => h("label", {}, [
      ability.short,
      h("input", {
        type: "number",
        min: "-5",
        max: "6",
        "data-sheet": "racial-bonus",
        "data-ability": ability.id,
        "aria-label": `${ability.label} bonus`,
        value: "0",
      }),
    ])));
  }
  for (const input of bonusMount.querySelectorAll("input")) {
    if (document.activeElement === input) continue;
    input.value = String(character.customBonuses[input.dataset.ability] || 0);
  }
  const race = findRace(character.raceId);
  showField("heritage-field", Boolean(race?.picks));
  renderPickGrid(
    document.getElementById("heritage-picks"),
    ABILITIES.filter((ability) => ability.id !== "cha"),
    character.picks,
    "heritage",
  );

  setControl("character-class", character.classId);
  syncSubclass();
  const info = classInfo(character);
  showField("custom-class-field", character.classId === "custom");
  showField("save-field", character.classId === "custom");
  setControl("character-custom-class", character.customClass);
  setControl("character-hit-die", character.hitDie);
  setControl("character-skill-count", character.skillCount);
  renderPickGrid(document.getElementById("save-picks"), ABILITIES, character.saves, "save");
  if (!info) setText(document.getElementById("class-hint"), "Saves and the hit die appear with the class.");
  else if (info.custom) setText(document.getElementById("class-hint"), "A custom class chooses its own saves. Any skill can still be ticked.");
  else {
    const saves = info.saves.map((id) => findAbility(id).label).join(" and ");
    setText(document.getElementById("class-hint"), `Hit die d${info.hitDie}. Saves: ${saves}. A subclass usually waits until level ${info.subclassLevel}.`);
  }

  setControl("character-background", character.backgroundId);
  showField("custom-background-field", character.backgroundId === "custom");
  setControl("character-custom-background", character.customBackground);
  const background = findBackground(character.backgroundId);
  document.getElementById("background-skills").hidden = !background;
  if (character.backgroundId === "custom") setText(document.getElementById("background-hint"), "Write the name. Tick whichever skills the table agreed on.");
  else if (background) {
    const names = background.skills.map((id) => SKILLS.find((skill) => skill.id === id).label).join(" and ");
    setText(document.getElementById("background-hint"), `${background.name} offers ${names}.`);
  } else setText(document.getElementById("background-hint"), "");

  renderAbilities();
  const skillMount = document.getElementById("skill-grid");
  if (!skillMount.childElementCount) {
    skillMount.replaceChildren(...SKILLS.map((skill) => h("label", { "data-skill-label": skill.id }, [
      h("input", { type: "checkbox", "data-sheet": "skill", "data-skill": skill.id }),
      `${skill.label} · ${findAbility(skill.ability).short}`,
    ])));
  }
  const offered = new Set(offeredSkillIds(character));
  for (const skill of SKILLS) {
    const label = skillMount.querySelector(`[data-skill-label="${skill.id}"]`);
    label.classList.toggle("is-offered", offered.has(skill.id));
    label.querySelector("input").checked = character.skills.includes(skill.id);
  }
  setText(document.getElementById("skill-hint"), skillHint(character));

  const hp = document.getElementById("character-hp");
  const suggested = suggestedHp(character);
  if (document.activeElement !== hp) hp.value = character.hp == null ? "" : String(character.hp);
  hp.placeholder = suggested == null ? "Suggested" : String(suggested);
  if (!info) setText(document.getElementById("hp-hint"), "Pick a class and the suggested total uses its hit die.");
  else if (character.hp == null) setText(document.getElementById("hp-hint"), `Suggested ${suggested}, using a d${info.hitDie} and Constitution.`);
  else setText(document.getElementById("hp-hint"), `Set by hand. The die would suggest ${suggested}.`);
  setControl("character-traits", character.traits);
  renderKit();
}

function updateSheet(target, { log }) {
  if (gateMode === "view" || gateMode === "play") return false;
  const sheet = target.dataset.sheet;
  if (!sheet) return false;
  const character = state.character;
  let summary = "";
  if (sheet === "name") {
    character.name = target.value.slice(0, 80);
    summary = character.name ? `Named the character ${character.name}.` : "Cleared the character name.";
  } else if (sheet === "level") {
    character.level = readInt(target, character.level, 1, 20);
    summary = sheetLine();
  } else if (sheet === "alignment") {
    character.alignment = target.value;
    summary = sheetLine();
  } else if (sheet === "custom-alignment") {
    character.customAlignment = target.value.slice(0, 40);
    summary = sheetLine();
  } else if (sheet === "race") {
    character.raceId = target.value;
    lineageKey = "";
    const race = findRace(character.raceId);
    if (!race?.lineages.some((lineage) => lineage.id === character.lineageId)) {
      character.lineageId = race?.lineages[0]?.id || "";
    }
    if (!race?.picks) character.picks = [];
    summary = sheetLine();
  } else if (sheet === "lineage") {
    character.lineageId = target.value;
    summary = sheetLine();
  } else if (sheet === "custom-lineage") {
    character.customLineage = target.value.slice(0, 40);
    summary = sheetLine();
  } else if (sheet === "custom-race") {
    character.customRace = target.value.slice(0, 40);
    summary = sheetLine();
  } else if (sheet === "custom-size") {
    character.customSize = target.value === "Small" ? "Small" : "Medium";
    summary = sheetLine();
  } else if (sheet === "custom-speed") {
    const speed = looseInt(target.value);
    if (speed == null || speed < 0 || speed > 120) return true;
    character.customSpeed = speed;
    summary = sheetLine();
  } else if (sheet === "custom-languages") {
    character.customLanguages = target.value.slice(0, 80);
    summary = "Updated the character's languages.";
  } else if (sheet === "racial-bonus") {
    const bonus = looseInt(target.value);
    if (bonus == null || bonus < -5 || bonus > 6) return true;
    character.customBonuses[target.dataset.ability] = bonus;
    summary = `Set the custom ${findAbility(target.dataset.ability).label} bonus to ${formatMod(bonus)}.`;
  } else if (sheet === "heritage") {
    const id = target.dataset.ability;
    let picks = character.picks.filter((pick) => pick !== id);
    if (target.checked) picks = [...picks, id].slice(-2);
    character.picks = picks;
    summary = "Set the half-elf ability bonuses.";
  } else if (sheet === "class") {
    character.classId = target.value;
    subclassKey = "";
    const klass = findClass(character.classId);
    if (!klass?.subclasses.some((sub) => sub.id === character.subclassId)) character.subclassId = "";
    summary = sheetLine();
  } else if (sheet === "subclass") {
    character.subclassId = target.value;
    summary = sheetLine();
  } else if (sheet === "custom-class" || sheet === "custom-subclass") {
    const key = sheet === "custom-class" ? "customClass" : "customSubclass";
    character[key] = target.value.slice(0, 40);
    summary = sheetLine();
  } else if (sheet === "hit-die") {
    character.hitDie = Number(target.value);
    summary = `Set the custom hit die to a d${character.hitDie}.`;
  } else if (sheet === "skill-count") {
    const count = looseInt(target.value);
    if (count == null || count < 0 || count > 6) return true;
    character.skillCount = count;
    summary = `The custom class chooses ${count} skills.`;
  } else if (sheet === "save") {
    const id = target.dataset.ability;
    let saves = character.saves.filter((save) => save !== id);
    if (target.checked) saves = [...saves, id].slice(-2);
    character.saves = saves;
    summary = "Set the custom saving throws.";
  } else if (sheet === "background") {
    character.backgroundId = target.value;
    summary = sheetLine();
  } else if (sheet === "custom-background") {
    character.customBackground = target.value.slice(0, 40);
    summary = sheetLine();
  } else if (sheet === "array") {
    character.scores = assignStandard(character.scores, target.dataset.ability, Number(target.value));
    summary = `Set ${findAbility(target.dataset.ability).label} to ${character.scores[target.dataset.ability]}.`;
  } else if (sheet === "score") {
    const score = looseInt(target.value);
    if (score == null || score < 1 || score > 30) return true;
    character.scores[target.dataset.ability] = score;
    summary = `Set ${findAbility(target.dataset.ability).label} to ${score}.`;
  } else if (sheet === "skill") {
    const id = target.dataset.skill;
    const label = SKILLS.find((skill) => skill.id === id).label;
    if (target.checked) {
      if (!character.skills.includes(id)) character.skills.push(id);
      summary = `Took ${label}.`;
    } else {
      character.skills = character.skills.filter((skill) => skill !== id);
      summary = `Dropped ${label}.`;
    }
  } else if (sheet === "hp") {
    if (target.value.trim() === "") {
      character.hp = null;
      summary = "Using the suggested hit points.";
    } else {
      const hp = looseInt(target.value);
      if (hp == null || hp < 0 || hp > 999) return true;
      character.hp = hp;
      summary = `Set hit points to ${hp}.`;
    }
  } else if (sheet === "traits") {
    character.traits = target.value.slice(0, 1000);
    character.touched = true;
    persist();
    if (!log) {
      clearTimeout(traitTimer);
      traitTimer = setTimeout(() => persist("Updated character traits."), 600);
    }
    renderCharacter();
    return true;
  } else return false;

  character.touched = true;
  if (log && summary) persist(summary);
  else persist();
  renderCharacter();
  return true;
}

function applyScoreMethod(method) {
  state.character.method = method;
  if (method === "standard") state.character.scores = defaultScores();
  if (method === "pointbuy") {
    const spent = pointBuySpent(state.character.scores);
    if (spent == null || spent > POINT_BUY_BUDGET) {
      state.character.scores = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
    }
  }
  if (method === "rolled") state.character.scores = rollScores();
  const rolled = ABILITIES.map((ability) => `${ability.short} ${state.character.scores[ability.id]}`).join(", ");
  const summaries = {
    standard: "Set ability scores to the standard array.",
    pointbuy: "Set ability scores with point buy.",
    rolled: `Rolled ability scores: ${rolled}.`,
    manual: "Set ability scores by hand.",
  };
  state.character.touched = true;
  persist(summaries[method]);
  renderCharacter();
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
  const raceSelect = document.getElementById("character-race");
  raceSelect.replaceChildren(
    h("option", { value: "" }, "Choose a race"),
    ...RACES.map((race) => h("option", { value: race.id }, race.name)),
    h("option", { value: "custom" }, "Custom"),
  );
  const classSelect = document.getElementById("character-class");
  classSelect.replaceChildren(
    h("option", { value: "" }, "Choose a class"),
    ...CLASSES.map((klass) => h("option", { value: klass.id }, klass.name)),
    h("option", { value: "custom" }, "Custom"),
  );
  const backgroundSelect = document.getElementById("character-background");
  backgroundSelect.replaceChildren(
    h("option", { value: "" }, "No background yet"),
    ...BACKGROUNDS.map((background) => h("option", { value: background.id }, background.name)),
    h("option", { value: "custom" }, "Custom"),
  );
  document.getElementById("character-level").replaceChildren(...levelOptions(state.character.level));
  document.getElementById("character-alignment").replaceChildren(
    ...ALIGNMENTS.map(([id, label]) => h("option", { value: id }, label)),
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
  renderDrafts();
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
  renderCharacter();
}

function setSaveStatus(message) {
  const status = document.getElementById("save-status");
  if (status) status.textContent = message;
}

function downloadNight() {
  const file = exportNight(state);
  file.roster = roster;
  downloadJson(file, nightFilename(state));
  setSaveStatus("Saved a copy of this night. Keep that file. Clearing this browser leaves the file where you put it.");
}

async function restoreNight(file) {
  const input = document.getElementById("import-file");
  try {
    if (!file || file.size > SAVE_BYTES) {
      setSaveStatus("That file is too large to be a Lantern save.");
      return;
    }
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      setSaveStatus("That file is not a Lantern save.");
      return;
    }
    let night;
    try {
      night = importNight(payload);
    } catch (error) {
      setSaveStatus(error instanceof SaveError ? error.message : "That file is not a Lantern save.");
      return;
    }
    const ok = window.confirm("Replace the night stored in this browser with this file? The character, the fight, the lights, and the notes here will be overwritten.");
    if (!ok) {
      setSaveStatus("Restore cancelled. This browser still has the night it had.");
      return;
    }
    state = night;
    if (payload.roster) saveRoster(normalizeRoster(payload.roster));
    resumeRoster();
    openMarksId = null;
    announcedOut.clear();
    lineageKey = "";
    subclassKey = "";
    for (const light of state.lights) {
      if (light.endsAt <= Date.now()) announcedOut.add(light.id);
    }
    applyLoaded();
    paintGate();
    persist("Restored a saved night.");
    setSaveStatus("Restored the night from that file. It is stored in this browser again.");
  } finally {
    if (input) input.value = "";
  }
}

function resetAll() {
  const ok = window.confirm("Delete the game stored in this browser? The characters at each table, the fight, the party, the flames, the prompts, and the scratch notes go with it. A saved copy file is the way back.");
  if (!ok) return;
  clearState();
  clearRoster();
  roster = normalizeRoster(null);
  activeId = "";
  gateMode = "play";
  viewingId = "";
  sheetBeforeCreate = null;
  openMarksId = null;
  announcedOut.clear();
  state = normalize(null);
  document.getElementById("combatant-form").reset();
  document.getElementById("hero-form").reset();
  document.getElementById("monster-form").reset();
  fillSelects();
  applyLoaded();
  paintGate();
  lineageKey = "";
  subclassKey = "";
  persist("Cleared the fight, the party, the flames, the prompts, the character, and the notes.");
}

function onClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action } = button.dataset;
  if (action === "tab") {
    const next = button.dataset.tab;
    const open = next !== "dice" && document.getElementById(PLAYER_MODULES[next])?.open;
    showTab(gateMode === "play" && open ? "dice" : next);
  } else if (action === "close-module") button.closest("dialog")?.close();
  else if (action === "roll-skill") rollSkill(button.dataset.id);
  else if (action === "use-item") spendItem(button.dataset.id);
  else if (action === "open-gear") openGear();
  else if (action === "buy-staples") buyStaples();
  else if (action === "skip-staples") document.getElementById("gear-restock")?.replaceChildren();
  else if (action === "sheet-hp") changeSheetHp(Number(button.dataset.delta));
  else if (action === "sheet-mark") flipPackMark(button.dataset.mark);
  else if (action === "short-rest") takeShortRest();
  else if (action === "long-rest") takeLongRest();
  else if (action === "death") tapDeath(button.dataset.kind);
  else if (action === "roll-initiative") void rollInitiative();
  else if (action === "toggle-chime") toggleChime();
  else if (action === "open-whispers") showTab("table");
  else if (action === "close-gear") document.getElementById("gear-dialog").close();
  else if (action === "shop-tab") showShopPane(button.dataset.shop);
  else if (action === "buy-item") purchase(button.dataset.id);
  else if (action === "sell-item") sellPiece(button.dataset.id);
  else if (action === "buy-back") buyBackPiece(button.dataset.id, button.dataset.cp);
  else if (action === "roll") doRoll();
  else if (action === "set-sides") {
    state.dice.sides = Number(button.dataset.sides);
    doRoll();
  }   else if (action === "set-mode") {
    state.dice.mode = button.dataset.mode;
    paintDice();
    persist(`Set dice to ${state.dice.mode}.`);
  } else if (action === "purpose") {
    const field = document.getElementById("roll-for");
    field.value = button.dataset.purpose || "";
    paintPurposes();
    persist();
  } else if (action === "clear-rolls") {
    state.dice.history = [];
    persist("Cleared the dice history.");
    paintDice();
    renderIdleResult();
    renderHistory();
  } else if (action === "hp") bumpHp(button.dataset.id, Number(button.dataset.delta));
  else if (action === "reroll") rerollOne(button.dataset.id);
  else if (action === "reroll-all") rerollAll();
  else if (action === "remove-combatant") removeCombatant(button.dataset.id);
  else if (action === "next") stepTurn(1);
  else if (action === "back") stepTurn(-1);
  else if (action === "seat-four" || action === "remove-hero" || action === "remove-monster") return;
  else if (action === "draw" || action === "draw-scene" || action === "copy-spark" || action === "dismiss-spark") return;
  else if (action === "hood") toggleHood(button.dataset.id);
  else if (action === "snuff") snuff(button.dataset.id);
  else if (action === "score-method") applyScoreMethod(button.dataset.method);
  else if (action === "roll-scores") applyScoreMethod("rolled");
  else if (action === "point") {
    const ability = button.dataset.ability;
    state.character.scores = stepPointBuy(state.character.scores, ability, Number(button.dataset.delta));
    state.character.touched = true;
    persist(`Set ${findAbility(ability).label} to ${state.character.scores[ability]}.`);
    renderCharacter();
  } else if (action === "background-skills") {
    state.character.skills = addBackgroundSkills(state.character);
    state.character.touched = true;
    persist("Added the background skills.");
    renderCharacter();
  } else if (action === "suggest-hp") {
    state.character.hp = null;
    state.character.touched = true;
    persist("Using the suggested hit points.");
    renderCharacter();
  } else if (action === "reset") resetAll();
  else if (action === "edit-seat") editSeat();
  else if (action === "answer-ask") answerAsk();
  else if (action === "skip-ask") skipAsk();
  else if (action === "open-keys") document.getElementById("keys-dialog")?.showModal();
  else if (action === "close-keys") document.getElementById("keys-dialog")?.close();
  else if (action === "export-night") downloadNight();
  else if (action === "import-night") document.getElementById("import-file")?.click();
  else if (action === "open-roster") openRoster();
  else if (action === "create-character") beginCreate();
  else if (action === "save-character") saveNewCharacter();
  else if (action === "load-character") loadCharacter(button.dataset.id);
  else if (action === "view-character") viewCharacter(button.dataset.id);
  else if (action === "export-character") exportOne(button.dataset.id);
  else if (action === "import-character") document.getElementById("import-character")?.click();
  else if (action === "mark-dead") markCharacterDead();
  else if (action === "creator-step") {
    const index = CREATOR_STEPS.findIndex((item) => item.id === button.dataset.step);
    if (index >= 0) creatorStep = index;
    paintCreator();
  } else if (action === "add-draft") addDraft();
  else if (action === "delete-draft") deleteDraft(button.dataset.id);
}

function onSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  if (form.id === "seat-form") joinSeat(form);
  else if (form.id === "talk-form") void sendTalk();
  else if (form.dataset.form === "combatant") addCombatant(form);
  else if (form.dataset.form === "hero" || form.dataset.form === "monster") return;
  else if (form.dataset.form === "light") strike(form);
}

function onInput(event) {
  const target = event.target;
  if (target.dataset?.sheet) {
    updateSheet(target, { log: false });
    return;
  }
  if (target.dataset?.draft) {
    rememberDraft(target);
    return;
  }
  if (target.id === "notes") {
    state.notes = target.value.slice(0, 4000);
    persist();
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => persist("Updated scratch notes."), 600);
    return;
  }
  if (target.id === "roll-for") {
    paintPurposes();
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
  if (target.dataset?.sheet) {
    updateSheet(target, { log: true });
    return;
  }
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
    persist(`Set ${hero.name || "an adventurer"} to level ${hero.level}.`);
    renderThreat();
  } else if (field === "init") {
    const person = findCombatant(id);
    if (!person) return;
    person.init = readInt(target, person.init, -100, 200);
    person.die = null;
    persist(`Set ${person.name}'s initiative to ${person.init}.`);
    renderCombat();
  } else if (field === "mark") {
    const person = findCombatant(id);
    if (!person || !MARKS.includes(target.dataset.mark)) return;
    person.marks = person.marks.filter((mark) => mark !== target.dataset.mark);
    if (target.checked) person.marks.push(target.dataset.mark);
    person.marks.sort((a, b) => MARKS.indexOf(a) - MARKS.indexOf(b));
    openMarksId = id;
    persist(`${person.name}: ${person.marks.join(", ") || "no conditions"}.`);
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
      persist(`Renamed a combatant to ${person.name}.`);
      renderBanner();
      return;
    }
    if (field === "ac" && target.value.trim() === "") {
      person.ac = null;
      persist(`Cleared ${person.name}'s armor class.`);
      return;
    }
    if (field === "hp") {
      person.hp = readInt(target, person.hp, 0, 9999);
      persist(`${person.name} is at ${person.hp} hit points.`);
    }
    if (field === "maxhp") {
      person.maxHp = readInt(target, person.maxHp, 0, 9999);
      persist(`Set ${person.name}'s hit point maximum to ${person.maxHp}.`);
    }
    if (field === "ac") {
      person.ac = readInt(target, person.ac ?? 10, 0, 40);
      persist(`Set ${person.name}'s armor class to ${person.ac}.`);
    }
    renderCombat();
  } else if (field === "monster-count" || field === "monster-xp") {
    const monster = state.monsters.find((item) => item.id === id);
    if (!monster) return;
    if (field === "monster-count") monster.count = readInt(target, monster.count, 1, 40);
    if (field === "monster-xp") monster.xp = readInt(target, monster.xp, 0, 2000000);
    persist(`Set ${monster.name} to ${monster.count} × ${formatXp(monster.xp)} XP.`);
    renderThreat();
  }
}

function onToggle(event) {
  const details = event.target.closest?.("details[data-marks]");
  if (!details) return;
  openMarksId = details.open ? details.dataset.marks : null;
}

function onKey(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.target.closest("input, textarea, select")) return;
  if (event.key === "?") {
    event.preventDefault();
    document.getElementById("keys-dialog")?.showModal();
    return;
  }
  if (gateMode !== "play") return;
  if (event.target.closest("button") && !event.target.closest("dialog")) return;
  const tabs = { 1: "dice", 2: "order", 3: "character", 4: "notes", 5: "table" };
  if (tabs[event.key]) {
    event.preventDefault();
    const next = tabs[event.key];
    const open = next !== "dice" && document.getElementById(PLAYER_MODULES[next])?.open;
    showTab(open ? "dice" : next);
  } else if (event.key === "r" && !document.querySelector("dialog[open]")) {
    event.preventDefault();
    doRoll();
  } else if (event.key === "n" && document.getElementById("module-order")?.open && !document.body.classList.contains("is-seated")) {
    event.preventDefault();
    stepTurn(1);
  }
}

function boot() {
  bootTextSize(document.getElementById("text-size"));
  paintChime();
  registerOffline();
  bootSeat();
  resumeRoster();
  fillSelects();
  for (const light of state.lights) {
    if (light.endsAt <= Date.now()) announcedOut.add(light.id);
  }
  const before = state.combat.activeId;
  if (!state.combat.started) state.combat.activeId = null;
  ensureActive();
  applyLoaded();
  paintGate();
  if (state.combat.activeId !== before || (loadSeat().name && loadSeat().room)) persist();
  document.getElementById("import-character")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void importCharacter(file);
  });
  document.getElementById("import-file")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) void restoreNight(file);
  });
  for (const dialog of document.querySelectorAll("dialog.module-dialog")) {
    dialog.addEventListener("close", () => {
      if (!moduleSync || gateMode !== "play") return;
      if ([...document.querySelectorAll("dialog.module-dialog")].some((item) => item.open)) return;
      if (state.tab === "dice") {
        paintPlayerTabs("dice");
        return;
      }
      state.tab = "dice";
      paintPlayerTabs("dice");
      persist();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  }
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
  setInterval(() => { void flushShare(); }, 8000);
  setInterval(() => { void watchShop(); }, 2000);
  void watchShop().finally(() => { chimeArmed = true; });
}

boot();
