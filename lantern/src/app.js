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
  defaultScores,
  findAbility,
  findBackground,
  findClass,
  findRace,
  findSkill,
  formatMod,
  breathDice,
  darkvisionRange,
  maxHitPoints,
  classGrant,
  offeredSkillIds,
  peopleGrant,
  pointBuySpent,
  presentCharacter,
  racialBonuses,
  rollScores,
  skillBonus,
  skillHint,
  stepPointBuy,
  suggestedHp,
} from "./character.js";
import { facesLabel, formula, roll, STANDARD_SIDES } from "./dice.js";
import {
  coinCounts,
  counterFor,
  equipNewCharacter,
  findGear,
  findOffer,
  formatCoin,
  buyBackItem,
  kitChoices,
  kitOptions,
  payCounter,
  sellOffers,
  stapleIds,
  sellPrice,
  sellToCounter,
  useItem,
} from "./gear.js";
import { CR_XP, formatXp, rateEncounter } from "./encounter.js";
import { findLight, formatRemaining, LIGHTS, lightCaption, lightOptionLabel } from "./lights.js";
import { MARKS } from "./marks.js";
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
import { HISTORY_CAP, SAVE_BYTES, SaveError, clearState, exportNight, importNight, loadState, nightFilename, normalize, saveState } from "./store.js";
import {
  AMMO_IDS,
  ATTUNE_CAP,
  COLORS,
  MACRO_CAP,
  PORTRAIT_CHARS,
  TRINKET_CAP,
  ammoPerBundle,
  applyDamage,
  applyHealing,
  applyTemp,
  attunedCount,
  blankExtras,
  carriedWeight,
  classResources,
  classSlots,
  cleanExtras,
  concentrationDc,
  critDamage,
  encumbrance,
  formulaText,
  levelUpSteps,
  applyGift,
  levelForXp,
  XP_LEVELS,
  parseFormula,
  potionHealing,
  restExtras,
  splitCoin,
  syncAmmo,
  tickResource,
  tickSlot,
  toggleAttune,
} from "./extras.js";
import { armorClass } from "./armor.js";
import { blankDeath, cleanDeath, cleanOrder, sortOrder } from "./order.js";
import { DM_NAME, SOLO_ROOM, fetchRoom, joinRoom, loadSeat, normalizeCode, postBoard, postBuyback, postInitiative, postTalk, postVitals, pushTable, rollSummary, saveSeat } from "./table.js";
import { mentions, paintHere, paintPins, paintTalk, paintTargets, typingLine } from "./talk.js";
import { bootTextSize } from "./textsize.js";
import { bootDisplay } from "./display.js";
import { cleanSpell, readLibraryFile, readPdfContent } from "./library.js";
import { registerOffline } from "./pwa.js";
import { hourText, turnTimerText } from "./combat.js";
import { downloadText, icsFor } from "./session.js";
import { bootPlayerMap, paintPlayerMap } from "./playermap.js";

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
let sharedOrder = null;
let revising = false;
const SAVE_OFFER_KEY = "lantern.offered-save";
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
  { id: "people", copy: "Traits, languages, and darkvision appear with the people you choose." },
  { id: "class", copy: "Features, the one subclass in this subset, hit points, and proficiencies appear with the class." },
  { id: "scores", copy: "The totals stay visible. The modifier changes as you move a score." },
  { id: "story", copy: "Background, skills, and the hit points they sit down with." },
  { id: "review", copy: "Read the sheet. Choose a kit, then sit down. That is what saves." },
];

function sharedSnapshot() {
  const snapshot = { ...state };
  delete snapshot.drafts;
  return snapshot;
}

function currentIntent() {
  return document.getElementById("roll-for")?.value || "";
}

function persist(summary, { secret = false, ask = "", total } = {}) {
  if (gateMode === "play" && activeId) {
    const code = seatedCode();
    if (code) {
      roster = writeSheet(roster, code, activeId, state.character);
      saveRoster(roster);
    }
  }
  saveState(state);
  if (typeof summary === "string" && summary.trim()) {
    const text = summary.trim().slice(0, 300);
    if (secret || ask) {
      const entry = { text };
      if (secret) entry.secret = true;
      if (ask) {
        entry.ask = ask;
        if (Number.isInteger(total)) entry.total = total;
      }
      shareQueue.push(entry);
    } else shareQueue.push(text);
  }
  clearTimeout(shareTimer);
  shareTimer = setTimeout(() => { void flushShare(); }, shareQueue.length ? 30 : 280);
}

function playingAlone() {
  return loadSeat().solo === true;
}

function atSharedTable() {
  const seat = loadSeat();
  return Boolean(seat.token && seat.room && !seat.solo);
}

async function flushShare() {
  if (flushing) return;
  const seat = loadSeat();
  if (!seat.name || !seat.room || seat.solo) {
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
    if (result.order) applySharedOrder(result.order);
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
  const seated = Boolean(seat.solo || (seat.name && seat.room));
  document.body.classList.toggle("is-seated", seated && !seat.solo ? true : seated);
  const edit = document.getElementById("edit-seat");
  if (edit) edit.hidden = !seated || document.body.classList.contains("seat-editing");
  if (seat.solo) {
    status.textContent = "Playing alone in this browser. The night stays here.";
    return;
  }
  if (!seat.name || !seat.room) {
    status.textContent = "Play alone, or join with a four-character code.";
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
  const params = new URLSearchParams(location.search);
  const fromUrl = normalizeCode(params.get("room"));
  if (fromUrl) seat.room = fromUrl;
  const handed = params.get("seat") || "";
  if (fromUrl && /^[a-f0-9]{32}$/.test(handed)) {
    // A link from the DM that hands this device an existing seat.
    seat.token = handed;
    seat.solo = false;
    if (params.get("name")) seat.name = params.get("name").trim().slice(0, 40);
    const clean = new URL(location.href);
    clean.searchParams.delete("seat");
    clean.searchParams.delete("name");
    history.replaceState(null, "", clean);
  }
  document.getElementById("seat-name").value = seat.name;
  document.getElementById("seat-room").value = seat.room;
  if (fromUrl) saveSeat(seat);
  paintSeatStatus();
  paintPurposes();
}

function startSolo(name) {
  const who = name.trim().slice(0, 40);
  const status = document.getElementById("seat-status");
  if (!who) {
    if (status) status.textContent = "Add your name, then play alone.";
    return;
  }
  saveSeat({ name: who, room: SOLO_ROOM, token: "", solo: true });
  sharedOrder = null;
  document.body.classList.remove("seat-editing");
  seatError = "";
  paintSeatStatus();
  openTableGate();
  renderCombat();
}

async function joinSeat(form) {
  const name = form.elements.name.value.trim().slice(0, 40);
  const room = normalizeCode(form.elements.room.value);
  const status = document.getElementById("seat-status");
  if (!name) {
    if (status) status.textContent = "Add your name.";
    return;
  }
  if (!room) {
    startSolo(name);
    return;
  }
  if (room.length < 4) {
    if (status) status.textContent = "The code is four characters. Leave it blank to play alone.";
    return;
  }
  if (name.toLowerCase() === DM_NAME.toLowerCase()) {
    if (status) status.textContent = "That name is the DM's. Pick another.";
    return;
  }
  const joined = await joinRoom(room, name);
  if (!joined.ok) {
    if (status) status.textContent = joined.error;
    return;
  }
  form.elements.room.value = room;
  saveSeat({ name: joined.name, room, token: joined.token, solo: false });
  document.body.classList.remove("seat-editing");
  seatError = "";
  paintSeatStatus();
  persist("Joined the table.");
  openTableGate();
  renderCombat();
}

function seatedCode() {
  const seat = loadSeat();
  if (seat.solo) return SOLO_ROOM;
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
  party: "module-party",
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
  for (const name of ["dice", "order", "threat", "spark", "character", "notes", "table", "party"]) {
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
      list.length ? h("button", { type: "button", class: "btn", "data-action": "open-roster" }, "Back") : null,
      h("button", { type: "button", class: "btn", "data-action": "import-character" }, "Import a character file or PDF sheet"),
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
    h("button", { type: "button", class: "btn", "data-action": "import-character" }, "Import a character file or PDF sheet"),
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
  if (saveBottom && creating) {
    saveBottom.hidden = step.id !== "review";
    saveBottom.textContent = revising ? "Save the revision" : "Sit down";
  }
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
    const voiced = talkPayload(text);
    if (!voiced.text) {
      if (status) status.textContent = "Write a message first.";
      return;
    }
    await postTalk(seat.room, {
      ...voiced,
      to: document.getElementById("talk-to")?.value || "",
    }, seat.token);
    typingSentAt = 0;
    void postBoard(seat.room, { op: "typing", on: false }).catch(() => {});
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

function offerSaveOnce() {
  try {
    if (localStorage.getItem(SAVE_OFFER_KEY)) return;
    localStorage.setItem(SAVE_OFFER_KEY, "1");
  } catch {
    return;
  }
  if (window.confirm("Save a copy of this night? This browser holds the game. A saved copy is a file you keep.")) {
    downloadNight();
  }
}

function saveNewCharacter() {
  const code = seatedCode();
  const name = state.character.name.trim();
  if (!name) {
    setGateStatus("Give this character a name.");
    return;
  }
  if (!revising && !state.character.kitId) {
    setGateStatus("Choose a starting kit, then sit down.");
    const note = document.getElementById("kit-note");
    if (note) note.textContent = "Choose a starting kit, then sit down.";
    return;
  }
  state.character.touched = true;
  if (!revising) state.character = equipNewCharacter(state.character);
  if (!Number.isInteger(state.character.maxHp)) {
    const current = state.character.hp;
    state.character.maxHp = current == null ? suggestedHp(state.character) : Math.max(current, suggestedHp(state.character) || current);
  }
  if (revising && activeId) {
    roster = writeSheet(roster, code, activeId, state.character);
    saveRoster(roster);
    revising = false;
    sheetBeforeCreate = null;
    setGateStatus("");
    showPlay();
    renderCharacter();
    persist(`Revised ${name}.`);
    return;
  }
  const made = addCharacter(roster, code, state.character);
  if (!made) return;
  roster = made.roster;
  activeId = made.entry.id;
  saveRoster(roster);
  sheetBeforeCreate = null;
  revising = false;
  setGateStatus("");
  showPlay();
  renderCharacter();
  persist(`Sits down as ${name}.`);
  offerSaveOnce();
}

function beginRevise() {
  if (!activeId || !seatedCode()) return;
  revising = true;
  creatorStep = 0;
  gateMode = "create";
  viewingId = "";
  renderCharacter();
  paintGate();
}

async function importCharacter(file) {
  const code = seatedCode();
  if (!code) {
    setGateStatus("Play alone or join a table first. Characters are kept per table.");
    return;
  }
  let sheet;
  let dead;
  let fromPdf = false;
  try {
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      setGateStatus("Reading the sheet…");
      const { readPdf, looksScanned } = await import("./pdfread.js");
      const pdf = await readPdf(file);
      if (looksScanned(pdf)) throw new Error("That PDF is a picture of a sheet, with no text to read. A fillable sheet or one exported from an app works.");
      sheet = readPdfContent(pdf, "character").character;
      if (!sheet) throw new Error("No character sheet found in that PDF.");
      if (!sheet.name.trim()) sheet = { ...sheet, name: file.name.replace(/\.pdf$/i, "").slice(0, 80) };
      dead = false;
      fromPdf = true;
    } else {
      if (file.size > SAVE_BYTES) throw new Error("That file is too large to be a character.");
      ({ sheet, dead } = readCharacterFile(JSON.parse(await file.text())));
    }
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
  if (fromPdf) {
    beginRevise();
    creatorStep = CREATOR_STEPS.findIndex((item) => item.id === "review");
    paintCreator();
    setGateStatus(`Read ${sheet.name} from the PDF. Check each step, then sit down.`);
  }
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
  if (!["dice", "order", "character", "notes", "table", "party"].includes(tab)) tab = "dice";
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
  if (tab === "order" && gateMode === "play") renderCombat();
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
  const filter = document.getElementById("history-filter")?.value || "";
  const shown = state.dice.history.filter((item) => (!filter ? true : filter === "secret" ? item.secret : rollKind(item) === filter));
  if (!shown.length && state.dice.history.length) {
    mount.replaceChildren(h("p", { class: "hint" }, "No rolls of that kind yet."));
    return;
  }
  mount.replaceChildren(...shown.map((item) => h("article", { class: item.tag ? `ticket ${item.tag}` : "ticket" }, present([
    h("p", { class: "ticket-total" }, String(item.total)),
    item.purpose || item.target ? h("p", { class: "ticket-detail" }, [item.purpose, item.target && `at ${item.target}`].filter(Boolean).join(" ")) : null,
    item.secret ? h("p", { class: "ticket-secret" }, "Secret") : null,
    h("p", {}, item.formula),
    h("p", { class: "ticket-detail" }, item.detail),
  ]))));
}

function doRoll() {
  syncDiceNumbers();
  pendingDamage = null;
  return performRoll({
    count: state.dice.count,
    sides: state.dice.sides,
    modifier: state.dice.modifier,
    mode: state.dice.mode,
    purpose: currentIntent(),
    secret: secretChecked(),
    target: currentTarget(),
  });
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
        person.hp <= 0 ? deathPips(person, true) : null,
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
      h("label", {}, [
        "Exhaustion",
        h("input", {
          type: "number",
          min: "0",
          max: "6",
          "data-field": "exhaustion",
          "data-id": person.id,
          value: String(person.exhaustion || 0),
          "aria-label": `Exhaustion for ${person.name}`,
        }),
      ]),
      h("button", { type: "button", class: "text-btn", "data-action": "reroll", "data-id": person.id }, "Reroll"),
      h("button", { type: "button", class: "text-btn", "data-action": "remove-combatant", "data-id": person.id }, "Remove"),
    ]),
  ]);
}

function deathPips(person, editable) {
  const death = cleanDeath(person.death);
  const pip = (kind, index) => {
    const on = (kind === "success" ? death.success : death.failure) > index;
    const className = `pip${on ? " is-on" : ""}${kind === "failure" ? " is-fail" : ""}`;
    if (!editable) return h("span", { class: className });
    return h("button", {
      type: "button",
      class: className,
      "data-action": "death-pip",
      "data-id": person.id,
      "data-kind": kind,
      "data-index": String(index),
      "aria-pressed": on ? "true" : "false",
      "aria-label": `${kind} ${index + 1} for ${person.name}`,
    });
  };
  return h("div", { class: "death-pips" }, [
    death.stable ? h("span", { class: "stable-flag" }, "Stable") : h("span", { class: "down-flag" }, "Down"),
    ...[0, 1, 2].map((index) => pip("success", index)),
    ...[0, 1, 2].map((index) => pip("failure", index)),
  ]);
}

