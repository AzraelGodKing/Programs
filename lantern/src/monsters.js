// A short list of common monsters for one-tap adds on the DM screen.
// Numbers are from the System Reference Document 5.1 by Wizards of the Coast,
// used under the Creative Commons Attribution 4.0 license.

const M = (name, cr, ac, hp, mods, attacks, extra = {}) => ({
  name,
  cr,
  ac,
  hp,
  mods: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map((id, index) => [id, mods[index]])),
  attacks: attacks.map(([attack, hit, damage]) => ({ name: attack, hit, damage })),
  ...extra,
});

export const SRD_MONSTERS = [
  M("Giant rat", "1/8", 12, 7, [-2, 2, 0, -4, 0, -3], [["Bite", 4, "1d4+2"]]),
  M("Kobold", "1/8", 12, 5, [-2, 2, -1, -1, -2, -1], [["Dagger", 4, "1d4+2"], ["Sling", 4, "1d4+2"]]),
  M("Bandit", "1/8", 12, 11, [0, 1, 1, 0, 0, 0], [["Scimitar", 3, "1d6+1"], ["Light crossbow", 3, "1d8+1"]]),
  M("Cultist", "1/8", 12, 9, [0, 1, 0, 0, 0, 0], [["Scimitar", 3, "1d6+1"]]),
  M("Guard", "1/8", 16, 11, [1, 1, 1, 0, 0, -1], [["Spear", 3, "1d6+1"]]),
  M("Goblin", "1/4", 15, 7, [-1, 2, 0, 0, -1, -1], [["Scimitar", 4, "1d6+2"], ["Shortbow", 4, "1d6+2"]]),
  M("Skeleton", "1/4", 13, 13, [0, 2, 2, -2, -1, -3], [["Shortsword", 4, "1d6+2"], ["Shortbow", 4, "1d6+2"]]),
  M("Zombie", "1/4", 8, 22, [1, -2, 3, -4, -2, -3], [["Slam", 3, "1d6+1"]]),
  M("Wolf", "1/4", 13, 11, [1, 2, 1, -4, 1, -2], [["Bite", 4, "2d4+2"]]),
  M("Orc", "1/2", 13, 15, [3, 1, 3, -2, 0, 0], [["Greataxe", 5, "1d12+3"], ["Javelin", 5, "1d6+3"]]),
  M("Hobgoblin", "1/2", 18, 11, [1, 1, 1, 0, 0, -1], [["Longsword", 3, "1d8+1"], ["Longbow", 3, "1d8+1"]]),
  M("Gnoll", "1/2", 15, 22, [2, 1, 0, -2, 0, -2], [["Bite", 4, "1d4+2"], ["Spear", 4, "1d6+2"]]),
  M("Thug", "1/2", 11, 32, [2, 0, 2, 0, 0, 0], [["Mace", 4, "1d6+2"]]),
  M("Bugbear", "1", 16, 27, [2, 2, 1, -1, 0, -1], [["Morningstar", 4, "2d8+2"]]),
  M("Dire wolf", "1", 14, 37, [3, 2, 2, -4, 1, -2], [["Bite", 5, "2d6+3"]]),
  M("Ghoul", "1", 12, 22, [1, 2, 0, -2, 0, -2], [["Claws", 4, "2d4+2"], ["Bite", 2, "2d6+2"]]),
  M("Giant spider", "1", 14, 26, [2, 3, 1, -4, 0, -3], [["Bite", 5, "1d8+3"]]),
  M("Ogre", "2", 11, 59, [4, -1, 3, -3, -2, -2], [["Greatclub", 6, "2d8+4"], ["Javelin", 6, "2d6+4"]]),
  M("Bandit captain", "2", 15, 65, [2, 3, 2, 2, 0, 2], [["Scimitar", 5, "1d6+3"], ["Dagger", 5, "1d4+3"]]),
  M("Gelatinous cube", "2", 6, 84, [2, -4, 5, -5, -4, -5], [["Pseudopod", 4, "3d6"]]),
  M("Owlbear", "3", 13, 59, [4, 1, 3, -4, 1, -2], [["Beak", 7, "1d10+5"], ["Claws", 7, "2d8+5"]]),
  M("Minotaur", "3", 14, 76, [4, 0, 3, -2, 3, -1], [["Greataxe", 6, "2d12+4"], ["Gore", 6, "2d8+4"]]),
  M("Troll", "5", 15, 84, [4, 1, 5, -2, -1, -2], [["Claw", 7, "2d6+4"], ["Bite", 7, "1d6+4"]]),
  M("Hill giant", "5", 13, 105, [5, -1, 4, -3, -1, -2], [["Greatclub", 8, "3d8+5"], ["Rock", 8, "3d10+5"]]),
  M("Young red dragon", "10", 18, 178, [6, 0, 5, 2, 0, 4], [["Bite", 10, "2d10+6"], ["Claw", 10, "2d6+6"]], { legendary: 0 }),
  M("Adult red dragon", "17", 19, 256, [8, 0, 7, 3, 1, 5], [["Bite", 14, "2d10+8"], ["Claw", 14, "2d6+8"], ["Tail", 14, "2d8+8"]], { legendary: 3, lair: true }),
];

