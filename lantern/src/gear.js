// Prices are copper. 1 gp = 100 cp, 1 sp = 10 cp.
// Starting purses are the average of the 2014 class wealth tables.

export const GEAR = [
  { id: "dagger", name: "Dagger", cp: 200 },
  { id: "handaxe", name: "Handaxe", cp: 500 },
  { id: "javelin", name: "Javelin", cp: 50 },
  { id: "mace", name: "Mace", cp: 500 },
  { id: "quarterstaff", name: "Quarterstaff", cp: 20 },
  { id: "spear", name: "Spear", cp: 100 },
  { id: "shortsword", name: "Shortsword", cp: 1000 },
  { id: "scimitar", name: "Scimitar", cp: 2500 },
  { id: "longsword", name: "Longsword", cp: 1500 },
  { id: "rapier", name: "Rapier", cp: 2500 },
  { id: "greataxe", name: "Greataxe", cp: 3000 },
  { id: "shortbow", name: "Shortbow", cp: 2500 },
  { id: "longbow", name: "Longbow", cp: 5000 },
  { id: "light-crossbow", name: "Light crossbow", cp: 2500 },
  { id: "dart", name: "Dart", cp: 5 },
  { id: "shield", name: "Shield", cp: 1000 },
  { id: "leather", name: "Leather armor", cp: 1000 },
  { id: "scale-mail", name: "Scale mail", cp: 5000 },
  { id: "chain-shirt", name: "Chain shirt", cp: 5000 },
  { id: "chain-mail", name: "Chain mail", cp: 7500 },
  { id: "holy-symbol", name: "Holy symbol", cp: 500 },
  { id: "arcane-focus", name: "Arcane focus", cp: 1000 },
  { id: "druidic-focus", name: "Druidic focus", cp: 100 },
  { id: "component-pouch", name: "Component pouch", cp: 2500 },
  { id: "thieves-tools", name: "Thieves' tools", cp: 2500 },
  { id: "healers-kit", name: "Healer's kit", cp: 500 },
  { id: "spellbook", name: "Spellbook", cp: 5000 },
  { id: "lute", name: "Lute", cp: 3500 },
  { id: "explorers-pack", name: "Explorer's pack", cp: 1000 },
  { id: "dungeoneers-pack", name: "Dungeoneer's pack", cp: 1200 },
  { id: "scholars-pack", name: "Scholar's pack", cp: 4000 },
  { id: "priests-pack", name: "Priest's pack", cp: 1900 },
  { id: "burglars-pack", name: "Burglar's pack", cp: 1600 },
  { id: "diplomats-pack", name: "Diplomat's pack", cp: 3900 },
  { id: "entertainers-pack", name: "Entertainer's pack", cp: 4000 },
  { id: "clothes", name: "Common clothes", cp: 50 },
  { id: "rope", name: "Hempen rope, 50 feet", cp: 100 },
  { id: "torch", name: "Torch", cp: 1, consumable: true },
  { id: "rations", name: "Rations (1 day)", cp: 50, consumable: true },
  { id: "potion-healing", name: "Potion of healing", cp: 5000, consumable: true },
  { id: "arrows", name: "Arrows (20)", cp: 100 },
  { id: "bolts", name: "Crossbow bolts (20)", cp: 100 },
];

const KITS = {
  barbarian: [["greataxe", 1], ["javelin", 4], ["explorers-pack", 1]],
  bard: [["rapier", 1], ["leather", 1], ["diplomats-pack", 1], ["lute", 1]],
  cleric: [["mace", 1], ["scale-mail", 1], ["shield", 1], ["priests-pack", 1], ["holy-symbol", 1]],
  druid: [["scimitar", 1], ["leather", 1], ["shield", 1], ["explorers-pack", 1], ["druidic-focus", 1]],
  fighter: [["chain-mail", 1], ["longsword", 1], ["shield", 1], ["light-crossbow", 1], ["bolts", 1], ["dungeoneers-pack", 1]],
  monk: [["shortsword", 1], ["dart", 10], ["dungeoneers-pack", 1]],
  paladin: [["longsword", 1], ["shield", 1], ["chain-mail", 1], ["javelin", 5], ["priests-pack", 1], ["holy-symbol", 1]],
  ranger: [["scale-mail", 1], ["longsword", 1], ["shortbow", 1], ["arrows", 1], ["explorers-pack", 1]],
  rogue: [["rapier", 1], ["shortbow", 1], ["arrows", 1], ["leather", 1], ["burglars-pack", 1], ["thieves-tools", 1]],
  sorcerer: [["light-crossbow", 1], ["bolts", 1], ["dagger", 2], ["component-pouch", 1], ["dungeoneers-pack", 1]],
  warlock: [["light-crossbow", 1], ["bolts", 1], ["dagger", 2], ["leather", 1], ["component-pouch", 1], ["scholars-pack", 1]],
  wizard: [["quarterstaff", 1], ["component-pouch", 1], ["scholars-pack", 1], ["spellbook", 1]],
  custom: [["dagger", 1], ["explorers-pack", 1], ["clothes", 1]],
};

