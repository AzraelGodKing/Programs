// Armor class from the armor and shield in the pack. A typed number replaces it.

import { abilityMod, abilityTotals } from "./character.js";

const ARMOR = {
  padded: { base: 11, dex: "full" },
  leather: { base: 11, dex: "full" },
  "studded-leather": { base: 12, dex: "full" },
  hide: { base: 12, dex: "max2" },
  "chain-shirt": { base: 13, dex: "max2" },
  "scale-mail": { base: 14, dex: "max2" },
  breastplate: { base: 14, dex: "max2" },
  "half-plate": { base: 15, dex: "max2" },
  "ring-mail": { base: 14, dex: "none" },
  "chain-mail": { base: 16, dex: "none" },
  splint: { base: 17, dex: "none" },
  "plate-armor": { base: 18, dex: "none" },
};

function wornIds(character) {
  return new Set((character.items || []).filter((item) => item && item.qty > 0).map((item) => item.id));
}

function dexPart(mode, dex) {
  if (mode === "full") return dex;
  if (mode === "max2") return Math.min(dex, 2);
  return 0;
}

export function armorClass(character) {
  if (Number.isInteger(character.acOverride)) return character.acOverride;
  const ids = wornIds(character);
  const totals = abilityTotals(character);
  const dex = abilityMod(totals.dex);
  const suits = Object.entries(ARMOR).filter(([id]) => ids.has(id)).map(([, spec]) => spec);
  const suit = suits.sort((a, b) => b.base - a.base)[0] || null;
  const shield = ids.has("shield") ? 2 : 0;
  if (suit) return Math.max(0, suit.base + dexPart(suit.dex, dex) + shield);
  const plain = 10 + dex + shield;
  const barbarian = character.classId === "barbarian" ? 10 + dex + abilityMod(totals.con) + shield : plain;
  const monk = character.classId === "monk" && shield === 0
    ? 10 + dex + abilityMod(totals.wis)
    : plain;
  return Math.max(0, plain, barbarian, monk);
}
