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
  { id: "book", name: "Book", cp: 2500 },
  { id: "ink", name: "Ink (1 ounce)", cp: 1000 },
  { id: "paper", name: "Paper (one sheet)", cp: 20 },
  { id: "parchment", name: "Parchment (one sheet)", cp: 10 },
  { id: "antitoxin", name: "Antitoxin", cp: 5000 },
  { id: "acid", name: "Acid (vial)", cp: 2500 },
  { id: "alchemists-fire", name: "Alchemist's fire", cp: 5000 },
  { id: "holy-water", name: "Holy water", cp: 2500 },
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

const SERVICES = [
  { id: "upgrade-plus-1", name: "Bring a weapon or armor from +0 to +1", cp: 50000, service: true },
  { id: "ale-mug", name: "Ale, mug", cp: 4, service: true },
  { id: "meal-modest", name: "Meal, modest", cp: 30, service: true },
  { id: "room-modest", name: "Room for the night, modest", cp: 50, service: true },
  { id: "wine-fine", name: "Wine, fine (bottle)", cp: 1000, service: true },
];

const SMITH = [
  "dagger", "handaxe", "javelin", "mace", "quarterstaff", "spear",
  "shortsword", "scimitar", "longsword", "rapier", "greataxe",
  "shortbow", "longbow", "light-crossbow", "dart", "shield",
  "leather", "scale-mail", "chain-shirt", "chain-mail", "arrows", "bolts",
  "upgrade-plus-1",
];

export const STALLS = [
  {
    id: "market",
    name: "Market",
    hint: "The general counter: rope, rations, weapons, and the rest.",
    goods: [
      "dagger", "handaxe", "javelin", "mace", "quarterstaff", "spear",
      "shortsword", "scimitar", "longsword", "rapier", "greataxe",
      "shortbow", "longbow", "light-crossbow", "dart", "shield",
      "leather", "scale-mail", "chain-shirt", "chain-mail",
      "holy-symbol", "arcane-focus", "druidic-focus", "component-pouch",
      "thieves-tools", "healers-kit", "spellbook", "lute",
      "explorers-pack", "dungeoneers-pack", "scholars-pack", "priests-pack",
      "burglars-pack", "diplomats-pack", "entertainers-pack",
      "clothes", "rope", "torch", "rations", "potion-healing", "arrows", "bolts",
    ],
  },
  {
    id: "apothecary",
    name: "Apothecary",
    hint: "Vials and kits. A potions counter does not sell swords.",
    goods: ["potion-healing", "antitoxin", "acid", "alchemists-fire", "holy-water", "healers-kit"],
  },
  {
    id: "smith",
    name: "Smith",
    hint: "Blades, armor, and a +1 from this forge. The price is what this smith charges.",
    goods: SMITH,
  },
  {
    id: "scribe",
    name: "Scribe",
    hint: "Spellbooks, ink, and paper.",
    goods: ["spellbook", "book", "ink", "paper", "parchment", "component-pouch"],
  },
  {
    id: "tavern",
    name: "Tavern",
    hint: "A tab at the bar, or a room for the night. Paying does not put the room in the pack.",
    goods: ["ale-mug", "meal-modest", "room-modest", "wine-fine"],
  },
];

const GEAR_IDS = new Set(GEAR.map((item) => item.id));
const SERVICE_IDS = new Set(SERVICES.map((item) => item.id));

export function findGear(id) {
  return GEAR.find((item) => item.id === id) || null;
}

export function findService(id) {
  return SERVICES.find((item) => item.id === id) || null;
}

export function findOffer(id) {
  return findGear(id) || findService(id);
}

export function stallById(id) {
  return STALLS.find((stall) => stall.id === id) || null;
}

export function counterFor(stallId) {
  const stall = stallById(stallId) || STALLS[0];
  return {
    stall: stall.id,
    name: stall.name,
    goods: stall.goods.map((id) => {
      const offer = findOffer(id);
      return {
        id: offer.id,
        name: offer.name,
        cp: offer.cp,
        service: offer.service === true,
      };
    }),
  };
}