const MOD = (score) => Math.floor((Number(score) - 10) / 2);

/** Reads "+4 to hit" and "Hit: 5 (1d6 + 2)" out of Library action text. */
export function attacksFromActions(actions) {
  const attacks = [];
  for (const action of Array.isArray(actions) ? actions : []) {
    const body = String(action?.text || "");
    const hit = body.match(/([+-]\s*\d+)\s+to hit/i);
    const damage = body.match(/Hit:\s*\d+\s*\(([^)]+)\)/i);
    if (!hit || !damage) continue;
    attacks.push({
      name: String(action.name || "Attack").replace(/\.$/, "").slice(0, 40),
      hit: Number(hit[1].replace(/\s+/g, "")),
      damage: damage[1].replace(/\s+/g, ""),
    });
    if (attacks.length >= 4) break;
  }
  return attacks;
}

/** Turns a Library monster (scores and action text) into the quick-add shape. */
export function fromLibrary(monster) {
  const scores = monster?.scores || {};
  const legendText = (monster?.legendary || []).map((entry) => entry.text).join(" ");
  const legendCount = legendText.match(/can take (\d+) legendary actions/i);
  return {
    name: monster.name,
    cr: monster.cr || "",
    ac: monster.ac,
    hp: monster.hp,
    mods: Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map((id) => [id, MOD(scores[id] ?? 10)])),
    attacks: attacksFromActions(monster.actions),
    legendary: legendCount ? Number(legendCount[1]) : (monster?.legendary?.length ? 3 : 0),
  };
}

/**
 * Builds order rows for one or more of a monster. With shared initiative,
 * one roll seats the whole group together.
 */
export function monsterRows(monster, { count = 1, hidden = false, shared = true, existing = [], rollD20 }) {
  const how = Math.max(1, Math.min(12, Math.floor(count) || 1));
  const dex = monster.mods?.dex ?? 0;
  const taken = existing.filter((person) => person.name === monster.name || person.name.startsWith(`${monster.name} `)).length;
  let sequence = existing.reduce((max, person) => Math.max(max, person.order), 0);
  const groupDie = rollD20();
  const rows = [];
  for (let index = 0; index < how; index += 1) {
    const die = shared ? groupDie : (index === 0 ? groupDie : rollD20());
    sequence += 1;
    const number = taken + index + 1;
    rows.push({
      id: crypto.randomUUID(),
      name: how === 1 && !taken ? monster.name : `${monster.name} ${number}`,
      seat: "",
      init: die + dex,
      bonus: dex,
      die,
      hp: monster.hp,
      maxHp: monster.hp,
      ac: monster.ac,
      marks: [],
      exhaustion: 0,
      death: { success: 0, failure: 0, stable: false },
      order: sequence,
      mods: { ...monster.mods },
      attacks: monster.attacks.map((attack) => ({ ...attack })),
      ...(hidden ? { hidden: true } : {}),
      ...(monster.legendary ? { legendary: { max: monster.legendary, used: 0 } } : {}),
      ...(monster.lair && index === 0 ? { lair: true } : {}),
    });
  }
  return rows;
}