const STARTING_CP = {
  barbarian: 5000,
  bard: 12500,
  cleric: 12500,
  druid: 5000,
  fighter: 12500,
  monk: 1250,
  paladin: 12500,
  ranger: 12500,
  rogue: 10000,
  sorcerer: 7500,
  warlock: 10000,
  wizard: 10000,
  custom: 5000,
};

const GEAR_IDS = new Set(GEAR.map((item) => item.id));

export function findGear(id) {
  return GEAR.find((item) => item.id === id) || null;
}

export function formatCoin(cp) {
  const n = Number(cp);
  if (!Number.isFinite(n)) return "0 cp";
  const sign = n < 0 ? "−" : "";
  let left = Math.abs(Math.trunc(n));
  const gp = Math.floor(left / 100);
  left %= 100;
  const sp = Math.floor(left / 10);
  const copper = left % 10;
  const parts = [];
  if (gp) parts.push(`${gp} gp`);
  if (sp) parts.push(`${sp} sp`);
  if (copper || !parts.length) parts.push(`${copper} cp`);
  return sign + parts.join(", ");
}

export function startingPurse(classId) {
  return STARTING_CP[classId] ?? STARTING_CP.custom;
}

export function kitFor(classId) {
  return (KITS[classId] || KITS.custom).map(([id, qty]) => ({ id, qty }));
}

function piece(id, qty) {
  const gear = findGear(id);
  if (!gear) return null;
  const count = Number(qty);
  if (!Number.isInteger(count) || count < 1) return null;
  return { id: gear.id, name: gear.name, qty: Math.min(99, count) };
}

function addPiece(items, id, qty) {
  const made = piece(id, qty);
  if (!made) return items;
  const next = items.map((item) => ({ ...item }));
  const found = next.find((item) => item.id === made.id);
  if (found) found.qty = Math.min(99, found.qty + made.qty);
  else next.push(made);
  return next.slice(0, 40);
}

export function cleanItems(value) {
  if (!Array.isArray(value)) return [];
  const items = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object" || !GEAR_IDS.has(raw.id)) continue;
    const made = piece(raw.id, raw.qty);
    if (!made || items.some((item) => item.id === made.id)) continue;
    items.push(made);
    if (items.length === 40) break;
  }
  return items;
}

export function cleanPurse(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return Math.min(10_000_000, Math.max(0, n));
}

export function needsStartingGear(character) {
  return character.purse == null && (!character.items || character.items.length === 0);
}

export function equipNewCharacter(character) {
  if (!needsStartingGear(character)) return character;
  let items = [];
  for (const entry of kitFor(character.classId)) items = addPiece(items, entry.id, entry.qty);
  return {
    ...character,
    items,
    purse: startingPurse(character.classId),
  };
}

export function unclaimed(character) {
  const carried = new Set((character.items || []).map((item) => item.id));
  return kitFor(character.classId).filter((entry) => !carried.has(entry.id));
}

export function claimItem(character, id) {
  const entry = unclaimed(character).find((item) => item.id === id);
  if (!entry) return { ok: false, reason: "That is already in the pack, or it is not starting gear." };
  return {
    ok: true,
    character: { ...character, items: addPiece(character.items || [], entry.id, entry.qty) },
  };
}

export function buyItem(character, id) {
  const gear = findGear(id);
  if (!gear) return { ok: false, reason: "That is not in the shop." };
  const purse = character.purse ?? 0;
  if (purse < gear.cp) return { ok: false, reason: "Not enough coin." };
  return {
    ok: true,
    character: {
      ...character,
      purse: purse - gear.cp,
      items: addPiece(character.items || [], id, 1),
    },
  };
}

export function useItem(character, id) {
  const items = character.items || [];
  const item = items.find((entry) => entry.id === id);
  if (!item) return { ok: false, reason: "That is not in the pack." };
  const gear = findGear(id);
  if (!gear?.consumable) return { ok: true, character, used: item.name, spent: false, left: item.qty };
  const left = item.qty - 1;
  const next = left > 0
    ? items.map((entry) => (entry.id === id ? { ...entry, qty: left } : entry))
    : items.filter((entry) => entry.id !== id);
  return { ok: true, character: { ...character, items: next }, used: item.name, spent: true, left };
}
