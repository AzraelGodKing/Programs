// Characters kept in this browser, one list per table code.
// A dead character stays here to view and export, and is not loaded again.

import { cleanCharacter, sheetTitle } from "./character.js";
import { normalizeCode } from "./table.js";

export const ROSTER_KEY = "lantern.roster.v1";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanId(value) {
  if (typeof value !== "string") return "";
  const id = value.trim().slice(0, 80);
  return /^[A-Za-z0-9_-]+$/.test(id) ? id : "";
}

function cleanEntry(item, seen) {
  if (!item || typeof item !== "object") return null;
  const id = cleanId(item.id);
  if (!id || seen.has(id)) return null;
  seen.add(id);
  return {
    id,
    dead: item.dead === true,
    sheet: cleanCharacter(item.sheet),
  };
}

export function normalizeRoster(input) {
  const source = input && typeof input === "object" ? input : {};
  const tablesIn = source.tables && typeof source.tables === "object" ? source.tables : {};
  const tables = {};
  for (const [code, list] of Object.entries(tablesIn)) {
    const key = normalizeCode(code);
    if (key.length !== 4) continue;
    const seen = new Set();
    const characters = asArray(list).map((item) => cleanEntry(item, seen)).filter(Boolean).slice(0, 40);
    if (characters.length) tables[key] = characters;
  }
  const activeIn = source.active && typeof source.active === "object" ? source.active : {};
  const active = {};
  for (const [code, id] of Object.entries(activeIn)) {
    const key = normalizeCode(code);
    const found = (tables[key] || []).find((entry) => entry.id === id && !entry.dead);
    if (found) active[key] = found.id;
  }
  return { tables, active };
}

export function loadRoster() {
  if (typeof localStorage === "undefined") return normalizeRoster(null);
  try {
    return normalizeRoster(JSON.parse(localStorage.getItem(ROSTER_KEY) || "null"));
  } catch {
    return normalizeRoster(null);
  }
}

export function saveRoster(roster) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(normalizeRoster(roster)));
  } catch {
    // The sheet on screen still works if the browser refuses the list.
  }
}

export function clearRoster() {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(ROSTER_KEY);
  } catch {
    // The screen reset still clears the list in memory.
  }
}

export function charactersAt(roster, code) {
  return [...(normalizeRoster(roster).tables[normalizeCode(code)] || [])];
}

export function findEntry(roster, code, id) {
  return charactersAt(roster, code).find((entry) => entry.id === id) || null;
}

export function activeCharacter(roster, code) {
  const stored = normalizeRoster(roster);
  const key = normalizeCode(code);
  const id = stored.active[key];
  return (stored.tables[key] || []).find((entry) => entry.id === id && !entry.dead) || null;
}

export function rosterHasCharacters(roster) {
  return Object.values(normalizeRoster(roster).tables).some((list) => list.length > 0);
}

export function characterLabel(entry) {
  return sheetTitle(entry.sheet) || "Unnamed hero";
}

export function addCharacter(roster, code, sheet) {
  const key = normalizeCode(code);
  if (key.length !== 4) return null;
  const stored = normalizeRoster(roster);
  const entry = {
    id: crypto.randomUUID(),
    dead: false,
    sheet: cleanCharacter({ ...sheet, touched: true }),
  };
  const tables = { ...stored.tables, [key]: [...(stored.tables[key] || []), entry] };
  return { roster: { tables, active: { ...stored.active, [key]: entry.id } }, entry };
}

export function chooseCharacter(roster, code, id) {
  const stored = normalizeRoster(roster);
  const key = normalizeCode(code);
  const entry = (stored.tables[key] || []).find((item) => item.id === id && !item.dead);
  if (!entry) return stored;
  return { tables: stored.tables, active: { ...stored.active, [key]: entry.id } };
}

export function writeSheet(roster, code, id, sheet) {
  const stored = normalizeRoster(roster);
  const key = normalizeCode(code);
  let found = false;
  const list = (stored.tables[key] || []).map((entry) => {
    if (entry.id !== id || entry.dead) return entry;
    found = true;
    return { ...entry, sheet: cleanCharacter(sheet) };
  });
  if (!found) return stored;
  return { tables: { ...stored.tables, [key]: list }, active: stored.active };
}

export function markDead(roster, code, id) {
  const stored = normalizeRoster(roster);
  const key = normalizeCode(code);
  const list = (stored.tables[key] || []).map((entry) => (
    entry.id === id ? { ...entry, dead: true } : entry
  ));
  const active = { ...stored.active };
  if (active[key] === id) delete active[key];
  return { tables: { ...stored.tables, [key]: list }, active };
}

export function exportCharacter(entry, now = new Date()) {
  return {
    lantern: 1,
    kind: "character",
    savedAt: now.toISOString(),
    dead: entry.dead === true,
    character: cleanCharacter(entry.sheet),
  };
}

export function characterFilename(entry, now = new Date()) {
  const name = entry?.sheet?.name || "";
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const day = now.toISOString().slice(0, 10);
  return slug ? `lantern-character-${slug}-${day}.json` : `lantern-character-${day}.json`;
}