export function parseCoin(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (/^\d{1,7}$/.test(raw)) return Math.min(10_000_000, Number(raw) * 100);
  let total = 0;
  let any = false;
  for (const match of raw.matchAll(/(\d+)\s*(gp|sp|cp)/g)) {
    any = true;
    const count = Number(match[1]);
    total += match[2] === "gp" ? count * 100 : match[2] === "sp" ? count * 10 : count;
  }
  if (!any) return null;
  return Math.min(10_000_000, total);
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

function takePiece(items, id) {
  let taken = false;
  const next = [];
  for (const item of items) {
    if (!taken && item.id === id && item.qty > 0) {
      taken = true;
      if (item.qty > 1) next.push({ ...item, qty: item.qty - 1 });
    } else {
      next.push({ ...item });
    }
  }
  return taken ? next : null;
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

export function buyItem(character, id) {
  const gear = findGear(id);
  if (!gear) return { ok: false, reason: "That is not in the shop." };
  return payCounter(character, { id: gear.id, name: gear.name, cp: gear.cp, service: false });
}

export function payCounter(character, offer) {
  if (!offer || typeof offer.id !== "string") return { ok: false, reason: "That is not on the counter." };
  const cp = offer.cp;
  if (!Number.isInteger(cp) || cp < 0) return { ok: false, reason: "That price is not a price." };
  const purse = character.purse ?? 0;
  if (purse < cp) return { ok: false, reason: "Not enough coin." };
  const service = offer.service === true || SERVICE_IDS.has(offer.id);
  if (service) {
    return {
      ok: true,
      service: true,
      character: { ...character, purse: purse - cp },
    };
  }
  const gear = findGear(offer.id);
  if (!gear) return { ok: false, reason: "That is not on the counter." };
  return {
    ok: true,
    service: false,
    character: {
      ...character,
      purse: purse - cp,
      items: addPiece(character.items || [], gear.id, 1),
    },
  };
}

export function buyBackItem(character, offer) {
  if (!offer || typeof offer.id !== "string") return { ok: false, reason: "That is no longer held for buy back." };
  if (offer.service === true || SERVICE_IDS.has(offer.id)) {
    return { ok: false, reason: "A service is not something you can buy back." };
  }
  const gear = findGear(offer.id);
  if (!gear) return { ok: false, reason: "That is no longer held for buy back." };
  const cp = offer.cp;
  if (!Number.isInteger(cp) || cp < 0) return { ok: false, reason: "That price is not a price." };
  const purse = character.purse ?? 0;
  if (purse < cp) return { ok: false, reason: "Not enough coin." };
  return {
    ok: true,
    character: {
      ...character,
      purse: purse - cp,
      items: addPiece(character.items || [], gear.id, 1),
    },
  };
}

export function sellPrice(cp) {
  if (!Number.isInteger(cp) || cp < 0) return null;
  return Math.floor(cp / 2);
}

export function sellOffers(offers, items) {
  const carried = new Set((items || []).filter((item) => item && item.qty > 0).map((item) => item.id));
  return (offers || []).filter((offer) => (
    offer
    && offer.service !== true
    && !SERVICE_IDS.has(offer.id)
    && carried.has(offer.id)
    && findGear(offer.id)
  ));
}

export function sellToCounter(character, offer) {
  if (!offer || typeof offer.id !== "string") return { ok: false, reason: "That is not on the counter." };
  if (offer.service === true || SERVICE_IDS.has(offer.id)) {
    return { ok: false, reason: "A service is not something this counter buys." };
  }
  const gear = findGear(offer.id);
  if (!gear) return { ok: false, reason: "That is not on the counter." };
  const gained = sellPrice(offer.cp);
  if (gained == null) return { ok: false, reason: "That price is not a price." };
  const next = takePiece(character.items || [], gear.id);
  if (!next) return { ok: false, reason: "That is not in the pack." };
  return {
    ok: true,
    gained,
    character: {
      ...character,
      purse: Math.min(10_000_000, (character.purse ?? 0) + gained),
      items: next,
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