function readOnlyRow(person, active) {
  return h("article", { class: active ? "combatant is-active" : person.hp <= 0 ? "combatant is-down" : "combatant" }, [
    h("p", {}, `${person.name} · init ${person.init} · ${person.hp}/${person.maxHp} · AC ${person.ac ?? "—"}`),
    person.exhaustion ? h("p", { class: "hint" }, `Exhaustion ${person.exhaustion}`) : null,
    person.marks?.length ? h("p", { class: "hint" }, person.marks.join(", ")) : null,
    person.hp <= 0 ? deathPips(person, false) : null,
  ]);
}

function renderCombat() {
  paintTargets2();
  const shared = atSharedTable();
  const note = document.getElementById("order-shared-note");
  const form = document.getElementById("combatant-form");
  if (note) note.hidden = !shared;
  if (form) form.hidden = shared;
  for (const id of ["turn-back", "turn-next", "reroll-all"]) {
    const node = document.getElementById(id);
    if (node) node.hidden = shared;
  }
  const mount = document.getElementById("combat-list");
  if (!mount) return;
  if (shared) {
    const order = sharedOrder || cleanOrder(null);
    const list = [...order.combatants].sort((a, b) => b.init - a.init || a.order - b.order);
    const banner = document.getElementById("turn-banner");
    const meta = document.getElementById("turn-meta");
    if (!list.length) {
      mount.replaceChildren(h("p", { class: "empty" }, "No one has rolled initiative yet."));
      if (banner) banner.textContent = "The round has not started";
      if (meta) meta.textContent = "Roll from the sheet to join the list.";
      return;
    }
    const active = order.started ? order.activeId : null;
    const current = list.find((person) => person.id === active);
    if (banner) banner.textContent = current ? `${current.name} · round ${order.round}` : "The round has not started";
    if (meta) meta.textContent = "The DM moves the round.";
    mount.replaceChildren(...list.map((person) => readOnlyRow(person, person.id === active)));
    paintTurnHelper();
    return;
  }
  ensureActive();
  renderBanner();
  const list = turnOrder();
  if (!list.length) {
    mount.replaceChildren(h("p", { class: "empty" }, "No one has rolled initiative."));
    return;
  }
  mount.replaceChildren(...list.map((person) => combatRow(person, person.id === state.combat.activeId)));
  paintTurnHelper();
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
  if (atSharedTable()) return;
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
  if (!mount) return;
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
  if (!mount) return;
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
  if (!document.getElementById("threat-summary")) return;
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
  if (!mount) return;
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

function sceneNow() {
  return state.lightsPausedAt == null ? Date.now() : state.lightsPausedAt;
}

function paintPause() {
  const button = document.getElementById("pause-scene");
  if (!button) return;
  button.textContent = state.pauseReason === "user" ? "The scene moves" : "The scene froze";
}

function resumeLights() {
  if (state.lightsPausedAt == null) return;
  const delta = Date.now() - state.lightsPausedAt;
  for (const light of state.lights) light.endsAt += delta;
  state.lightsPausedAt = null;
  state.pauseReason = "";
}

function togglePause() {
  if (state.pauseReason === "user") resumeLights();
  else if (state.lightsPausedAt == null) {
    state.lightsPausedAt = Date.now();
    state.pauseReason = "user";
  } else {
    state.pauseReason = "user";
  }
  paintPause();
  flameSignature = "";
  persist(state.pauseReason === "user" ? "The scene froze." : "The scene moves.");
  renderFlames();
}

function onVisibility() {
  if (document.hidden) {
    if (state.lightsPausedAt == null) {
      state.lightsPausedAt = Date.now();
      state.pauseReason = "hidden";
      persist();
    }
    return;
  }
  if (state.pauseReason === "hidden") {
    resumeLights();
    flameSignature = "";
    persist();
    renderFlames();
  }
}

function renderFlames() {
  const mount = document.getElementById("flames");
  const now = sceneNow();
  paintPause();
  const seen = darkvisionRange(state.character) > 0;
  if (!state.lights.length) {
    flameSignature = "";
    mount.replaceChildren();
    return;
  }
  const signature = `${seen ? "see" : "dark"}|${state.pauseReason}|${state.lights.map((light) => `${light.id}:${light.kind}:${light.covered}`).join("|")}`;
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
        h("p", { class: "flame-caption" }, `${lightCaption(spec, light.covered)}${seen ? " You still see." : ""}`),
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
    endsAt: sceneNow() + spec.minutes * 60 * 1000,
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
  const out = Boolean(light && light.endsAt <= sceneNow());
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
    setText(card.querySelector(".ability-total"), `Total ${total}, modifier ${formatMod(abilityMod(total))}`);
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
  setText(document.getElementById("kit-hp"), "");
  setText(document.getElementById("kit-purse"), character.purse == null ? "" : formatCoin(character.purse));
  paintPortrait(character);
  paintVitals(character);
  paintConditions();
  paintAbilities(character);
  paintResources(character);
  paintSlots();
  paintTonight(character);
  paintSpellbook();
  paintKitChoices();
  paintWeight(character);
  paintAmmo(character);
  paintTrinkets();
  paintLevelUp(character);
  renderMacros();
  paintAfterRoll();
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

function heroDeath() {
  if (atSharedTable() && sharedOrder) {
    const seat = loadSeat();
    const mine = sharedOrder.combatants.find((person) => person.seat === seat.name || person.name === state.character.name);
    if (mine) return mine.death;
  }
  const local = state.combat.combatants.find((person) => person.name === state.character.name);
  return local?.death || state.character.death || blankDeath();
}

function typingInside(mount) {
  const active = document.activeElement;
  return Boolean(mount && active && mount.contains(active) && active.matches("input, textarea, select"));
}

function paintVitals(character) {
  const mount = document.getElementById("kit-vitals");
  if (!mount || typingInside(mount)) return;
  const current = character.hp == null ? (suggestedHp(character) ?? 0) : character.hp;
  const max = maxHitPoints(character);
  const ac = armorClass(character);
  const death = cleanDeath(heroDeath());
  const down = current <= 0;
  mount.replaceChildren(...present([
    h("p", { class: "sheet-title" }, `Hit points ${current} / ${max}${extras().tempHp ? ` · ${extras().tempHp} temporary` : ""}`),
    h("div", { class: "turn-actions" }, [
      h("button", { type: "button", class: "btn", "data-action": "hero-hp", "data-delta": "-1" }, "−1"),
      h("button", { type: "button", class: "btn", "data-action": "hero-hp", "data-delta": "1" }, "+1"),
    ]),
    h("div", { class: "turn-actions amount-row" }, [
      h("label", {}, ["Amount", h("input", { id: "kit-amount", type: "number", min: "0", max: "999", inputmode: "numeric", placeholder: "0" })]),
      h("button", { type: "button", class: "btn", "data-action": "hero-damage" }, "Damage"),
      h("button", { type: "button", class: "btn", "data-action": "hero-heal" }, "Heal"),
      h("button", { type: "button", class: "btn", "data-action": "hero-temp" }, "Temp HP"),
    ]),
    h("div", { class: "turn-actions" }, [
      h("button", { type: "button", class: "btn", "data-action": "short-rest" }, "Short rest"),
      h("button", { type: "button", class: "btn", "data-action": "long-rest" }, "Long rest"),
      h("button", {
        type: "button",
        class: "btn",
        "data-action": "toggle-inspiration",
        "aria-pressed": character.inspiration ? "true" : "false",
      }, character.inspiration ? "Inspiration" : "No inspiration"),
    ]),
    h("label", {}, [
      "Armor class",
      h("input", {
        id: "kit-ac",
        type: "number",
        min: "0",
        max: "40",
        inputmode: "numeric",
        value: character.acOverride == null ? "" : String(character.acOverride),
        placeholder: String(ac),
        "aria-label": "Armor class override",
      }),
    ]),
    h("p", { class: "hint" }, character.acOverride == null
      ? `From the pack: ${ac}. Type a number to override it.`
      : `Override ${character.acOverride}. Clear it to use the pack again.`),
    down ? h("p", { class: death.stable ? "stable-flag" : "down-flag" }, death.stable ? "Stable" : "Death saves") : null,
    down ? h("p", { class: "hint" }, `${death.success} successes, ${death.failure} failures. The order row keeps the pips.`) : null,
  ]));
}

function paintTonight(character) {
  const mount = document.getElementById("kit-tonight");
  if (!mount || typingInside(mount)) return;
  const breath = breathDice(character);
  const spells = character.spells || [];
  mount.replaceChildren(...present([
    h("h3", {}, "Tonight"),
    breath ? h("button", { type: "button", class: "btn", "data-action": "stage-breath" }, `${breath.damage} breath · ${breath.count}d6`) : null,
    ...spells.map((spell) => h("div", { class: "gear-row" }, [
      h("input", {
        type: "text",
        value: spell.name,
        maxlength: "60",
        "data-spell": "name",
        "data-id": spell.id,
        "aria-label": "Spell name",
      }),
      h("input", {
        type: "number",
        min: "0",
        max: "9",
        value: String(spell.slot),
        "data-spell": "slot",
        "data-id": spell.id,
        "aria-label": "Spell slot",
      }),
      h("label", {}, [
        h("input", {
          type: "checkbox",
          "data-spell": "used",
          "data-id": spell.id,
          checked: spell.used ? "checked" : null,
        }),
        "Used",
      ]),
      h("button", { type: "button", class: "text-btn", "data-action": "remove-spell", "data-id": spell.id }, "Remove"),
    ])),
    h("button", { type: "button", class: "btn", "data-action": "add-spell" }, "Add a spell"),
  ]));
}

function paintGrant(id, grant, empty) {
  const mount = document.getElementById(id);
  if (!mount) return;
  if (!grant) {
    mount.replaceChildren(h("p", { class: "hint" }, empty));
    return;
  }
  mount.replaceChildren(
    h("p", { class: "sheet-title" }, grant.title),
    ...grant.lines.map((line) => h("p", {}, line)),
  );
}

function paintKitChoices() {
  const mount = document.getElementById("kit-choices");
  const note = document.getElementById("kit-note");
  if (!mount) return;
  if (revising) {
    if (note) note.textContent = "The pack stays as it is. Revising does not pack a new kit.";
    const items = state.character.items || [];
    mount.replaceChildren(items.length
      ? h("p", { class: "hint" }, items.map((item) => (item.qty > 1 ? `${item.name} × ${item.qty}` : item.name)).join(", "))
      : h("p", { class: "hint" }, "The pack is empty."));
    return;
  }
  const options = kitChoices(state.character.classId || "custom");
  const selected = state.character.kitId;
  if (note) {
    note.textContent = selected
      ? "This kit is packed when you sit down."
      : "Choose one kit. Sitting down packs that gear.";
  }
  mount.replaceChildren(...options.map((kit) => h("button", {
    type: "button",
    class: kit.id === selected ? "kit-choice is-on" : "kit-choice",
    "data-action": "choose-kit",
    "data-id": kit.id,
    "aria-pressed": kit.id === selected ? "true" : "false",
  }, [
    h("span", { class: "sheet-title" }, kit.name),
    h("span", { class: "hint" }, kit.items.join(", ")),
  ])));
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
    const deal = Number(counter.deals?.[loadSeat().name]) || 0;
    if (deal) lines.push(deal < 0 ? `The keeper gives you ${-deal}% off.` : `The keeper charges you ${deal}% more.`);
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

/** The DM's per-seat discount or markup, in percent. */
function dealPrice(cp) {
  const deal = Number(counter.deals?.[loadSeat().name]) || 0;
  return deal ? Math.max(0, Math.round((cp * (100 + deal)) / 100)) : cp;
}

function normalizeShop(shop) {
  if (shop && typeof shop === "object") {
    const name = typeof shop.name === "string" ? shop.name.trim() : "";
    return {
      open: shop.open !== false,
      name: name || "Shop",
      goods: Array.isArray(shop.goods) ? shop.goods : null,
      deals: shop.deals && typeof shop.deals === "object" ? shop.deals : null,
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
      cp: dealPrice(good.cp),
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

function applySharedOrder(order) {
  sharedOrder = cleanOrder(order);
  if (!atSharedTable()) return;
  const seat = loadSeat();
  const mine = sharedOrder.combatants.find((person) => person.seat === seat.name || person.name === state.character.name || person.name === seat.name);
  if (mine && gateMode === "play") {
    state.character.hp = mine.hp;
    state.character.maxHp = mine.maxHp;
    state.character.death = mine.death;
    if (!pushingVitals) state.character.extras = cleanExtras({ ...extras(), conditions: mine.marks });
  }
  renderCombat();
  renderKit();
}

async function watchShop() {
  const seat = loadSeat();
  if (!seat.name || !seat.room || seat.solo) {
    applyShop(true, []);
    paintHere(document.getElementById("table-here"), [], "");
    return;
  }
  let room;
  try {
    room = await fetchRoom(seat.room, seat.token);
  } catch {
    return;
  }
  if (!room || room.locked) return;
  applyShop(room.shop, room.buybacks);
  if (room.order) applySharedOrder(room.order);
  paintRoomExtras(room, seat);
  paintHere(document.getElementById("table-here"), room.players || [], seat.name);
  paintAsk(room.messages || [], seat.name);
  paintTargets(
    document.getElementById("talk-to"),
    (room.players || []).map((player) => player.name),
    seat.name,
  );
}

function pendingStaples() {
  const offers = counterOffers();
  const byId = new Map(offers.filter((offer) => offer.service !== true).map((offer) => [offer.id, offer]));
  return stapleIds(state.character).flatMap((id) => (byId.has(id) ? [byId.get(id)] : []));
}

function paintStaples() {
  const mount = document.getElementById("gear-staples");
  if (!mount) return;
  const pending = pendingStaples();
  mount.replaceChildren(...pending.map((offer) => h("button", {
    type: "button",
    class: "btn",
    "data-action": "buy-staple",
    "data-id": offer.id,
  }, `Buy ${offer.name} for ${formatCoin(offer.cp)}?`)));
}

function openGear() {
  if (!shopOpen) return;
  const error = document.getElementById("gear-error");
  const note = document.getElementById("gear-restock");
  if (error) error.textContent = "";
  if (note) note.textContent = "";
  showShopPane("buy");
  renderGear();
  paintStaples();
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
  paintStaples();
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
  if (drinkPotion(id)) return;
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
let answeringAsk = "";

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
  setText(document.getElementById("ask-text"), `The DM asks ${ask.to ? "you" : "the table"} for ${what}${ask.dc ? `, DC ${ask.dc}` : ""}.`);
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
  answeringAsk = /^[a-f0-9]{16}$/.test(ask.id || "") ? ask.id : "";
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

function stageRoll({ count, sides, modifier, purpose }) {
  state.dice.count = count;
  state.dice.sides = sides;
  state.dice.modifier = modifier;
  const countNode = document.getElementById("dice-count");
  const mod = document.getElementById("dice-mod");
  const purposeNode = document.getElementById("roll-for");
  if (countNode) countNode.value = String(count);
  if (mod) mod.value = String(modifier);
  if (purposeNode) purposeNode.value = purpose;
  paintPurposes();
  showTab("dice");
  paintDice();
  const hint = document.getElementById("dice-hint");
  if (hint) {
    hint.hidden = false;
    hint.textContent = "Ready to roll. Advantage and disadvantage still apply on a d20.";
  }
  persist(`Set ${purpose}.`);
}

function rollSkill(id) {
  const skill = findSkill(id);
  if (!skill || gateMode !== "play") return;
  stageRoll({
    count: 1,
    sides: 20,
    modifier: skillBonus(state.character, id),
    purpose: skill.label,
  });
}

function stageBreath() {
  const breath = breathDice(state.character);
  if (!breath || gateMode !== "play") return;
  stageRoll({
    count: breath.count,
    sides: breath.sides,
    modifier: 0,
    purpose: `${breath.damage} breath`,
  });
}

function paintSitSummary() {
  const summary = document.getElementById("character-summary");
  if (!summary) return;
  const character = state.character;
  const people = peopleGrant(character);
  const klass = classGrant(character);
  const totals = abilityTotals(character);
  const abilities = ABILITIES.map((ability) => {
    const total = totals[ability.id];
    return `${ability.short} ${total} (${formatMod(abilityMod(total))})`;
  }).join(" · ");
  const background = findBackground(character.backgroundId);
  const backgroundName = character.backgroundId === "custom"
    ? (character.customBackground || "Custom background")
    : (background?.name || "");
  const skills = character.skills.map((id) => findSkill(id)?.label).filter(Boolean);
  const hp = character.hp == null ? suggestedHp(character) : character.hp;
  const kit = kitChoices(character.classId || "custom").find((item) => item.id === character.kitId);
  summary.replaceChildren(...present([
    h("p", { class: "sheet-title" }, character.name.trim() || "Unnamed"),
    h("h3", {}, "People"),
    people ? h("p", {}, people.title) : h("p", { class: "hint" }, "No people yet."),
    ...(people ? people.lines.map((line) => h("p", { class: "hint" }, line)) : []),
    h("h3", {}, "Class"),
    klass ? h("p", {}, klass.title) : h("p", { class: "hint" }, "No class yet."),
    ...(klass ? klass.lines.map((line) => h("p", { class: "hint" }, line)) : []),
    h("h3", {}, "Scores"),
    h("p", {}, abilities),
    h("h3", {}, "Story"),
    backgroundName ? h("p", {}, backgroundName) : h("p", { class: "hint" }, "No background yet."),
    skills.length ? h("p", { class: "hint" }, skills.join(", ")) : h("p", { class: "hint" }, "No skills yet."),
    hp == null ? null : h("p", {}, `${hp} hit points`),
    character.traits.trim() ? h("p", { class: "hint" }, character.traits.trim()) : null,
    kit ? h("h3", {}, "Chosen kit") : null,
    kit ? h("p", {}, kit.name) : null,
    kit ? h("p", { class: "hint" }, kit.items.join(", ")) : null,
  ]));
}

function renderCharacter() {
  const character = state.character;

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
  else setText(document.getElementById("class-hint"), "");
  paintGrant("people-grant", peopleGrant(character), "Choose a people and the traits appear here.");
  paintGrant("class-grant", classGrant(character), "Choose a class and the features appear here.");

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
  paintSitSummary();
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
  } else if (sheet === "custom-darkvision") {
    const feet = looseInt(target.value);
    if (feet == null || feet < 0 || feet > 120) return true;
    character.customDarkvision = feet;
    summary = feet ? `Darkvision ${feet} feet.` : "Cleared darkvision.";
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
    const kits = kitOptions(character.classId || "custom");
    if (!kits.some((kit) => kit.id === character.kitId)) character.kitId = "";
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
  if (levels) levels.replaceChildren(...levelOptions(3));
  const cr = document.querySelector("#monster-form select[name='cr']");
  if (cr) {
    cr.replaceChildren(
      h("option", { value: "" }, "Set XP from challenge"),
      ...CR_XP.map(([rating, xp]) => h("option", { value: String(xp) }, `CR ${rating} · ${formatXp(xp)} XP`)),
    );
  }
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
  const ok = window.confirm("Delete the game stored in this browser? Clearing Lantern's stored data here deletes the characters at each table, the fight, the flames, and the notes. A saved copy is a file you keep, and it is the way back.");
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
  document.getElementById("combatant-form")?.reset();
  document.getElementById("hero-form")?.reset();
  document.getElementById("monster-form")?.reset();
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
  if (extraClick(action, button)) return;
  if (boardClick(action, button)) return;
  if (libraryClick(action, button)) return;
  if (action === "play-alone") startSolo(document.getElementById("seat-name")?.value || "");
  else if (action === "toggle-pause") togglePause();
  else if (action === "revise-character") beginRevise();
  else if (action === "stage-breath") stageBreath();
  else if (action === "roll-initiative") void rollForInitiative();
  else if (action === "hero-hp") adjustHeroHp(Number(button.dataset.delta));
  else if (action === "short-rest") shortRest();
  else if (action === "toggle-inspiration") toggleInspiration();
  else if (action === "add-spell") addSpell();
  else if (action === "remove-spell") removeSpell(button.dataset.id);
  else if (action === "choose-kit") chooseKit(button.dataset.id);
  else if (action === "buy-staple") purchase(button.dataset.id);
  else if (action === "death-pip") setDeathPip(button.dataset.id, button.dataset.kind, Number(button.dataset.index));
  else if (action === "tab") {
    const next = button.dataset.tab;
    const open = next !== "dice" && document.getElementById(PLAYER_MODULES[next])?.open;
    showTab(gateMode === "play" && open ? "dice" : next);
  } else if (action === "close-module") button.closest("dialog")?.close();
  else if (action === "roll-skill") rollSkill(button.dataset.id);
  else if (action === "use-item") spendItem(button.dataset.id);
  else if (action === "open-gear") openGear();
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
  if (extraSubmit(form)) return;
  if (boardSubmit(form)) return;
  if (form.id === "seat-form") joinSeat(form);
  else if (form.id === "talk-form") void sendTalk();
  else if (form.dataset.form === "combatant") addCombatant(form);
  else if (form.dataset.form === "hero" || form.dataset.form === "monster") return;
  else if (form.dataset.form === "light") strike(form);
}

function onInput(event) {
  const target = event.target;
  if (boardInput(target)) return;
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
  if (target.id === "kit-ac") {
    if (target.value.trim() === "") state.character.acOverride = null;
    else {
      const n = looseInt(target.value);
      if (n == null || n < 0 || n > 40) return;
      state.character.acOverride = n;
    }
    persist();
    void pushHeroVitals();
    return;
  }
  if (target.dataset?.spell === "name" || target.dataset?.spell === "slot") {
    const spell = (state.character.spells || []).find((item) => item.id === target.dataset.id);
    if (!spell) return;
    if (target.dataset.spell === "name") spell.name = target.value.slice(0, 60);
    if (target.dataset.spell === "slot") {
      const slot = looseInt(target.value);
      if (slot == null || slot < 0 || slot > 9) return;
      spell.slot = slot;
    }
    persist();
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
  if (boardChange(target)) return;
  if (extraChange(target)) {
    if (target.dataset?.slotMax) renderKit();
    return;
  }
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
  } else if (field === "exhaustion") {
    const person = findCombatant(id);
    if (!person) return;
    person.exhaustion = readInt(target, person.exhaustion || 0, 0, 6);
    persist(`${person.name} is at exhaustion ${person.exhaustion}.`);
    renderCombat();
  } else if (target.dataset?.spell === "used") {
    const spell = (state.character.spells || []).find((item) => item.id === target.dataset.id);
    if (!spell) return;
    spell.used = target.checked;
    persist(spell.used ? `Marked ${spell.name} used.` : `Cleared ${spell.name}.`);
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
  const tabs = { 1: "dice", 2: "order", 3: "character", 4: "notes", 5: "table", 6: "party" };
  if (tabs[event.key]) {
    event.preventDefault();
    const next = tabs[event.key];
    const open = next !== "dice" && document.getElementById(PLAYER_MODULES[next])?.open;
    showTab(open ? "dice" : next);
  } else if (event.key === "r" && !document.querySelector("dialog[open]")) {
    event.preventDefault();
    doRoll();
  } else if (event.key === "e" && myTurn()) {
    event.preventDefault();
    void endMyTurn();
  } else if (event.key === "n" && document.getElementById("module-order")?.open) {
    event.preventDefault();
    stepTurn(1);
  }
}

function mirrorHero(person) {
  if (!person || person.name !== state.character.name) return;
  state.character.hp = person.hp;
  state.character.maxHp = person.maxHp;
  state.character.death = person.death;
}

let pushingVitals = false;

async function pushHeroVitals() {
  if (!atSharedTable()) return;
  pushingVitals = true;
  let order = null;
  try {
    order = await postVitals(loadSeat().room, {
      hp: state.character.hp,
      maxHp: maxHitPoints(state.character),
      ac: armorClass(state.character),
      marks: extras().conditions,
    });
  } finally {
    pushingVitals = false;
  }
  if (order?.order) applySharedOrder(order.order);
}

function adjustHeroHp(delta) {
  if (!Number.isInteger(delta) || !delta) return;
  const max = maxHitPoints(state.character);
  const current = state.character.hp == null ? (suggestedHp(state.character) ?? 0) : state.character.hp;
  const next = Math.min(max, Math.max(0, current + delta));
  state.character.hp = next;
  state.character.maxHp = max;
  if (next > 0) state.character.death = blankDeath();
  const local = state.combat.combatants.find((person) => person.name === state.character.name);
  if (local && !atSharedTable()) {
    local.hp = next;
    local.maxHp = max;
    if (next > 0) local.death = blankDeath();
  }
  persist(`${state.character.name || "The hero"} is at ${next} hit points.`);
  void pushHeroVitals();
  renderKit();
  renderCombat();
}

function shortRest() {
  const info = classInfo(state.character);
  if (!info) return;
  if (state.character.hitDiceUsed >= state.character.level) {
    setSaveStatus("No hit dice left.");
    return;
  }
  const con = abilityMod(abilityTotals(state.character).con);
  const rolled = roll({ count: 1, sides: info.hitDie, modifier: con });
  const gain = Math.max(0, rolled.total);
  const max = maxHitPoints(state.character);
  const current = state.character.hp == null ? (suggestedHp(state.character) ?? 0) : state.character.hp;
  state.character.hp = Math.min(max, current + gain);
  state.character.maxHp = max;
  state.character.hitDiceUsed += 1;
  state.character.extras = restExtras(extras(), "short", state.character.classId);
  if (state.character.hp > 0) state.character.death = blankDeath();
  persist(`Short rest: ${gain} hit points from a d${info.hitDie}.`);
  void pushHeroVitals();
  renderKit();
  renderCombat();
}

function toggleInspiration() {
  state.character.inspiration = !state.character.inspiration;
  persist(state.character.inspiration ? "Marked inspiration." : "Spent inspiration.");
  renderKit();
}

function addSpell() {
  state.character.spells = [...(state.character.spells || []), {
    id: uid(),
    name: "New spell",
    slot: 1,
    used: false,
  }];
  persist("Added a spell for tonight.");
  renderKit();
}

function removeSpell(id) {
  state.character.spells = (state.character.spells || []).filter((spell) => spell.id !== id);
  persist("Removed a spell.");
  renderKit();
}

function chooseKit(id) {
  if (gateMode === "view" || revising) return;
  state.character.kitId = id;
  state.character.touched = true;
  persist("Chose a starting kit.");
  renderCharacter();
}

let rollingInitiative = false;

async function rollForInitiative() {
  if (rollingInitiative) return;
  const name = state.character.name.trim();
  if (!name) {
    showError("combatant", "Name the character first.");
    return;
  }
  const bonus = abilityMod(abilityTotals(state.character).dex);
  const rolled = roll({ count: 1, sides: 20, modifier: bonus });
  const hp = state.character.hp == null ? (suggestedHp(state.character) ?? 10) : state.character.hp;
  const maxHp = maxHitPoints(state.character);
  const ac = armorClass(state.character);
  const entry = {
    name,
    init: rolled.total,
    bonus,
    die: rolled.kept[0],
    hp,
    maxHp,
    ac,
  };
  const result = document.getElementById("initiative-result");
  rollingInitiative = true;
  try {
    if (atSharedTable()) {
      const posted = await postInitiative(loadSeat().room, entry);
      if (posted?.order) applySharedOrder(posted.order);
    } else {
      let person = state.combat.combatants.find((item) => item.name === name);
      if (!person) {
        if (state.combat.combatants.length >= 24) {
          showError("combatant", "The order holds 24.");
          return;
        }
        person = {
          id: uid(),
          name,
          seat: loadSeat().name,
          marks: [],
          exhaustion: 0,
          death: cleanDeath(state.character.death),
          order: nextOrder(),
        };
        state.combat.combatants.push(person);
      }
      person.init = entry.init;
      person.bonus = entry.bonus;
      person.die = entry.die;
      person.hp = entry.hp;
      person.maxHp = entry.maxHp;
      person.ac = entry.ac;
      if (person.hp > 0) person.death = blankDeath();
      if (!state.combat.started) state.combat.activeId = null;
      ensureActive();
      renderCombat();
    }
    showError("combatant", "");
    if (result) result.textContent = `${name} rolled ${entry.init} (${dieLine(entry)}).`;
    persist(`${name} rolled initiative ${entry.init}.`);
  } catch (error) {
    showError("combatant", error instanceof Error ? error.message : "The order did not take that roll.");
  } finally {
    rollingInitiative = false;
  }
}

function setDeathPip(id, kind, index) {
  const person = findCombatant(id);
  if (!person || !Number.isInteger(index)) return;
  const death = cleanDeath(person.death);
  const current = kind === "failure" ? death.failure : death.success;
  const next = current === index + 1 ? index : index + 1;
  if (kind === "failure") death.failure = next;
  else death.success = next;
  person.death = cleanDeath(death);
  mirrorHero(person);
  const label = person.death.stable ? "Stable." : `${person.death.success} successes, ${person.death.failure} failures.`;
  persist(`${person.name}: ${label}`);
  renderCombat();
  renderKit();
}

// ---------------------------------------------------------------------------
// Player extras: saved rolls, secret rolls, inspiration rerolls, the fuller pack.

let lastRoll = null;
let pendingDamage = null;
let pendingHelp = null;


function extras() {
  if (!state.character.extras) state.character.extras = blankExtras();
  return state.character.extras;
}

function setExtras(next, summary) {
  state.character.extras = cleanExtras(next);
  persist(summary);
  renderKit();
}

function secretChecked() {
  return document.getElementById("roll-secret")?.checked === true;
}

function currentTarget() {
  const field = document.getElementById("target-field");
  if (!field || field.hidden) return "";
  return document.getElementById("roll-target")?.value || "";
}

function rollKind(item) {
  const what = String(item.purpose || "").toLowerCase();
  if (/attack|to hit/.test(what)) return "attack";
  if (/damage|breath|healing|potion/.test(what)) return "damage";
  if (/save/.test(what)) return "save";
  if (/check|initiative/.test(what) || SKILLS.some((skill) => skill.label.toLowerCase() === what)) return "check";
  return "other";
}

function performRoll(setup) {
  const sides = setup.sides;
  let mode = sides === 20 ? (setup.mode || "normal") : "normal";
  let helped = "";
  if (sides === 20 && setup.count === 1 && pendingHelp && setup.help !== false) {
    helped = pendingHelp.from;
    mode = mode === "disadvantage" ? "normal" : "advantage";
    consumeHelp();
  }
  const result = roll({ count: setup.count, sides, modifier: setup.modifier, mode });
  const purpose = String(setup.purpose || "").trim().slice(0, 60);
  const target = String(setup.target || "").trim().slice(0, 80);
  const secret = setup.secret === true;
  const line = formula(result);
  const detail = facesLabel(result);
  state.dice.history.unshift({
    id: uid(),
    formula: line,
    total: result.total,
    detail: helped ? `${detail} · helped by ${helped}` : detail,
    purpose,
    tag: result.tag,
    secret,
    target,
  });
  state.dice.history = state.dice.history.slice(0, HISTORY_CAP);
  const forWhat = target ? `${purpose || "an attack"} at ${target}` : purpose;
  const summary = rollSummary({ purpose: forWhat, formula: line, total: result.total, detail, tag: result.tag });
  const answering = answeringAsk;
  answeringAsk = "";
  persist(helped ? `${summary} Helped by ${helped}.` : summary, { secret, ask: answering, total: result.total });
  lastRoll = { setup: { ...setup, mode: setup.mode || "normal" }, result };
  paintDice();
  renderFreshResult(result);
  renderHistory();
  paintAfterRoll();
  announceRoll(result, purpose, secret);
  return result;
}

function announceRoll(result, purpose, secret) {
  const live = document.getElementById("roll-live");
  if (!live) return;
  const tag = result.tag === "natural-20" ? ", natural 20" : result.tag === "natural-1" ? ", natural 1" : "";
  live.textContent = `${secret ? "Secret roll: " : ""}${result.total}${tag}${purpose ? ` for ${purpose}` : ""}.`;
}

function paintAfterRoll() {
  const mount = document.getElementById("after-roll");
  if (!mount) return;
  const buttons = [];
  if (pendingDamage) {
    const crit = pendingDamage.crit;
    buttons.push(h("button", { type: "button", class: crit ? "btn primary is-crit" : "btn primary", "data-action": "macro-damage" },
      crit ? `Roll ${pendingDamage.macro.label} damage, critical (${formulaText(critDamage(parseFormula(pendingDamage.macro.damage)))})` : `Roll ${pendingDamage.macro.label} damage (${pendingDamage.macro.damage})`));
  }
  if (lastRoll && state.character.inspiration && gateMode === "play") {
    buttons.push(h("button", { type: "button", class: "btn", "data-action": "inspire-reroll" }, "Spend inspiration to reroll"));
  }
  mount.replaceChildren(...buttons);
}

function inspireReroll() {
  if (!lastRoll || !state.character.inspiration) return;
  state.character.inspiration = false;
  const setup = { ...lastRoll.setup, purpose: `${lastRoll.setup.purpose || "a roll"} (inspiration reroll)`.slice(0, 60), help: false };
  persist("Spends inspiration to reroll.");
  lastRoll = null;
  performRoll(setup);
  renderKit();
}

function renderMacros() {
  const bar = document.getElementById("macro-bar");
  const list = document.getElementById("macro-list");
  if (!bar || !list) return;
  const macros = extras().macros;
  bar.replaceChildren(...(macros.length
    ? macros.map((macro) => h("button", { type: "button", class: "btn", "data-action": "run-macro", "data-id": macro.id },
      `${macro.label}${macro.hit ? ` ${macro.hit.replace(/^1d20/, "")}` : ""}${macro.damage ? ` · ${macro.damage}` : ""}`))
    : [h("p", { class: "hint" }, "Save the rolls you make every fight, like an attack and its damage, and they wait here as one tap.")]));
  list.replaceChildren(...macros.map((macro) => h("div", { class: "gear-row" }, [
    h("span", {}, `${macro.label}: ${[macro.hit && `to hit ${macro.hit}`, macro.damage && `damage ${macro.damage}`, macro.ammo && "uses ammo"].filter(Boolean).join(", ")}`),
    h("button", { type: "button", class: "text-btn", "data-action": "remove-macro", "data-id": macro.id }, "Remove"),
  ])));
}

function addMacro(form) {
  const label = form.elements.label.value.trim();
  const hit = form.elements.hit.value.trim();
  const damage = form.elements.damage.value.trim();
  if (!label) return showError("macro", "Name the roll.");
  if (hit && !parseFormula(hit)) return showError("macro", "Write to hit like 1d20+5, or just +5.");
  if (damage && !parseFormula(damage)) return showError("macro", "Write damage like 1d8+3.");
  if (!hit && !damage) return showError("macro", "Give it a to hit or a damage roll.");
  if (extras().macros.length >= MACRO_CAP) return showError("macro", `Twelve saved rolls is the most.`);
  showError("macro", "");
  const next = { ...extras(), macros: [...extras().macros, { id: uid().replace(/[^A-Za-z0-9_-]/g, ""), label, hit, damage, ammo: form.elements.ammo.checked }] };
  form.reset();
  state.character.extras = cleanExtras(next);
  persist(`Saved a roll: ${label}.`);
  renderMacros();
}

function removeMacro(id) {
  state.character.extras = cleanExtras({ ...extras(), macros: extras().macros.filter((macro) => macro.id !== id) });
  persist("Removed a saved roll.");
  renderMacros();
}

function runMacro(id) {
  const macro = extras().macros.find((item) => item.id === id);
  if (!macro) return;
  pendingDamage = null;
  if (macro.ammo && !fireAmmo()) return;
  const hit = parseFormula(macro.hit);
  if (hit) {
    const result = performRoll({ ...hit, mode: state.dice.mode, purpose: `${macro.label} attack`, target: currentTarget(), secret: secretChecked() });
    if (macro.damage) {
      pendingDamage = { macro, crit: result.tag === "natural-20" };
      paintAfterRoll();
    }
    return;
  }
  const damage = parseFormula(macro.damage);
  if (damage) performRoll({ ...damage, mode: "normal", purpose: `${macro.label} damage`, target: currentTarget(), secret: secretChecked() });
}

function rollMacroDamage() {
  if (!pendingDamage) return;
  const { macro, crit } = pendingDamage;
  pendingDamage = null;
  const base = parseFormula(macro.damage);
  if (!base) return;
  const dice = crit ? critDamage(base) : base;
  performRoll({ ...dice, mode: "normal", purpose: `${macro.label} damage${crit ? " (critical)" : ""}`, target: currentTarget(), secret: secretChecked(), help: false });
}

function paintTargets2() {
  const field = document.getElementById("target-field");
  const select = document.getElementById("roll-target");
  if (!field || !select || document.activeElement === select) return;
  const people = (atSharedTable() && sharedOrder ? sharedOrder.combatants : state.combat.combatants)
    .filter((person) => person.name !== state.character.name);
  field.hidden = people.length === 0;
  const current = select.value;
  const names = [...new Set(people.map((person) => person.name))];
  select.replaceChildren(h("option", { value: "" }, "No target"), ...names.map((name) => h("option", { value: name }, name)));
  if (names.includes(current)) select.value = current;
}

// --- Pack: portrait, color, damage and healing, conditions, abilities, resources, slots.

function paintPortrait(character) {
  const mount = document.getElementById("kit-portrait");
  if (!mount) return;
  const ex = extras();
  mount.replaceChildren(...present([
    ex.portrait ? h("img", { class: "portrait", src: ex.portrait, alt: `${character.name || "Your hero"}'s portrait`, width: "72", height: "72" }) : null,
    h("div", { class: "stack" }, [
      h("button", { type: "button", class: "text-btn", "data-action": "pick-portrait" }, ex.portrait ? "Change portrait" : "Add a portrait"),
      ex.portrait ? h("button", { type: "button", class: "text-btn", "data-action": "clear-portrait" }, "Remove portrait") : null,
      h("div", { class: "swatches", role: "group", "aria-label": "Your color in the table feed" }, COLORS.map((color) => h("button", {
        type: "button",
        class: "swatch",
        style: `--swatch:${color}`,
        "data-action": "pick-color",
        "data-color": color,
        "aria-pressed": ex.color === color ? "true" : "false",
        "aria-label": `Feed color ${color}`,
      }, ""))),
    ]),
  ].filter(Boolean)));
}

async function loadPortrait(file) {
  if (!file || !/^image\//.test(file.type)) return;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const sx = (image.naturalWidth - side) / 2;
    const sy = (image.naturalHeight - side) / 2;
    let data = "";
    for (const [size, quality] of [[128, 0.82], [112, 0.7], [96, 0.6], [80, 0.5]]) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      canvas.getContext("2d").drawImage(image, sx, sy, side, side, 0, 0, size, size);
      data = canvas.toDataURL("image/jpeg", quality);
      if (data.length <= PORTRAIT_CHARS) break;
    }
    if (data.length > PORTRAIT_CHARS) return;
    setExtras({ ...extras(), portrait: data }, "Changed the portrait.");
  } catch {
    // An image the browser cannot read leaves the old portrait in place.
  } finally {
    URL.revokeObjectURL(url);
  }
}

function currentHp() {
  return state.character.hp == null ? (suggestedHp(state.character) ?? 0) : state.character.hp;
}

function setHeroHp(next, summary) {
  const max = maxHitPoints(state.character);
  state.character.hp = Math.min(max, Math.max(0, next));
  state.character.maxHp = max;
  if (state.character.hp > 0) state.character.death = blankDeath();
  const local = state.combat.combatants.find((person) => person.name === state.character.name);
  if (local && !atSharedTable()) {
    local.hp = state.character.hp;
    local.maxHp = max;
    if (local.hp > 0) local.death = blankDeath();
  }
  persist(summary);
  void pushHeroVitals();
  renderKit();
  renderCombat();
}

function amountField() {
  return readInt(document.getElementById("kit-amount"), 0, 0, 999);
}

function takeDamage() {
  const amount = amountField();
  if (!amount) return;
  const ex = extras();
  const after = applyDamage({ hp: currentHp(), tempHp: ex.tempHp }, amount);
  state.character.extras = cleanExtras({ ...ex, tempHp: after.tempHp });
  const soaked = ex.tempHp - after.tempHp;
  setHeroHp(after.hp, `${state.character.name || "The hero"} takes ${amount} damage${soaked ? `, ${soaked} to temporary hit points` : ""}, and is at ${after.hp}.`);
  if (ex.conditions.includes("concentrating") && after.hp > 0) {
    const dc = concentrationDc(amount);
    const info = askBonus(state.character, "Constitution save");
    stageRoll({ count: 1, sides: 20, modifier: info ? info.bonus : 0, purpose: `Concentration, DC ${dc}` });
    const hint = document.getElementById("dice-hint");
    if (hint) {
      hint.hidden = false;
      hint.textContent = `You are concentrating. Roll a Constitution save against DC ${dc} to hold the spell.`;
    }
  }
}

function healDamage() {
  const amount = amountField();
  if (!amount) return;
  const next = applyHealing({ hp: currentHp(), max: maxHitPoints(state.character) }, amount);
  setHeroHp(next, `${state.character.name || "The hero"} heals ${amount}, and is at ${next}.`);
}

function gainTemp() {
  const amount = amountField();
  const ex = extras();
  const next = applyTemp(ex.tempHp, amount);
  setExtras({ ...ex, tempHp: next }, next === ex.tempHp && amount ? "Temporary hit points do not stack. The bigger number stays." : `${next} temporary hit points.`);
}

function paintConditions() {
  const mount = document.getElementById("kit-conditions");
  if (!mount || typingInside(mount)) return;
  const on = new Set(extras().conditions);
  mount.replaceChildren(
    h("h3", {}, "Conditions"),
    h("div", { class: "chip-row", role: "group", "aria-label": "Your conditions" }, MARKS.map((mark) => h("button", {
      type: "button",
      class: mark === "concentrating" ? "chip is-concentrating" : "chip",
      "data-action": "toggle-condition",
      "data-mark": mark,
      "aria-pressed": on.has(mark) ? "true" : "false",
    }, mark))),
  );
}

async function toggleCondition(mark) {
  if (!MARKS.includes(mark)) return;
  const ex = extras();
  const list = ex.conditions.includes(mark) ? ex.conditions.filter((item) => item !== mark) : [...ex.conditions, mark];
  list.sort((a, b) => MARKS.indexOf(a) - MARKS.indexOf(b));
  state.character.extras = cleanExtras({ ...ex, conditions: list });
  const local = state.combat.combatants.find((person) => person.name === state.character.name);
  if (local) local.marks = [...list];
  persist(`${state.character.name || "The hero"}: ${list.join(", ") || "no conditions"}.`);
  renderKit();
  renderCombat();
  void pushHeroVitals();
}

function paintAbilities(character) {
  const mount = document.getElementById("kit-abilities");
  if (!mount) return;
  if (!classInfo(character)) {
    mount.replaceChildren();
    return;
  }
  const totals = abilityTotals(character);
  mount.replaceChildren(
    h("h3", {}, "Checks and saves"),
    h("div", { class: "ability-rolls" }, ABILITIES.map((ability) => {
      const check = askBonus(character, `${ability.label} check`);
      const save = askBonus(character, `${ability.label} save`);
      return h("div", { class: "ability-roll" }, [
        h("p", { class: "sheet-title" }, `${ability.short} ${totals[ability.id]}`),
        h("button", { type: "button", class: "btn", "data-action": "roll-ask", "data-ask": `${ability.label} check` }, `Check ${formatMod(check.bonus)}`),
        h("button", { type: "button", class: "btn", "data-action": "roll-ask", "data-ask": `${ability.label} save` }, `Save ${formatMod(save.bonus)}`),
      ]);
    })),
  );
}

function rollAsk(name) {
  const info = askBonus(state.character, name);
  if (!info || gateMode !== "play") return;
  stageRoll({ count: 1, sides: 20, modifier: info.bonus, purpose: info.label });
}

function paintResources(character) {
  const mount = document.getElementById("kit-resources");
  if (!mount || typingInside(mount)) return;
  const list = extras().resources;
  mount.replaceChildren(...present([
    h("h3", {}, "Class resources"),
    ...list.map((item) => h("div", { class: "gear-row resource-row" }, [
      h("span", { class: "resource-name" }, `${item.label} ${item.max - item.used} / ${item.max}`),
      h("span", { class: "hint" }, item.reset === "short" ? "short rest" : "long rest"),
      h("button", { type: "button", class: "btn", "data-action": "resource", "data-id": item.id, "data-delta": "1", disabled: item.used >= item.max ? "disabled" : null }, "Use"),
      h("button", { type: "button", class: "btn", "data-action": "resource", "data-id": item.id, "data-delta": "-1", disabled: item.used <= 0 ? "disabled" : null }, "Regain"),
      h("button", { type: "button", class: "text-btn", "data-action": "remove-resource", "data-id": item.id }, "Remove"),
    ])),
    list.length ? null : h("p", { class: "hint" }, "Rage, Ki, Channel Divinity and the rest. Fill them from the class, or add your own."),
    h("div", { class: "turn-actions" }, [
      character.classId && character.classId !== "custom"
        ? h("button", { type: "button", class: "btn", "data-action": "class-resources" }, "Fill from the class")
        : null,
    ].filter(Boolean)),
    h("details", { class: "wick-add" }, [
      h("summary", {}, "Add your own"),
      h("form", { id: "resource-form", "data-form": "resource", class: "form", autocomplete: "off" }, [
        h("label", {}, ["Resource", h("input", { name: "label", maxlength: "40", required: "required", placeholder: "Superiority dice", spellcheck: "false" })]),
        h("label", {}, ["Uses", h("input", { name: "max", type: "number", min: "1", max: "100", value: "1", inputmode: "numeric" })]),
        h("label", {}, ["Back on", h("select", { name: "reset" }, [h("option", { value: "short" }, "Short rest"), h("option", { value: "long" }, "Long rest")])]),
        h("button", { type: "submit", class: "btn" }, "Add"),
      ]),
    ]),
  ].filter(Boolean)));
}

function chaMod() {
  return abilityMod(abilityTotals(state.character).cha);
}

function fillClassResources() {
  const fresh = classResources(state.character.classId, state.character.level, chaMod());
  const ex = extras();
  const custom = ex.resources.filter((item) => !fresh.some((entry) => entry.id === item.id));
  const kept = fresh.map((entry) => {
    const old = ex.resources.find((item) => item.id === entry.id);
    return old ? { ...entry, used: Math.min(old.used, entry.max) } : entry;
  });
  setExtras({ ...ex, resources: [...kept, ...custom], slots: classSlots(state.character.classId, state.character.level).map((slot, index) => ({ max: slot.max, used: Math.min(ex.slots[index]?.used || 0, slot.max) })) }, "Filled class resources and spell slots.");
}

function addResource(form) {
  const label = form.elements.label.value.trim();
  if (!label) return;
  const max = readInt(form.elements.max, 1, 1, 100);
  const ex = extras();
  setExtras({ ...ex, resources: [...ex.resources, { id: uid().replace(/[^A-Za-z0-9_-]/g, ""), label, max, used: 0, reset: form.elements.reset.value }] }, `Added ${label}.`);
}

function paintSlots() {
  const mount = document.getElementById("kit-slots");
  if (!mount || typingInside(mount)) return;
  const slots = extras().slots;
  const any = slots.some((slot) => slot.max > 0);
  const ordinal = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
  mount.replaceChildren(...present([
    h("h3", {}, "Spell slots"),
    any ? h("div", { class: "slot-grid" }, slots.flatMap((slot, index) => (slot.max ? [h("div", { class: "slot-line" }, [
      h("span", { class: "slot-level" }, ordinal[index]),
      ...Array.from({ length: slot.max }, (_, pip) => h("button", {
        type: "button",
        class: pip < slot.max - slot.used ? "pip is-open" : "pip",
        "data-action": "slot",
        "data-level": String(index + 1),
        "data-delta": pip < slot.max - slot.used ? "1" : "-1",
        "aria-label": `${ordinal[index]} level slot ${pip + 1}, ${pip < slot.max - slot.used ? "ready, tap to spend" : "spent, tap to get back"}`,
      }, "")),
    ])] : []))) : null,
    h("details", { class: "wick-add" }, [
      h("summary", {}, "Set slots by hand"),
      h("div", { class: "slot-edit" }, slots.map((slot, index) => h("label", {}, [
        ordinal[index],
        h("input", { type: "number", min: "0", max: "9", value: String(slot.max), inputmode: "numeric", "data-slot-max": String(index + 1), "aria-label": `${ordinal[index]} level slots` }),
      ]))),
    ]),
  ]));
}

function longRest() {
  const character = state.character;
  const max = maxHitPoints(character);
  character.hp = max;
  character.maxHp = max;
  character.death = blankDeath();
  character.hitDiceUsed = Math.max(0, character.hitDiceUsed - Math.max(1, Math.floor(character.level / 2)));
  character.spells = (character.spells || []).map((spell) => ({ ...spell, used: false }));
  character.extras = restExtras(extras(), "long", character.classId);
  persist(`Long rest: ${character.name || "the hero"} is back to ${max} hit points.`);
  void pushHeroVitals();
  renderKit();
  renderCombat();
}

// --- Inventory: weight, ammo, potions, magic items, level up.

function paintWeight(character) {
  const node = document.getElementById("kit-weight");
  if (!node) return;
  const weight = carriedWeight(character.items, extras().trinkets);
  const load = encumbrance(weight, abilityTotals(character).str);
  const words = { light: "", encumbered: " Under the variant rule that is encumbered: speed drops by 10 feet.", heavy: " Under the variant rule that is heavily encumbered: speed drops by 20 feet, with disadvantage on Strength, Dexterity, and Constitution rolls.", over: " That is more than you can carry." };
  node.textContent = `Carrying ${weight} lb of ${load.capacity} lb.${words[load.level]}`;
  node.dataset.load = load.level;
}

function paintAmmo(character) {
  const mount = document.getElementById("kit-ammo");
  if (!mount || typingInside(mount)) return;
  const held = character.items.filter((item) => AMMO_IDS.includes(item.id));
  if (!held.length) {
    mount.replaceChildren();
    return;
  }
  const ex = extras();
  const chosen = held.find((item) => item.id === ex.ammoId);
  if (chosen) {
    const per = ammoPerBundle(chosen.id);
    const synced = syncAmmo(ex.ammoLeft, chosen.qty, per);
    if (synced !== ex.ammoLeft) state.character.extras = cleanExtras({ ...ex, ammoLeft: synced });
  }
  const left = extras().ammoLeft;
  mount.replaceChildren(h("div", { class: "gear-row" }, present([
    h("label", {}, ["Ammo", h("select", { id: "ammo-pick", "aria-label": "Ammunition to count" }, [
      h("option", { value: "" }, "Not counting"),
      ...held.map((item) => h("option", { value: item.id, selected: item.id === ex.ammoId ? "selected" : null }, item.name)),
    ])]),
    chosen ? h("span", { class: "sheet-title" }, `${left} left`) : null,
    chosen ? h("button", { type: "button", class: "btn", "data-action": "fire-ammo", disabled: left <= 0 ? "disabled" : null }, "Fire one") : null,
    chosen ? h("button", { type: "button", class: "text-btn", "data-action": "recover-ammo" }, "Pick one up") : null,
  ])));
}

function pickAmmo(id) {
  const item = state.character.items.find((entry) => entry.id === id);
  setExtras({ ...extras(), ammoId: item ? id : "", ammoLeft: item ? item.qty * ammoPerBundle(id) : 0 }, item ? `Counting ${item.name}.` : "Stopped counting ammo.");
}

function fireAmmo() {
  const ex = extras();
  const item = state.character.items.find((entry) => entry.id === ex.ammoId);
  if (!item) return true;
  if (ex.ammoLeft <= 0) {
    setSaveStatus(`Out of ${item.name.replace(/ \(.*\)$/, "").toLowerCase()}.`);
    return false;
  }
  const per = ammoPerBundle(item.id);
  const left = ex.ammoLeft - 1;
  const bundles = Math.ceil(left / per);
  state.character.items = bundles > 0
    ? state.character.items.map((entry) => (entry.id === item.id ? { ...entry, qty: bundles } : entry))
    : state.character.items.filter((entry) => entry.id !== item.id);
  state.character.extras = cleanExtras({ ...ex, ammoLeft: left, ammoId: bundles > 0 ? ex.ammoId : "" });
  persist(left > 0 ? `Fires one. ${left} left.` : "Fires the last one.");
  renderKit();
  return true;
}

function recoverAmmo() {
  const ex = extras();
  const item = state.character.items.find((entry) => entry.id === ex.ammoId);
  if (!item) return;
  const per = ammoPerBundle(item.id);
  const left = ex.ammoLeft + 1;
  const bundles = Math.ceil(left / per);
  state.character.items = state.character.items.map((entry) => (entry.id === item.id ? { ...entry, qty: Math.min(99, bundles) } : entry));
  setExtras({ ...ex, ammoLeft: left }, `Picks one up. ${left} left.`);
}

function drinkPotion(id) {
  const dice = potionHealing(id);
  if (!dice) return false;
  const result = useItem(state.character, id);
  if (!result.ok) return true;
  state.character = result.character;
  const rolled = performRoll({ ...dice, mode: "normal", purpose: "Potion of healing", help: false });
  const next = applyHealing({ hp: currentHp(), max: maxHitPoints(state.character) }, rolled.total);
  setHeroHp(next, `Drinks a potion of healing for ${rolled.total}, and is at ${next}.`);
  return true;
}

function paintTrinkets() {
  const mount = document.getElementById("kit-trinkets");
  if (!mount || typingInside(mount)) return;
  const list = extras().trinkets;
  const count = attunedCount(extras());
  mount.replaceChildren(...present([
    list.some((item) => item.attune) ? h("p", { class: "sheet-title" }, `Attuned ${count} of ${ATTUNE_CAP}`) : null,
    ...list.map((item) => h("div", { class: item.attuned ? "gear-row is-attuned" : "gear-row" }, present([
      h("span", { title: item.note || null }, [`${item.name}${item.weight ? ` · ${item.weight} lb` : ""}`, item.note ? h("small", { class: "hint trinket-note" }, item.note) : null]),
      item.attune ? h("button", {
        type: "button",
        class: "btn",
        "data-action": "attune",
        "data-id": item.id,
        "aria-pressed": item.attuned ? "true" : "false",
        disabled: !item.attuned && count >= ATTUNE_CAP ? "disabled" : null,
      }, item.attuned ? "Attuned" : "Attune") : null,
      h("button", { type: "button", class: "text-btn", "data-action": "remove-trinket", "data-id": item.id }, "Remove"),
    ]))),
    list.length ? null : h("p", { class: "empty" }, "No magic items yet."),
  ]));
}

function addTrinket(form) {
  const name = form.elements.name.value.trim();
  if (!name) return;
  const ex = extras();
  if (ex.trinkets.length >= TRINKET_CAP) return;
  form.reset();
  setExtras({ ...ex, trinkets: [...ex.trinkets, { id: uid().replace(/[^A-Za-z0-9_-]/g, ""), name, qty: 1, weight: Number(form.elements.weight?.value) || 0, attune: form.elements.attune.checked }] }, `Added ${name}.`);
}

function paintLevelUp(character) {
  const mount = document.getElementById("kit-level");
  if (!mount) return;
  const info = classInfo(character);
  const ex = extras();
  const steps = ex.levelSeen && ex.levelSeen === character.level && info ? levelUpSteps(character.classId, character.level, info.hitDie) : [];
  const reached = levelForXp(ex.xp);
  const ready = character.level < 20 && (ex.milestone || reached > character.level);
  mount.replaceChildren(...present([
    h("h3", {}, "Level"),
    ex.xp || character.level > 1 ? h("p", { class: "hint" }, `${ex.xp} XP${character.level < 20 ? `. Level ${character.level + 1} at ${XP_LEVELS[character.level]}.` : "."}`) : null,
    ready ? h("p", { class: "turn-banner is-mine" }, ex.milestone ? "The DM says you have reached a new level." : "You have the experience for a new level.") : null,
    character.level < 20 && info ? h("button", { type: "button", class: "btn", "data-action": "level-up" }, `Level up to ${character.level + 1}`) : null,
    steps.length ? h("p", { class: "lede" }, `Level ${character.level}. Work down the list, then close it.`) : null,
    steps.length ? h("ul", { class: "checklist" }, steps.map((step) => h("li", {}, [h("label", { class: "check-line" }, [h("input", { type: "checkbox" }), step])]))) : null,
    steps.length ? h("div", { class: "turn-actions" }, [
      h("button", { type: "button", class: "btn", "data-action": "class-resources" }, "Update slots and resources"),
      h("button", { type: "button", class: "text-btn", "data-action": "level-done" }, "Done"),
    ]) : null,
  ]));
}

function levelUp() {
  const character = state.character;
  const info = classInfo(character);
  if (!info || character.level >= 20) return;
  character.level += 1;
  if (Number.isInteger(character.maxHp) && character.maxHp > 0) {
    const gain = Math.max(1, Math.floor(info.hitDie / 2) + 1 + abilityMod(abilityTotals(character).con));
    character.maxHp += gain;
    if (Number.isInteger(character.hp)) character.hp += gain;
  }
  character.extras = cleanExtras({ ...extras(), levelSeen: character.level, milestone: false });
  persist(`${character.name || "The hero"} reaches level ${character.level}.`);
  void pushHeroVitals();
  renderKit();
}

function extraClick(action, button) {
  const handlers = {
    "run-macro": () => runMacro(button.dataset.id),
    "remove-macro": () => removeMacro(button.dataset.id),
    "macro-damage": () => rollMacroDamage(),
    "inspire-reroll": () => inspireReroll(),
    "pick-portrait": () => document.getElementById("portrait-file")?.click(),
    "clear-portrait": () => setExtras({ ...extras(), portrait: "" }, "Removed the portrait."),
    "pick-color": () => setExtras({ ...extras(), color: button.dataset.color }, "Changed the feed color."),
    "hero-damage": () => takeDamage(),
    "hero-heal": () => healDamage(),
    "hero-temp": () => gainTemp(),
    "long-rest": () => longRest(),
    "toggle-condition": () => void toggleCondition(button.dataset.mark),
    "roll-ask": () => rollAsk(button.dataset.ask),
    resource: () => setExtras(tickResource(extras(), button.dataset.id, Number(button.dataset.delta)), "Changed a class resource."),
    "remove-resource": () => setExtras({ ...extras(), resources: extras().resources.filter((item) => item.id !== button.dataset.id) }, "Removed a class resource."),
    "class-resources": () => fillClassResources(),
    slot: () => setExtras(tickSlot(extras(), Number(button.dataset.level), Number(button.dataset.delta)), Number(button.dataset.delta) > 0 ? "Spent a spell slot." : "Got a spell slot back."),
    "fire-ammo": () => fireAmmo(),
    "recover-ammo": () => recoverAmmo(),
    attune: () => {
      const next = toggleAttune(extras(), button.dataset.id);
      if (next) setExtras(next, "Changed attunement.");
    },
    "remove-trinket": () => setExtras({ ...extras(), trinkets: extras().trinkets.filter((item) => item.id !== button.dataset.id) }, "Removed a magic item."),
    "level-up": () => levelUp(),
    "level-done": () => setExtras({ ...extras(), levelSeen: 0 }),
  };
  const run = handlers[action];
  if (!run) return false;
  run();
  return true;
}

function extraSubmit(form) {
  if (form.dataset.form === "macro") addMacro(form);
  else if (form.dataset.form === "resource") addResource(form);
  else if (form.dataset.form === "trinket") addTrinket(form);
  else return false;
  return true;
}

function extraChange(target) {
  if (target.id === "history-filter") {
    renderHistory();
    return true;
  }
  if (target.id === "ammo-pick") {
    pickAmmo(target.value);
    return true;
  }
  if (target.dataset?.slotMax) {
    const level = Number(target.dataset.slotMax);
    const slots = extras().slots.map((slot, index) => (index === level - 1 ? { max: readInt(target, slot.max, 0, 9), used: slot.used } : slot));
    state.character.extras = cleanExtras({ ...extras(), slots });
    persist("Set spell slots.");
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// The shared table: your turn, the party board, chat extras, help, X-card.

let lastRoom = null;
let lastActiveKey = "";
const seenMessages = new Set();
let messagesPrimed = false;
const usedHelps = new Set();
let partyNotesTimer = null;
let typingSentAt = 0;
let titleTimer = null;
const baseTitle = document.title;
const ALERT_KEY = "lantern.alerts";
const TURN_KEY = "lantern.turn";

function alertPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(ALERT_KEY) || "{}");
    return { turn: raw.turn !== false, mention: raw.mention !== false };
  } catch {
    return { turn: true, mention: true };
  }
}

function saveAlertPrefs(prefs) {
  try { localStorage.setItem(ALERT_KEY, JSON.stringify(prefs)); } catch { /* the switch still works for this page */ }
}

function ping(message) {
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (Context) {
      const audio = new Context();
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      tone.frequency.value = 660;
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.35);
      tone.connect(gain).connect(audio.destination);
      tone.start();
      tone.stop(audio.currentTime + 0.4);
      tone.onended = () => audio.close();
    }
  } catch { /* no sound is fine */ }
  try { navigator.vibrate?.([120, 60, 120]); } catch { /* no vibration either */ }
  clearInterval(titleTimer);
  if (document.hidden) {
    let on = false;
    titleTimer = setInterval(() => {
      on = !on;
      document.title = on ? `● ${message}` : baseTitle;
      if (!document.hidden) {
        clearInterval(titleTimer);
        document.title = baseTitle;
      }
    }, 900);
  }
}

function currentOrder() {
  return atSharedTable() ? (sharedOrder || cleanOrder(null)) : cleanOrder(state.combat);
}

function isMine(person) {
  if (!person) return false;
  const seat = loadSeat();
  if (atSharedTable()) return person.seat === seat.name || person.name === state.character.name;
  return Boolean(state.character.name) && person.name === state.character.name;
}

function turnFacts() {
  const order = currentOrder();
  const list = sortOrder(order.combatants);
  const active = order.started ? list.find((person) => person.id === order.activeId) : null;
  const index = active ? list.indexOf(active) : -1;
  const next = active && list.length > 1 ? list[(index + 1) % list.length] : null;
  return { order, list, active, next, mine: isMine(active), nextMine: isMine(next) };
}

function myTurn() {
  return gateMode === "play" && turnFacts().mine;
}

function loadTurn() {
  try {
    const raw = JSON.parse(localStorage.getItem(TURN_KEY) || "{}");
    return { key: String(raw.key || ""), used: raw.used && typeof raw.used === "object" ? raw.used : {}, reaction: raw.reaction === true };
  } catch {
    return { key: "", used: {}, reaction: false };
  }
}

function saveTurn(turn) {
  try { localStorage.setItem(TURN_KEY, JSON.stringify(turn)); } catch { /* the helper still works for this page */ }
}

const ECONOMY = [["action", "Action"], ["bonus", "Bonus action"], ["move", "Movement"], ["object", "Object interaction"]];

function paintTurnHelper() {
  const facts = turnFacts();
  const turn = loadTurn();
  const key = facts.active ? `${facts.order.round}:${facts.active.id}` : "";
  if (facts.mine && turn.key !== key) {
    turn.key = key;
    turn.used = {};
    turn.reaction = false;
    saveTurn(turn);
  }
  const helper = document.getElementById("turn-helper");
  const strip = document.getElementById("turn-strip");
  const inFight = Boolean(facts.active || facts.order.hiddenTurn) && facts.list.some(isMine);
  if (helper) {
    helper.replaceChildren(...present([
      facts.mine ? h("p", { class: "turn-banner is-mine" }, "Your turn") : facts.nextMine ? h("p", { class: "hint" }, "You are up next.") : null,
      facts.mine ? h("div", { class: "chip-row", role: "group", "aria-label": "What you have used this turn" }, ECONOMY.map(([id, label]) => h("button", {
        type: "button",
        class: "chip",
        "data-action": "turn-use",
        "data-use": id,
        "aria-pressed": turn.used[id] ? "true" : "false",
      }, label))) : null,
      inFight ? h("div", { class: "turn-actions" }, present([
        h("button", { type: "button", class: "btn", "data-action": "use-reaction", disabled: turn.reaction ? "disabled" : null }, turn.reaction ? "Reaction used" : "Use your reaction"),
        facts.mine ? h("button", { type: "button", class: "btn primary", "data-action": "end-turn" }, "End turn") : null,
      ])) : null,
    ]));
  }
  if (strip) {
    strip.hidden = !inFight || gateMode !== "play";
    if (inFight) {
      strip.replaceChildren(...present([
        h("p", {}, facts.mine ? `Your turn, round ${facts.order.round}.` : !facts.active ? "Something unseen is acting." : facts.nextMine ? `${facts.active.name} is acting. You are up next.` : `${facts.active.name} is acting.`),
        h("span", { id: "turn-timer", class: "hint" }, turnTimerText(facts.order)),
        !facts.mine && !turn.reaction ? h("span", { class: "here-chip" }, "Reaction ready") : null,
        facts.mine ? h("button", { type: "button", class: "btn primary", "data-action": "end-turn", "aria-keyshortcuts": "E" }, "End turn") : null,
      ]));
    }
    strip.classList.toggle("is-mine", facts.mine);
  }
  for (const row of document.querySelectorAll("#combat-list .combatant")) row.classList.remove("is-next");
  if (facts.next) {
    const rows = [...document.querySelectorAll("#combat-list .combatant")];
    const index = facts.list.indexOf(facts.next);
    rows[index]?.classList.add("is-next");
  }
  const activeKey = facts.active ? `${facts.order.round}:${facts.active.id}` : "";
  if (activeKey !== lastActiveKey) {
    const first = lastActiveKey === "";
    lastActiveKey = activeKey;
    const live = document.getElementById("roll-live");
    if (facts.active && live) live.textContent = facts.mine ? "Your turn." : `${facts.active.name}'s turn.`;
    if (!first && facts.mine && alertPrefs().turn) ping("Your turn");
  }
}

function useEconomy(id) {
  const turn = loadTurn();
  turn.used[id] = !turn.used[id];
  saveTurn(turn);
  paintTurnHelper();
}

async function useReaction() {
  const turn = loadTurn();
  if (turn.reaction) return;
  turn.reaction = true;
  saveTurn(turn);
  paintTurnHelper();
  const seat = loadSeat();
  const name = state.character.name || seat.name;
  persist(`${name} uses a reaction.`);
  if (atSharedTable()) {
    try {
      await postTalk(seat.room, { text: "uses a reaction.", kind: "emote", as: state.character.name }, seat.token);
    } catch { /* the roll log still has it */ }
  }
}

async function endMyTurn() {
  if (!myTurn()) return;
  if (!atSharedTable()) {
    stepTurn(1);
    paintTurnHelper();
    return;
  }
  try {
    const result = await postBoard(loadSeat().room, { op: "end-turn" });
    if (result.order) applySharedOrder(result.order);
    persist(`${state.character.name || "The hero"} ends the turn.`);
  } catch (error) {
    setSaveStatus(error.message);
  }
}

// --- Help: another player's next d20 has advantage.

function paintHelp(helps) {
  const seat = loadSeat();
  const mine = (helps || []).find((help) => help.to === seat.name && !usedHelps.has(help.id));
  pendingHelp = mine ? { id: mine.id, from: mine.from } : null;
  const banner = document.getElementById("help-banner");
  if (!banner) return;
  banner.hidden = !pendingHelp;
  if (pendingHelp) setText(banner, `${pendingHelp.from} is helping you. Your next d20 roll has advantage.`);
}

function consumeHelp() {
  if (!pendingHelp) return;
  usedHelps.add(pendingHelp.id);
  pendingHelp = null;
  const banner = document.getElementById("help-banner");
  if (banner) banner.hidden = true;
  if (atSharedTable()) void postBoard(loadSeat().room, { op: "help-used" }).catch(() => {});
};

async function boardOp(body, success) {
  const seat = loadSeat();
  const status = document.getElementById("party-status");
  if (!atSharedTable()) {
    if (status) status.textContent = "Join a table to use the party board.";
    return null;
  }
  try {
    const result = await postBoard(seat.room, body);
    if (status) status.textContent = success || "";
    if (result.board && lastRoom) {
      lastRoom.board = result.board;
      paintBoard(result.board);
    }
    return result;
  } catch (error) {
    if (status) status.textContent = error.message;
    setText(document.getElementById("talk-status"), error.message);
    return null;
  }
}

// --- The party board.

function seatNames() {
  return (lastRoom?.players || []).map((player) => player.name);
}

function paintBoard(board) {
  if (!board) return;
  const seat = loadSeat();
  const notes = document.getElementById("party-notes");
  if (notes && document.activeElement !== notes && !partyNotesTimer) notes.value = board.notes?.text || "";
  setText(document.getElementById("party-notes-by"), board.notes?.by ? `Last written by ${board.notes.by}, ${new Date(board.notes.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` : "");
  const quests = document.getElementById("party-quests");
  if (quests && !typingInside(quests)) {
    quests.replaceChildren(...(board.quests.length ? board.quests.map((quest) => h("div", { class: quest.done ? "gear-row is-done" : "gear-row" }, [
      h("label", { class: "check-line" }, [
        h("input", { type: "checkbox", "data-quest": quest.id, checked: quest.done ? "checked" : null }),
        quest.title,
      ]),
      h("button", { type: "button", class: "text-btn", "data-action": "quest-remove", "data-id": quest.id }, "Remove"),
    ])) : [h("p", { class: "empty" }, "No quests yet.")]));
  }
  const glossary = document.getElementById("party-glossary");
  if (glossary) {
    glossary.replaceChildren(...(board.glossary.length ? board.glossary.map((item) => h("article", { class: "glossary-row", id: `gloss-${item.id}`, "data-name": item.name.toLowerCase() }, [
      h("p", { class: "sheet-title" }, item.name),
      item.body ? h("p", {}, item.body) : null,
      h("button", { type: "button", class: "text-btn", "data-action": "glossary-remove", "data-id": item.id }, "Remove"),
    ])) : [h("p", { class: "empty" }, "Nobody named yet.")]));
  }
  const coin = document.getElementById("party-coin");
  if (coin && !typingInside(coin)) {
    const people = Math.max(1, seatNames().length);
    const share = splitCoin(board.stash.cp, people);
    coin.replaceChildren(
      h("p", { class: "sheet-title" }, `Coin pot: ${formatCoin(board.stash.cp)}`),
      h("p", { class: "hint" }, board.stash.cp ? `Split evenly between ${people} ${people === 1 ? "seat" : "seats"}: ${formatCoin(share.each)} each.` : "Put coin in to split it evenly."),
      h("div", { class: "turn-actions amount-row" }, [
        h("label", {}, ["Gold", h("input", { id: "coin-amount", type: "number", min: "0", step: "1", inputmode: "numeric", placeholder: "0" })]),
        h("button", { type: "button", class: "btn", "data-action": "coin-put" }, "Put in"),
        h("button", { type: "button", class: "btn", "data-action": "coin-take" }, "Take"),
        board.stash.cp && share.each ? h("button", { type: "button", class: "btn", "data-action": "coin-share", "data-cp": String(share.each) }, "Take my share") : null,
      ].filter(Boolean)),
    );
  }
  const stash = document.getElementById("party-stash");
  if (stash) {
    stash.replaceChildren(...(board.stash.items.length ? board.stash.items.map((item) => h("div", { class: "gear-row" }, [
      h("span", {}, `${item.name}${item.qty > 1 ? ` × ${item.qty}` : ""} · from ${item.by}`),
      h("button", { type: "button", class: "btn", "data-action": "stash-take", "data-id": item.id }, "Take one"),
    ])) : [h("p", { class: "empty" }, "The stash is empty.")]));
  }
  const pick = document.getElementById("stash-pick");
  if (pick && document.activeElement !== pick) {
    const items = state.character.items || [];
    pick.replaceChildren(...(items.length ? items.map((item) => h("option", { value: item.id }, item.qty > 1 ? `${item.name} × ${item.qty}` : item.name)) : [h("option", { value: "" }, "The pack is empty")]));
  }
  const helpPick = document.getElementById("help-pick");
  if (helpPick && document.activeElement !== helpPick) {
    const others = seatNames().filter((name) => name !== seat.name);
    helpPick.replaceChildren(...(others.length ? others.map((name) => h("option", { value: name }, name)) : [h("option", { value: "" }, "Nobody else is seated")]));
  }
  paintPoll(board.poll);
  paintReady(board.ready);
  const xcard = document.getElementById("xcard-banner");
  if (xcard) {
    const was = !xcard.hidden;
    xcard.hidden = !board.xcard;
    if (board.xcard && !was) ping("X-card");
  }
  paintHelp(board.helps);
  void takeGifts(board.gifts);
  paintHandouts(board.handouts);
  paintWorld(board.world, board.mood);
  paintTableState(board);
}

function paintTableState(board) {
  const overlay = document.getElementById("pause-overlay");
  if (overlay) {
    overlay.hidden = !board.pause || gateMode !== "play";
    setText(document.getElementById("pause-text"), board.pause?.text || "Back soon.");
  }
  const mode = document.getElementById("talk-mode");
  if (mode) {
    const chat = board.chat || { mode: "open" };
    mode.hidden = chat.mode === "open";
    mode.textContent = chat.mode === "muted" ? "The DM has paused table talk. You can still whisper the DM." : chat.mode === "slow" ? `Slow chat: one message every ${chat.slow} seconds.` : "";
  }
  const rules = document.getElementById("party-rules");
  if (rules) {
    const safety = board.safety || { lines: [], veils: [] };
    rules.replaceChildren(...present([
      safety.lines.length || safety.veils.length ? h("h3", {}, "Lines and veils") : null,
      safety.lines.length ? h("p", {}, [h("strong", {}, "Lines, never in the game: "), safety.lines.join(", ")]) : null,
      safety.veils.length ? h("p", {}, [h("strong", {}, "Veils, off screen only: "), safety.veils.join(", ")]) : null,
      board.rules ? h("h3", {}, "Table rules") : null,
      ...(board.rules ? board.rules.split(/\n+/).map((line) => h("p", {}, line)) : []),
    ]));
  }
  const next = document.getElementById("party-next");
  if (next) {
    const when = board.next;
    next.replaceChildren(...present([
      when ? h("p", { class: "turn-banner" }, `Next session: ${[when.label, when.at ? new Date(when.at).toLocaleString([], { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""].filter(Boolean).join(", ")}`) : null,
      when?.at ? h("button", { type: "button", class: "btn", "data-action": "next-ics" }, "Add to my calendar") : null,
    ]));
  }
}

function nextIcs() {
  const when = lastRoom?.board?.next;
  if (!when?.at) return;
  const seat = loadSeat();
  downloadText(icsFor(when, `${location.origin}/player.html?room=${seat.room}`), "lantern-next-session.ics", "text/calendar");
}

// --- Rewards, handouts, and the world, from the DM.

let giftBusy = false;

async function takeGifts(gifts) {
  const seat = loadSeat();
  const mine = (gifts || []).filter((gift) => gift.to === seat.name);
  if (giftBusy || !mine.length || gateMode !== "play") return;
  giftBusy = true;
  const lines = [];
  try {
    for (const gift of mine) {
      const result = await postBoard(seat.room, { op: "gift-take", id: gift.id }).catch(() => null);
      if (!result?.gift) continue;
      const applied = applyGift(state.character, result.gift);
      if (!applied) continue;
      state.character = applied.character;
      lines.push(`${applied.line}${result.gift.reason ? ` (${result.gift.reason})` : ""}`);
    }
  } finally {
    giftBusy = false;
  }
  if (!lines.length) return;
  persist(`Received ${lines.join(", ")} from the DM.`);
  renderCharacter();
  renderKit();
  const banner = document.getElementById("gift-banner");
  if (banner) {
    banner.hidden = false;
    banner.replaceChildren(
      h("p", {}, `The DM gave you ${lines.join(", ")}.`),
      h("div", { class: "ask-actions" }, [h("button", { type: "button", class: "text-btn", "data-action": "gift-ok" }, "Got it")]),
    );
  }
  ping("A reward");
}

let seenHandouts = null;

function paintHandouts(handouts) {
  const mount = document.getElementById("party-handouts");
  const list = handouts || [];
  if (mount) {
    mount.replaceChildren(...(list.length ? [...list].reverse().map((item) => h("div", { class: "gear-row" }, [
      h("span", {}, `${item.title}${item.to ? " · just for you" : ""}${item.image ? " · picture" : ""}`),
      h("button", { type: "button", class: "btn", "data-action": "open-handout", "data-id": item.id }, "Read"),
    ])) : [h("p", { class: "empty" }, "The DM has not handed anything out.")]));
  }
  const ids = list.map((item) => item.id);
  if (seenHandouts && ids.some((id) => !seenHandouts.includes(id))) {
    const fresh = list.find((item) => !seenHandouts.includes(item.id));
    setText(document.getElementById("roll-live"), `New handout: ${fresh.title}.`);
    ping("A handout");
    void openHandout(fresh.id);
  }
  seenHandouts = ids;
}

async function openHandout(id) {
  const result = await boardOp({ op: "handout-get", id });
  if (!result?.handout) return;
  const { handout } = result;
  setText(document.getElementById("handout-title"), handout.title);
  const body = document.getElementById("handout-body");
  body.replaceChildren(...present([
    handout.image ? h("img", { src: handout.image, alt: handout.title, class: "handout-image" }) : null,
    ...(handout.text ? handout.text.split(/\n{2,}/).map((para) => h("p", {}, para)) : []),
  ]));
  const dialog = document.getElementById("handout-dialog");
  if (!dialog.open) dialog.showModal();
}

function paintWorld(world, mood) {
  const line = document.getElementById("world-line");
  if (!line) return;
  line.hidden = (!world && !mood) || gateMode !== "play";
  const parts = [];
  if (world) parts.push(`Day ${world.day} · ${String(world.hour).padStart(2, "0")}:00, ${hourText(world.hour)}${world.weather ? ` · ${world.weather}` : ""}`);
  if (mood) parts.push(`Mood: ${mood.label}`);
  line.textContent = parts.join(" · ");
}

function paintPoll(poll) {
  const mount = document.getElementById("party-poll");
  if (!mount || typingInside(mount)) return;
  const seat = loadSeat();
  if (!poll) {
    mount.replaceChildren(h("form", { "data-form": "poll", class: "form", autocomplete: "off" }, [
      h("label", {}, ["Question", h("input", { name: "question", maxlength: "120", required: "required", value: "When is the next session?", spellcheck: "true" })]),
      h("label", {}, ["Choices, one per line", h("textarea", { name: "options", rows: "3", maxlength: "500", placeholder: "Friday 7pm\nSaturday 2pm\nSunday 6pm" })]),
      h("button", { type: "submit", class: "btn" }, "Start the poll"),
    ]));
    return;
  }
  const most = Math.max(0, ...poll.options.map((option) => option.votes.length));
  mount.replaceChildren(...present([
    h("p", { class: "sheet-title" }, poll.question),
    h("p", { class: "hint" }, `${poll.closed ? "Closed" : "Open"}, started by ${poll.by}. Tap a choice to vote, or tap it again to take the vote back. You can pick more than one.`),
    ...poll.options.map((option) => h("button", {
      type: "button",
      class: option.votes.length && option.votes.length === most ? "btn poll-option is-best" : "btn poll-option",
      "data-action": "poll-vote",
      "data-option": option.id,
      "aria-pressed": option.votes.includes(seat.name) ? "true" : "false",
      disabled: poll.closed ? "disabled" : null,
    }, `${option.label} · ${option.votes.length}${option.votes.length ? ` (${option.votes.join(", ")})` : ""}`)),
    h("div", { class: "turn-actions" }, present([
      poll.closed ? null : h("button", { type: "button", class: "text-btn", "data-action": "poll-close" }, "Close the poll"),
      h("button", { type: "button", class: "text-btn", "data-action": "poll-clear" }, "Clear it"),
    ])),
  ]));
}

function paintReady(ready) {
  const banner = document.getElementById("ready-banner");
  const mount = document.getElementById("party-ready");
  const seat = loadSeat();
  if (mount) {
    mount.replaceChildren(h("button", { type: "button", class: "btn", "data-action": "ready-call" }, "Call a ready check"));
  }
  if (!banner) return;
  if (!ready || gateMode !== "play") {
    banner.hidden = true;
    return;
  }
  const names = [...new Set([...seatNames(), ...Object.keys(ready.answers)])];
  const waiting = names.filter((name) => !ready.answers[name]);
  const mine = ready.answers[seat.name];
  const was = banner.hidden;
  banner.hidden = false;
  banner.replaceChildren(
    h("p", {}, `${ready.by} called a ready check. ${names.map((name) => `${name}: ${ready.answers[name] === "ready" ? "ready" : ready.answers[name] === "wait" ? "wait" : "…"}`).join(" · ")}`),
    h("div", { class: "ask-actions" }, present([
      h("button", { type: "button", class: mine === "ready" ? "btn primary" : "btn", "data-action": "ready-answer", "data-answer": "ready" }, "Ready"),
      h("button", { type: "button", class: mine === "wait" ? "btn primary" : "btn", "data-action": "ready-answer", "data-answer": "wait" }, "Wait"),
      !waiting.length || ready.by === seat.name ? h("button", { type: "button", class: "text-btn", "data-action": "ready-clear" }, "Done") : null,
    ])),
  );
  if (was && !mine && ready.by !== seat.name) ping("Ready check");
}

function queuePartyNotes(text) {
  clearTimeout(partyNotesTimer);
  partyNotesTimer = setTimeout(async () => {
    partyNotesTimer = null;
    await boardOp({ op: "notes", text }, "Saved for the party.");
  }, 900);
}

function openGlossary(name) {
  showTab("party");
  const row = document.querySelector(`#party-glossary [data-name="${CSS.escape(name.toLowerCase())}"]`);
  if (row) {
    row.scrollIntoView({ block: "center" });
    row.classList.add("is-found");
    setTimeout(() => row.classList.remove("is-found"), 1600);
  } else {
    const form = document.querySelector("form[data-form='glossary']");
    if (form) {
      form.elements.name.value = name;
      form.elements.body.focus();
    }
  }
}

async function putInStash(form) {
  const id = form.elements.piece.value;
  const item = (state.character.items || []).find((entry) => entry.id === id);
  if (!item) return;
  const result = await boardOp({ op: "stash-put", name: item.name, gearId: item.id, qty: 1 }, `Put ${item.name} in the stash.`);
  if (!result) return;
  state.character.items = item.qty > 1
    ? state.character.items.map((entry) => (entry.id === id ? { ...entry, qty: entry.qty - 1 } : entry))
    : state.character.items.filter((entry) => entry.id !== id);
  persist(`Puts ${item.name} in the party stash.`);
  renderKit();
}

async function takeFromStash(id) {
  const result = await boardOp({ op: "stash-take", id }, "Taken.");
  if (!result?.taken) return;
  const { name, gearId } = result.taken;
  if (gearId && findGear(gearId)) {
    const found = state.character.items.find((entry) => entry.id === gearId);
    state.character.items = found
      ? state.character.items.map((entry) => (entry.id === gearId ? { ...entry, qty: Math.min(99, entry.qty + 1) } : entry))
      : [...state.character.items, { id: gearId, name, qty: 1 }];
  } else {
    const ex = extras();
    state.character.extras = cleanExtras({ ...ex, trinkets: [...ex.trinkets, { id: uid(), name, qty: 1 }] });
  }
  persist(`Takes ${name} from the party stash.`);
  renderKit();
}

async function moveCoin(op, cp) {
  if (!Number.isInteger(cp) || cp <= 0) return;
  const purse = state.character.purse || 0;
  if (op === "coin-put" && cp > purse) {
    setText(document.getElementById("party-status"), "The purse does not hold that much.");
    return;
  }
  const result = await boardOp({ op, cp }, op === "coin-put" ? `Put ${formatCoin(cp)} in the pot.` : `Took ${formatCoin(cp)}.`);
  if (!result) return;
  state.character.purse = op === "coin-put" ? purse - cp : purse + cp;
  persist(op === "coin-put" ? `Puts ${formatCoin(cp)} in the party pot.` : `Takes ${formatCoin(cp)} from the party pot.`);
  renderKit();
  if (lastRoom?.board) paintBoard(lastRoom.board);
}

// --- Chat: voice, typing, mentions, and the table's rolls.

function roomColors(players) {
  const colors = {};
  const portraits = {};
  for (const player of players || []) {
    const ex = player.snapshot?.character?.extras;
    if (ex?.color) colors[player.name] = ex.color;
    if (typeof ex?.portrait === "string" && ex.portrait.startsWith("data:image/")) portraits[player.name] = ex.portrait;
  }
  return { colors, portraits };
}

function paintTableRolls(events, players) {
  const mount = document.getElementById("table-rolls");
  if (!mount) return;
  const { colors } = roomColors(players);
  const rolls = (events || []).filter((event) => /^Rolled /.test(event.summary)).slice(0, 15);
  mount.replaceChildren(...(rolls.length ? rolls.map((event) => h("p", { class: event.secret ? "roll-line is-secret" : "roll-line", style: colors[event.name] ? `--who:${colors[event.name]}` : null }, [
    h("span", { class: "roll-who" }, event.secret ? `${event.name} (secret)` : event.name),
    ` ${event.summary.replace(/^Rolled /, "rolled ")}`,
  ])) : [h("p", { class: "hint" }, "No rolls at the table yet.")]));
}

function noticeMentions(messages, seat) {
  const names = [seat.name, state.character.name].filter(Boolean);
  let fresh = null;
  for (const message of messages) {
    if (seenMessages.has(message.id)) continue;
    seenMessages.add(message.id);
    if (messagesPrimed && message.from !== seat.name && mentions(message.text, names)) fresh = message;
    if (messagesPrimed && message.from !== seat.name) {
      const live = document.getElementById("talk-live");
      if (live) live.textContent = `${message.as || message.from}${message.kind === "emote" ? " " : ": "}${message.text}`;
    }
  }
  messagesPrimed = true;
  if (fresh && alertPrefs().mention) {
    ping("Mentioned");
    setText(document.getElementById("talk-status"), `${fresh.as || fresh.from} mentioned you.`);
  }
}

function paintRoomExtras(room, seat) {
  lastRoom = room;
  const { colors, portraits } = roomColors(room.players);
  paintTalk(document.getElementById("talk-log"), room.messages || [], {
    interactive: true,
    selfName: seat.name,
    mentionNames: [seat.name, state.character.name].filter(Boolean),
    colors,
    portraits,
  });
  paintPins(document.getElementById("talk-pins"), room.messages || []);
  setText(document.getElementById("talk-typing"), typingLine(room.players, seat.name));
  noticeMentions(room.messages || [], seat);
  paintTableRolls(room.events, room.players);
  if (room.board) paintBoard(room.board);
  paintPlayerMap(room, seat);
  const xcard = document.getElementById("xcard");
  if (xcard) xcard.hidden = false;
  paintTurnHelper();
}

function sendTyping() {
  if (!atSharedTable()) return;
  const now = Date.now();
  if (now - typingSentAt < 3000) return;
  typingSentAt = now;
  void postBoard(loadSeat().room, { op: "typing" }).catch(() => {});
}

function talkPayload(raw) {
  let text = raw;
  let kind = document.getElementById("talk-kind")?.value === "ooc" ? "ooc" : "ic";
  if (/^\/me\s+/i.test(text)) {
    kind = "emote";
    text = text.replace(/^\/me\s+/i, "");
  } else if (/^\/ooc\s+/i.test(text)) {
    kind = "ooc";
    text = text.replace(/^\/ooc\s+/i, "");
  }
  const as = kind === "ooc" ? "" : state.character.name || "";
  return { text, kind, as };
}

function boardClick(action, button) {
  const handlers = {
    "end-turn": () => void endMyTurn(),
    "open-recap": () => {
      paintRecap();
      document.getElementById("recap-dialog")?.showModal();
    },
    "close-recap": () => document.getElementById("recap-dialog")?.close(),
    "copy-recap": () => void copyRecap(),
    "turn-use": () => useEconomy(button.dataset.use),
    "use-reaction": () => void useReaction(),
    react: () => void boardOp({ op: "react", id: button.dataset.id, emoji: button.dataset.emoji }).then(() => watchShop()),
    pin: () => void boardOp({ op: "pin", id: button.dataset.id, on: button.dataset.on === "true" }).then(() => watchShop()),
    "glossary-open": () => openGlossary(button.dataset.name),
    "glossary-remove": () => void boardOp({ op: "glossary-remove", id: button.dataset.id }),
    "quest-remove": () => void boardOp({ op: "quest-remove", id: button.dataset.id }),
    "stash-take": () => void takeFromStash(button.dataset.id),
    "open-handout": () => void openHandout(button.dataset.id),
    "next-ics": () => nextIcs(),
    "close-handout": () => document.getElementById("handout-dialog").close(),
    "gift-ok": () => { document.getElementById("gift-banner").hidden = true; },
    "coin-put": () => void moveCoin("coin-put", readInt(document.getElementById("coin-amount"), 0, 0, 1_000_000) * 100),
    "coin-take": () => void moveCoin("coin-take", readInt(document.getElementById("coin-amount"), 0, 0, 1_000_000) * 100),
    "coin-share": () => void moveCoin("coin-take", Number(button.dataset.cp)),
    "poll-vote": () => void boardOp({ op: "poll-vote", option: button.dataset.option }),
    "poll-close": () => void boardOp({ op: "poll-close" }),
    "poll-clear": () => void boardOp({ op: "poll-clear" }),
    "ready-call": () => void boardOp({ op: "ready-call" }, "Ready check called."),
    "ready-answer": () => void boardOp({ op: "ready-answer", answer: button.dataset.answer }),
    "ready-clear": () => void boardOp({ op: "ready-clear" }),
    xcard: () => void boardOp({ op: "xcard" }).then((result) => {
      if (result) document.getElementById("xcard-banner").hidden = false;
    }),
    "xcard-clear": () => void boardOp({ op: "xcard-clear" }).then(() => {
      document.getElementById("xcard-banner").hidden = true;
    }),
  };
  const run = handlers[action];
  if (!run) return false;
  run();
  return true;
}

function boardSubmit(form) {
  const kind = form.dataset.form;
  if (kind === "quest") {
    const title = form.elements.title.value.trim();
    if (title) void boardOp({ op: "quest-add", title }, "Added the quest.").then((ok) => ok && form.reset());
  } else if (kind === "glossary") {
    const name = form.elements.name.value.trim();
    if (name) void boardOp({ op: "glossary-add", name, body: form.elements.body.value }, `Saved ${name}.`).then((ok) => ok && form.reset());
  } else if (kind === "stash") void putInStash(form);
  else if (kind === "help") {
    const to = form.elements.to.value;
    if (to) void boardOp({ op: "help", to }, `Helping ${to}. Their next d20 roll has advantage.`).then((ok) => ok && persist(`${state.character.name || loadSeat().name} helps ${to}.`));
  } else if (kind === "poll") {
    const options = form.elements.options.value.split("\n").map((line) => line.trim()).filter(Boolean);
    void boardOp({ op: "poll-open", question: form.elements.question.value, options }, "Poll started.");
  } else return false;
  return true;
}

function boardChange(target) {
  if (target.dataset?.quest) {
    void boardOp({ op: "quest-toggle", id: target.dataset.quest });
    return true;
  }
  if (target.id === "recap-since") {
    paintRecap();
    return true;
  }
  if (target.id === "alert-turn" || target.id === "alert-mention") {
    saveAlertPrefs({ ...alertPrefs(), [target.id === "alert-turn" ? "turn" : "mention"]: target.checked });
    return true;
  }
  return false;
}

function boardInput(target) {
  if (target.id === "party-notes") {
    queuePartyNotes(target.value);
    return true;
  }
  if (target.id === "talk-text") {
    sendTyping();
    return false;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Session recap: the table's talk and rolls in one scroll.

function recapEntries(room, hours) {
  const since = Date.now() - hours * 60 * 60 * 1000;
  const talk = (room?.messages || []).filter((message) => message.at >= since).map((message) => ({
    at: message.at,
    kind: "talk",
    who: message.as || message.from,
    text: message.kind === "emote" ? `${message.as || message.from} ${message.text}` : message.text,
    whisper: Boolean(message.to),
    ooc: message.kind === "ooc",
  }));
  const quiet = /^(Set |Named |Chose |Changed |Removed |Added |Saved |Cleared |Filled |Marked |Stopped |Counting |Using the suggested)/;
  const rolls = (room?.events || []).filter((event) => event.at >= since && !quiet.test(event.summary)).map((event) => ({
    at: event.at,
    kind: /^Rolled /.test(event.summary) ? "roll" : "event",
    who: event.name,
    text: event.summary,
    tag: /Natural 20/.test(event.summary) ? "natural-20" : /Natural 1\b/.test(event.summary) ? "natural-1" : "",
    secret: event.secret === true,
  }));
  return [...talk, ...rolls].sort((a, b) => a.at - b.at);
}

function recapText(entries) {
  return entries.map((entry) => {
    const time = new Date(entry.at).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
    return `[${time}] ${entry.who}: ${entry.text}${entry.whisper ? " (whisper)" : ""}${entry.secret ? " (secret)" : ""}`;
  }).join("\n");
}

function paintRecap() {
  const mount = document.getElementById("recap-list");
  if (!mount) return;
  if (!atSharedTable()) {
    mount.replaceChildren(h("p", { class: "hint" }, "The recap gathers a shared table. Playing alone, your rolls are on the dice panel."));
    return;
  }
  const hours = Number(document.getElementById("recap-since")?.value) || 6;
  const entries = recapEntries(lastRoom, hours);
  mount.replaceChildren(...(entries.length ? entries.map((entry) => h("article", {
    class: ["recap-row", `is-${entry.kind}`, entry.tag, entry.ooc ? "is-ooc" : "", entry.whisper ? "is-whisper" : ""].filter(Boolean).join(" "),
  }, [
    h("time", { datetime: new Date(entry.at).toISOString() }, new Date(entry.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })),
    h("p", {}, [h("strong", {}, entry.who), ` ${entry.text}`]),
  ])) : [h("p", { class: "hint" }, "Nothing at the table in that time.")]));
}

async function copyRecap() {
  const hours = Number(document.getElementById("recap-since")?.value) || 6;
  const text = recapText(recapEntries(lastRoom, hours));
  try {
    await navigator.clipboard.writeText(text);
    setText(document.getElementById("recap-status"), "Copied.");
  } catch {
    setText(document.getElementById("recap-status"), "This browser would not copy. Select the list and copy it by hand.");
  }
}

// ---------------------------------------------------------------------------
// Spellbook and magic items read from a PDF or a Lantern file.

const SPELL_ORDINAL = ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

function paintSpellbook() {
  const mount = document.getElementById("kit-spellbook");
  if (!mount || typingInside(mount)) return;
  const book = extras().spellbook || [];
  mount.replaceChildren(...present([
    h("h3", {}, "Spellbook"),
    h("p", { class: "hint" }, "Spells you know. Prepare one to put it under Tonight with its slot."),
    ...book.map((spell) => h("details", { class: "lib-row" }, [
      h("summary", {}, [h("span", { class: "lib-name" }, spell.name), h("span", { class: "hint" }, ` ${SPELL_ORDINAL[spell.level]}${spell.school ? ` ${spell.school}` : ""}${spell.concentration ? " · concentration" : ""}${spell.range ? ` · ${spell.range}` : ""}`)]),
      h("p", { class: "hint" }, [spell.castingTime, spell.components, spell.duration].filter(Boolean).join(" · ")),
      spell.text ? h("p", { class: "lib-text" }, spell.text) : null,
      h("div", { class: "turn-actions" }, [
        h("button", { type: "button", class: "btn", "data-action": "prepare-spell", "data-id": spell.id }, "Prepare for tonight"),
        h("button", { type: "button", class: "text-btn", "data-action": "forget-spell", "data-id": spell.id }, "Remove"),
      ]),
    ])),
    book.length ? null : h("p", { class: "empty" }, "No spells in the book yet."),
    h("div", { class: "turn-actions" }, [
      h("button", { type: "button", class: "btn", "data-action": "read-spells" }, "Read spells from a PDF or Lantern file"),
    ]),
    h("p", { id: "spell-status", class: "hint", role: "status" }, ""),
  ]));
}

async function readLibraryInput(file, want) {
  if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
    const { readPdf, looksScanned } = await import("./pdfread.js");
    const pdf = await readPdf(file);
    if (looksScanned(pdf)) throw new Error("That PDF is a picture of a page, with no text to read.");
    return readPdfContent(pdf, want);
  }
  return readLibraryFile(JSON.parse(await file.text()));
}

async function importSpells(file) {
  const status = () => document.getElementById("spell-status");
  setText(status(), "Reading…");
  try {
    const found = await readLibraryInput(file, "spells");
    const spells = (found.spells || []).map((spell) => cleanSpell(spell, 800)).filter(Boolean);
    if (!spells.length) throw new Error("No spells found. Lantern reads spells laid out like the SRD: name, then level and school.");
    const ex = extras();
    const known = new Set(ex.spellbook.map((spell) => spell.name.toLowerCase()));
    const fresh = spells.filter((spell) => !known.has(spell.name.toLowerCase()));
    state.character.extras = cleanExtras({ ...ex, spellbook: [...ex.spellbook, ...fresh] });
    const kept = state.character.extras.spellbook.length - ex.spellbook.length;
    persist(`Added ${kept} spells to the spellbook.`);
    renderKit();
    setText(status(), `Added ${kept} of ${spells.length}.${kept < fresh.length ? " The book holds forty." : ""}`);
  } catch (error) {
    setText(status(), error instanceof SyntaxError ? "That file is not a Lantern file or a PDF." : error.message);
  }
}

async function importItems(file) {
  const status = document.getElementById("item-status");
  setText(status, "Reading…");
  try {
    const found = await readLibraryInput(file, "items");
    const items = found.items || [];
    if (!items.length) throw new Error("No magic items found. Lantern reads items laid out like the SRD: name, then type and rarity.");
    const ex = extras();
    const room = TRINKET_CAP - ex.trinkets.length;
    const adding = items.slice(0, Math.max(0, room)).map((item) => ({
      id: uid(),
      name: item.name,
      qty: 1,
      weight: item.weight || 0,
      attune: item.attune,
      note: [item.rarity, item.text].filter(Boolean).join(". ").slice(0, 120),
    }));
    setExtras({ ...ex, trinkets: [...ex.trinkets, ...adding] }, `Added ${adding.length} magic items.`);
    setText(status, `Added ${adding.length} of ${items.length}.${adding.length < items.length ? " The pack holds twenty magic items." : ""}`);
  } catch (error) {
    setText(status, error instanceof SyntaxError ? "That file is not a Lantern file or a PDF." : error.message);
  }
}

function prepareSpell(id) {
  const spell = extras().spellbook.find((item) => item.id === id);
  if (!spell) return;
  if ((state.character.spells || []).some((item) => item.name === spell.name)) {
    setText(document.getElementById("spell-status"), `${spell.name} is already under Tonight.`);
    return;
  }
  state.character.spells = [...(state.character.spells || []), { id: uid(), name: spell.name, slot: spell.level, used: false }];
  persist(`Prepared ${spell.name}.`);
  renderKit();
}

function libraryClick(action, button) {
  if (action === "read-spells") document.getElementById("spell-file")?.click();
  else if (action === "read-items") document.getElementById("item-file")?.click();
  else if (action === "prepare-spell") prepareSpell(button.dataset.id);
  else if (action === "forget-spell") setExtras({ ...extras(), spellbook: extras().spellbook.filter((item) => item.id !== button.dataset.id) }, "Removed a spell from the book.");
  else return false;
  return true;
}

function boot() {
  bootTextSize(document.getElementById("text-size"));
  bootDisplay({ contrast: document.getElementById("contrast-switch"), motion: document.getElementById("motion-switch") });
  registerOffline();
  setInterval(() => {
    const timer = document.getElementById("turn-timer");
    if (timer) timer.textContent = turnTimerText(turnFacts().order);
  }, 1000);
  document.addEventListener("visibilitychange", onVisibility);
  if (state.pauseReason === "hidden") {
    resumeLights();
    state.pauseReason = "";
  }
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
  document.getElementById("portrait-file")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void loadPortrait(file);
  });
  renderMacros();
  for (const [id, read] of [["spell-file", importSpells], ["item-file", importItems]]) {
    document.getElementById(id)?.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) void read(file);
    });
  }
  const prefs = alertPrefs();
  const turnBox = document.getElementById("alert-turn");
  const mentionBox = document.getElementById("alert-mention");
  if (turnBox) turnBox.checked = prefs.turn;
  if (mentionBox) mentionBox.checked = prefs.mention;
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
  bootPlayerMap();
  setInterval(() => { void watchShop(); }, 2000);
  void watchShop();
}

boot();
