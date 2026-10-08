// Prices are copper. 1 pp = 10 gp, 1 gp = 2 ep, 1 ep = 5 sp, 1 sp = 10 cp.
// Starting purses are the average of the 2014 class wealth tables.

import { BASE_LIST, COUNTER_CAP } from "./catalog.js";

export { BASE_LIST, COUNTER_CAP };

const CATALOG = BASE_LIST.flatMap((group) => group.items);

export const GEAR = CATALOG.filter((item) => item.service !== true).map((item) => {
  const gear = { id: item.id, name: item.name, cp: item.cp };
  if (item.consumable) gear.consumable = true;
  return gear;
});

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
  ...CATALOG.filter((item) => item.service === true).map((item) => ({
    id: item.id,
    name: item.name,
    cp: item.cp,
    service: true,
  })),
];

function groupIds(id) {
  const group = BASE_LIST.find((entry) => entry.id === id);
  return group ? group.items.map((item) => item.id) : [];
}

const SMITH = [
  ...groupIds("weapons"),
  ...groupIds("armor"),
  ...groupIds("ammunition"),
  "smiths-tools",
  "whetstone",
  "upgrade-plus-1",
];

const MARKET = [
  "dagger", "handaxe", "javelin", "mace", "quarterstaff", "spear",
  "shortsword", "scimitar", "longsword", "rapier", "greataxe",
  "shortbow", "longbow", "light-crossbow", "dart", "shield",
  "leather", "scale-mail", "chain-shirt", "chain-mail",
  "holy-symbol", "arcane-focus", "druidic-focus", "component-pouch",
  "thieves-tools", "healers-kit", "spellbook", "lute",
  "explorers-pack", "dungeoneers-pack", "scholars-pack", "priests-pack",
  "burglars-pack", "diplomats-pack", "entertainers-pack",
  "clothes", "rope", "torch", "rations", "potion-healing", "arrows", "bolts",
  "backpack", "bedroll", "tinderbox", "waterskin", "pouch", "candle",
  "lantern-hooded", "oil", "piton", "grappling-hook", "crowbar", "hammer",
  "blanket", "mess-kit",
];

export const STALLS = [
  {
    id: "market",
    name: "Market",
    hint: "The general counter: rope, rations, weapons, and the rest.",
    goods: MARKET,
  },
  {
    id: "apothecary",
    name: "Apothecary",
    hint: "Vials and kits. A potions counter does not sell swords.",
    goods: [
      "potion-healing", "antitoxin", "acid", "alchemists-fire", "holy-water",
      "healers-kit", "herbalism-kit", "poison-basic", "vial", "perfume",
    ],
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
    goods: [
      "spellbook", "book", "ink", "ink-pen", "paper", "parchment",
      "sealing-wax", "component-pouch", "scroll-case", "calligraphers-supplies",
    ],
  },
  {
    id: "tavern",
    name: "Tavern",
    hint: "A tab at the bar, or a room for the night. Paying does not put the room in the pack.",
    goods: groupIds("tavern"),
  },
  {
    id: "stable",
    name: "Stable",
    hint: "Mounts, tack, and wagons. A ship is here if this harbor sells one.",
    goods: groupIds("mounts"),
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

const COIN_WORTH = [
  ["pp", 1000],
  ["gp", 100],
  ["ep", 50],
  ["sp", 10],
  ["cp", 1],
];

const COIN_RATE = Object.fromEntries(COIN_WORTH);

export function parseCoin(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return null;
  if (/^\d{1,7}$/.test(raw)) return Math.min(10_000_000, Number(raw) * 100);
  let total = 0;
  let any = false;
  for (const match of raw.matchAll(/(\d+)\s*(pp|gp|ep|sp|cp)\b/g)) {
    any = true;
    total += Number(match[1]) * COIN_RATE[match[2]];
  }
  if (!any) return null;
  return Math.min(10_000_000, total);
}

export function formatCoin(cp) {
  const n = Number(cp);
  if (!Number.isFinite(n)) return "0 cp";
  const sign = n < 0 ? "−" : "";
  let left = Math.abs(Math.trunc(n));
  const parts = [];
  for (const [name, worth] of COIN_WORTH) {
    if (name === "cp") {
      if (left || !parts.length) parts.push(`${left} cp`);
      break;
    }
    const count = Math.floor(left / worth);
    if (!count) continue;
    parts.push(`${count} ${name}`);
    left -= count * worth;
  }
  return sign + parts.join(", ");
}

export function coinCounts(cp) {
  let left = Math.max(0, Math.trunc(Number(cp) || 0));
  return COIN_WORTH.map(([name, worth]) => {
    const count = Math.floor(left / worth);
    left -= count * worth;
    return { name, count };
  });
}

const AMMO_FOR = {
  shortbow: "arrows",
  longbow: "arrows",
  "light-crossbow": "bolts",
  "hand-crossbow": "bolts",
  "heavy-crossbow": "bolts",
  blowgun: "blowgun-needles",
  sling: "sling-bullets",
};

const CASTER_CLASSES = new Set([
  "bard", "cleric", "druid", "paladin", "ranger", "sorcerer", "warlock", "wizard",
]);

const FOCUS_IDS = new Set([
  "component-pouch",
  "arcane-focus", "crystal", "orb", "rod", "arcane-staff", "wand",
  "druidic-focus", "mistletoe", "totem", "wooden-staff", "yew-wand",
  "holy-symbol", "amulet", "emblem", "reliquary",
]);

function carriedIds(items) {
  return new Set((items || []).filter((item) => item && item.qty > 0).map((item) => item.id));
}

export function stapleIds(character) {
  const carried = carriedIds(character?.items);
  const wanted = [];
  const seen = new Set();
  const want = (id) => {
    if (seen.has(id) || carried.has(id)) return;
    seen.add(id);
    wanted.push(id);
  };
  for (const item of character?.items || []) {
    if (item && item.qty > 0 && AMMO_FOR[item.id]) want(AMMO_FOR[item.id]);
  }
  const casts = CASTER_CLASSES.has(character?.classId);
  const hasFocus = [...FOCUS_IDS].some((id) => carried.has(id));
  if (casts && !hasFocus) want("component-pouch");
  return wanted;
}

export function restockStaples(character, offers) {
  const byId = new Map((offers || []).filter((offer) => offer && offer.service !== true).map((offer) => [offer.id, offer]));
  let next = character;
  const bought = [];
  const skipped = [];
  for (const id of stapleIds(character)) {
    const offer = byId.get(id);
    if (!offer) continue;
    const paid = payCounter(next, offer);
    if (!paid.ok) {
      skipped.push({ id, name: offer.name, reason: paid.reason });
      continue;
    }
    next = paid.character;
    bought.push({ id, name: offer.name, cp: offer.cp });
  }
  return { character: next, bought, skipped };
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
